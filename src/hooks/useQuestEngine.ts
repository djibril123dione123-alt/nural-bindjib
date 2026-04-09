// useQuestEngine.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type CustomQuest = { id: string; label: string; xp: number; category: string };

export function useQuestEngine() {
  const { user, profile } = useAuth();
  const [completed,  setCompleted]  = useState<Record<string, boolean>>({});
  const [totalXp,    setTotalXp]    = useState(0);
  const [dailyXp,    setDailyXp]    = useState(0);
  const [pillarProg, setPillarProg] = useState<Record<string, number>>({});
  const [confetti,   setConfetti]   = useState<"levelup" | "baraka" | null>(null);
  const [customQ,    setCustomQ]    = useState<CustomQuest[]>([]);

  const pending    = useRef<Set<string>>(new Set());
  const dailyXpRef = useRef(0);
  dailyXpRef.current = dailyXp;

  const today = new Date().toISOString().slice(0, 10);
  const role  = (profile?.role as string) ?? "guide";
  const BARAKA_TARGET = role === "guardian" ? 300 : 150;

  const loadState = useCallback(async () => {
    if (!user?.id) return;

    const [tasksRes, profRes, dpRes, cqRes] = await Promise.all([
      supabase.from("user_tasks")
        .select("task_id, completed, xp_value, pillar")
        .eq("user_id", user.id)
        .eq("date", today),
      supabase.from("profiles")
        .select("total_xp")
        .eq("user_id", user.id)
        .single(),
      supabase.from("daily_progress")
        .select("daily_xp")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase.from("custom_quests")
        .select("id, title, category, xp")
        .eq("user_id", user.id),
    ]);

    // Log de diagnostic — retirer après résolution
    console.log("[QuestEngine] tasksRes:", tasksRes.error ?? `${tasksRes.data?.length} rows`);
    console.log("[QuestEngine] profRes:", profRes.error ?? profRes.data);

    const completedMap: Record<string, boolean> = {};
    const pillarDone:   Record<string, number>  = {};
    const pillarTotal:  Record<string, number>  = {};

    for (const t of (tasksRes.data ?? [])) {
      if (t.completed) completedMap[t.task_id] = true;
      if (t.pillar) {
        pillarTotal[t.pillar] = (pillarTotal[t.pillar] ?? 0) + 1;
        if (t.completed) pillarDone[t.pillar] = (pillarDone[t.pillar] ?? 0) + 1;
      }
    }

    const progress: Record<string, number> = {};
    for (const p of Object.keys(pillarTotal)) {
      progress[p] = Math.round(((pillarDone[p] ?? 0) / pillarTotal[p]) * 100);
    }

    setCompleted(completedMap);
    setTotalXp(profRes.data?.total_xp ?? 0);
    setDailyXp(dpRes.data?.daily_xp ?? 0);
    setPillarProg(progress);
    setCustomQ((cqRes.data ?? []).map((q) => ({
      id: q.id,
      label: q.title,
      xp: q.xp,
      category: q.category,
    })));
  }, [user?.id, today]);

  useEffect(() => {
    if (!user?.id) return;
    loadState();
    const ch = supabase
      .channel(`quest-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "profiles",
        filter: `user_id=eq.${user.id}`,
      }, (p: any) => {
        if (p.new?.total_xp !== undefined) setTotalXp(p.new.total_xp);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, loadState]);

  const toggleQuest = useCallback(async (
    questId: string,
    pillar:  string,
    xpValue = 10,
  ) => {
    if (!user?.id || pending.current.has(questId)) return;
    pending.current.add(questId);

    const wasDone = completed[questId] ?? false;
    const nowDone = !wasDone;
    setCompleted(prev => ({ ...prev, [questId]: nowDone }));

    try {
      const { error: taskErr } = await supabase.from("user_tasks").upsert(
        {
          user_id:      user.id,
          task_id:      questId,
          date:         today,
          completed:    nowDone,
          completed_at: nowDone ? new Date().toISOString() : null,
          xp_value:     xpValue,
          pillar,
        },
        { onConflict: "user_id,task_id,date" },
      );
      if (taskErr) throw new Error(`user_tasks upsert: ${taskErr.message}`);

      if (nowDone) {
        const { data: rpc, error: rpcErr } = await supabase.rpc("add_xp", {
          p_user_id: user.id,
          p_amount:  xpValue,
          p_source:  `task_${questId}`,
        });
        if (rpcErr) throw new Error(`add_xp: ${rpcErr.message}`);
        const row = Array.isArray(rpc) ? rpc[0] : rpc;
        if (row?.new_xp != null) setTotalXp(row.new_xp);
        if (row?.leveled_up === true) {
          setConfetti("levelup");
          toast.success(`👑 Level ${row.new_level} débloqué !`);
          setTimeout(() => setConfetti(null), 4500);
        }
      } else {
        const { data: newXp, error: rpcErr } = await supabase.rpc("remove_xp", {
          p_user_id: user.id,
          p_amount:  xpValue,
          p_source:  `unchecked_${questId}`,
        });
        if (rpcErr) throw new Error(`remove_xp: ${rpcErr.message}`);
        const row = Array.isArray(newXp) ? newXp[0] : newXp;
        if (row?.new_xp != null) setTotalXp(row.new_xp);
      }

      const prev    = dailyXpRef.current;
      const newDay  = nowDone ? prev + xpValue : Math.max(0, prev - xpValue);
      await supabase.from("daily_progress").upsert(
        { user_id: user.id, date: today, daily_xp: newDay },
        { onConflict: "user_id,date" },
      );
      setDailyXp(newDay);

      if (nowDone && newDay >= BARAKA_TARGET && prev < BARAKA_TARGET) {
        setConfetti("baraka");
        toast.success("✨ Objectif Baraka ! +50 XP !");
        await supabase.rpc("add_xp", { p_user_id: user.id, p_amount: 50, p_source: "baraka_bonus" });
        setTimeout(() => setConfetti(null), 4500);
      }

      supabase.from("activity_feed").insert({
        user_id:   user.id,
        action:    nowDone ? `validé [${pillar}] +${xpValue} XP` : `décoché [${pillar}]`,
        xp_earned: nowDone ? xpValue : -xpValue,
      }).then(() => {});

    } catch (err: any) {
      setCompleted(prev => ({ ...prev, [questId]: wasDone }));
      toast.error("Erreur", { description: err?.message });
    } finally {
      pending.current.delete(questId);
      loadState();
    }
  }, [user?.id, completed, today, BARAKA_TARGET, loadState]);

  const applyPenalty = useCallback(async (amount: number, reason: string) => {
    if (!user?.id) return;
    const { data: newXp } = await supabase.rpc("remove_xp", {
      p_user_id: user.id, p_amount: amount, p_source: reason,
    });
    const row = Array.isArray(newXp) ? newXp[0] : newXp;
    if (row?.new_xp != null) setTotalXp(row.new_xp);
  }, [user?.id]);

  const addCustomQuest = useCallback(async (category: string, title: string, xp = 10) => {
    if (!user?.id || !title.trim()) return;
    const { data } = await supabase.from("custom_quests")
      .insert({ user_id: user.id, category, title: title.trim(), xp })
      .select().single();
    if (data) setCustomQ((prev) => [
      ...prev,
      { id: data.id, label: data.title, xp: data.xp, category: data.category },
    ]);
  }, [user?.id]);

  const deleteCustomQuest = useCallback(async (questId: string) => {
    if (!user?.id) return;
    await supabase.from("custom_quests").delete().eq("id", questId).eq("user_id", user.id);
    setCustomQ((prev) => prev.filter((q) => q.id !== questId));
  }, [user?.id]);

  const getCustomQuestsForPillar = useCallback(
    (pillarId: string) => customQ.filter((q) => q.category === pillarId),
    [customQ],
  );

  return {
    completed, toggleQuest, totalXp, dailyXp,
    pillarProgress: pillarProg, applyPenalty, confetti,
    addCustomQuest, deleteCustomQuest, getCustomQuestsForPillar,
  };
}
