// useQuestEngine.ts

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ACTIVITY_EVENT_DEFAULT, ACTIVITY_LABEL_DEFAULT } from "@/lib/activityFeedDefaults";
import { applyXpDelta } from "@/lib/xpRpc";
import { completeTaskWithXp, deleteActivityEntry, removeTaskActivity, safeWrite } from "@/services/database.service";

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
        .eq("id", user.id)
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
        filter: `id=eq.${user.id}`,
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
      // Chemin premium: RPC atomique (tâche + XP + activity_feed) côté serveur.
      // Fallback : logique client si la RPC n'existe pas (projets non migrés).
      try {
        const rpcRes: any = await completeTaskWithXp({
          task_id: questId,
          pillar,
          xp_value: xpValue,
          date: today,
          completed: nowDone,
        });
        const row = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
        if (row?.new_xp != null) setTotalXp(row.new_xp);
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        if (!msg.includes("Could not find the function") && !msg.includes("complete_task_with_xp")) {
          throw e;
        }

        const taskRow: TablesInsert<"user_tasks"> = {
          user_id: user.id,
          task_id: questId,
          date: today,
          completed: nowDone,
          xp_value: xpValue,
          pillar,
          completed_at: nowDone ? new Date().toISOString() : null,
        };
        await safeWrite(
          supabase.from("user_tasks").upsert(taskRow, { onConflict: "user_id,task_id,date" }),
          "user_tasks.upsert",
        );

        if (nowDone) {
          const row = await applyXpDelta(user.id, xpValue, `task_${questId}`);
          if (row?.new_xp != null) setTotalXp(row.new_xp);
          if (row?.leveled_up === true) {
            setConfetti("levelup");
            toast.success(`👑 Level ${row.new_level} débloqué !`);
            setTimeout(() => setConfetti(null), 4500);
          }
        } else {
          const row = await applyXpDelta(user.id, -xpValue, `unchecked_${questId}`);
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
        await applyXpDelta(user.id, 50, "baraka_bonus");
        setTimeout(() => setConfetti(null), 4500);
      }

        if (nowDone) {
          // IMPORTANT: event_type doit être 'task' pour permettre la suppression fiable au décochage.
          const feedRow: TablesInsert<"activity_feed"> = {
            actor_id: user.id,
            user_id: user.id,
            event_type: "task",
            event_label: ACTIVITY_LABEL_DEFAULT,
            action: `validé [${pillar}] (${questId}) +${xpValue} XP`,
            xp_earned: xpValue,
          };
          await safeWrite(supabase.from("activity_feed").insert(feedRow), "activity_feed.insert_task");
        } else {
          // Politique produit: pas de ligne "décoché" dans le Miroir, on retire la victoire.
          await deleteActivityEntry({ actor_id: user.id, pillar, date: today });
          // fallback plus permissif si le format de l'action a changé
          await removeTaskActivity(user.id, pillar, questId);
        }
      }

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
    const row = await applyXpDelta(user.id, -amount, reason);
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
