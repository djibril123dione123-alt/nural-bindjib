// ============================================================
// useQuestEngine.ts — Sultan Engine V3 STABLE
//
// Fixes appliqués :
//   ✅ Params RPC exacts : p_user_id / p_amount / p_source
//   ✅ Optimistic UI + rollback automatique si erreur
//   ✅ Mutex anti double-clic
//   ✅ dailyXpRef pour éviter les closures stales
//   ✅ Confetti uniquement sur leveled_up === true ou seuil Baraka
//   ✅ .single() sur la requête profiles
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CustomQuest {
  id: string;
  label: string;
  pillar: string;
  xp_value: number;
}

export interface QuestEngineReturn {
  completed:                Record<string, boolean>;
  toggleQuest:              (questId: string, pillar: string, xpValue?: number) => Promise<void>;
  totalXp:                  number;
  dailyXp:                  number;
  pillarProgress:           Record<string, number>;
  applyPenalty:             (amount: number, reason: string) => Promise<void>;
  confetti:                 "levelup" | "baraka" | null;
  addCustomQuest:           (pillarId: string, label: string) => Promise<void>;
  deleteCustomQuest:        (questId: string, pillarId: string) => Promise<void>;
  getCustomQuestsForPillar: (pillarId: string) => CustomQuest[];
}

const DEFAULT_XP = 10;
const BARAKA: Record<string, number> = { guide: 150, guardian: 300 };

export function useQuestEngine(): QuestEngineReturn {
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

  const role  = (profile?.role as string) ?? "guide";
  const today = new Date().toISOString().slice(0, 10);

  // ── loadState ───────────────────────────────────────────
  const loadState = useCallback(async () => {
    if (!user?.id) return;

    const [tasksRes, profRes, dpRes, cqRes] = await Promise.all([
      supabase
        .from("user_tasks")
        .select("task_id, completed, xp_value, pillar")
        .eq("user_id", user.id)
        .eq("date", today),
      supabase
        .from("profiles")
        .select("total_xp")
        .eq("user_id", user.id)
        .single(),                     // ✅ .single() — pas de tableau
      supabase
        .from("daily_progress")
        .select("daily_xp")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("custom_quests")
        .select("id, label, pillar, xp_value")
        .eq("user_id", user.id),
    ]);

    const completedMap: Record<string, boolean> = {};
    const pillarDone:   Record<string, number>  = {};
    const pillarTotal:  Record<string, number>  = {};

    for (const t of (tasksRes.data ?? []) as Array<{
      task_id: string; completed: boolean; pillar?: string;
    }>) {
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
    setCustomQ((cqRes.data ?? []) as CustomQuest[]);
  }, [user?.id, today]);

  useEffect(() => {
    if (!user?.id) return;
    loadState();

    const ch = supabase
      .channel(`quest-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "user_tasks",
        filter: `user_id=eq.${user.id}`,
      }, () => loadState())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "profiles",
        filter: `user_id=eq.${user.id}`,
      }, (p: { new: { total_xp?: number } }) => {
        if (p.new?.total_xp !== undefined) setTotalXp(p.new.total_xp);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id, loadState]);

  // ── toggleQuest ─────────────────────────────────────────
  const toggleQuest = useCallback(async (
    questId: string,
    pillar:  string,
    xpValue = DEFAULT_XP,
  ) => {
    if (!user?.id || pending.current.has(questId)) return;
    pending.current.add(questId);

    const wasDone = completed[questId] ?? false;
    const nowDone = !wasDone;

    // Optimistic update
    setCompleted((prev) => ({ ...prev, [questId]: nowDone }));

    try {
      // 1 — UPSERT user_tasks
      const { error: taskErr } = await supabase
        .from("user_tasks")
        .upsert(
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
      if (taskErr) throw new Error(`user_tasks: ${taskErr.message}`);

      // 2 — RPC XP atomique
      //     Params EXACTS de la fonction SQL :
      //     add_xp(p_user_id uuid, p_amount integer, p_source text)
      //     → JSON { new_xp, new_level, leveled_up }
      if (nowDone) {
        const { data: rpc, error: rpcErr } = await supabase.rpc("add_xp", {
          p_user_id: user.id,           // uuid
          p_amount:  xpValue,           // integer
          p_source:  `task_${questId}`, // text
        });
        if (rpcErr) throw new Error(`add_xp: ${rpcErr.message}`);

        const row = Array.isArray(rpc) ? rpc[0] : rpc;
        if (row?.new_xp !== undefined) setTotalXp(row.new_xp as number);

        if (row?.leveled_up === true) {
          setConfetti("levelup");
          toast.success(`👑 Level ${row.new_level ?? "UP"} débloqué !`, { duration: 4000 });
          setTimeout(() => setConfetti(null), 4500);
        }
      } else {
        const { data: newXp, error: rpcErr } = await supabase.rpc("remove_xp", {
          p_user_id: user.id,
          p_amount:  xpValue,
          p_source:  `unchecked_${questId}`,
        });
        if (rpcErr) throw new Error(`remove_xp: ${rpcErr.message}`);
        if (newXp != null) setTotalXp(newXp as number);
      }

      // 3 — daily_progress
      const prevDaily = dailyXpRef.current;
      const newDaily  = nowDone ? prevDaily + xpValue : Math.max(0, prevDaily - xpValue);
      await supabase
        .from("daily_progress")
        .upsert({ user_id: user.id, date: today, daily_xp: newDaily }, { onConflict: "user_id,date" });
      setDailyXp(newDaily);

      // 4 — Baraka bonus (franchissement du seuil uniquement)
      const target = BARAKA[role] ?? 150;
      if (nowDone && newDaily >= target && prevDaily < target) {
        setConfetti("baraka");
        toast.success("✨ Objectif Baraka ! +50 XP bonus !", { duration: 4000 });
        const { data: bonus } = await supabase.rpc("add_xp", {
          p_user_id: user.id, p_amount: 50, p_source: "baraka_bonus",
        });
        const b = Array.isArray(bonus) ? bonus[0] : bonus;
        if (b?.new_xp !== undefined) setTotalXp(b.new_xp as number);
        setTimeout(() => setConfetti(null), 4500);
      }

      // 5 — Activity feed (feu-et-oublie)
      supabase.from("activity_feed").insert({
        user_id:   user.id,
        action:    nowDone
          ? `a validé [${pillar}] +${xpValue} XP`
          : `a décoché [${pillar}] -${xpValue} XP`,
        xp_earned: nowDone ? xpValue : -xpValue,
      }).then(() => {});

    } catch (err) {
      // Rollback optimistic
      setCompleted((prev) => ({ ...prev, [questId]: wasDone }));
      console.error("[QuestEngine]", err);
      toast.error("Erreur de synchronisation", {
        description: err instanceof Error ? err.message : "Réessaie dans un instant.",
      });
    } finally {
      pending.current.delete(questId);
      loadState();
    }
  }, [user?.id, completed, role, today, loadState]);

  // ── applyPenalty ────────────────────────────────────────
  const applyPenalty = useCallback(async (amount: number, reason: string) => {
    if (!user?.id) return;
    const { data: newXp } = await supabase.rpc("remove_xp", {
      p_user_id: user.id, p_amount: amount, p_source: reason,
    });
    if (newXp != null) setTotalXp(newXp as number);
    await supabase.from("activity_feed").insert({
      user_id: user.id, action: `⚠️ Pénalité : ${reason} (-${amount} XP)`, xp_earned: -amount,
    });
  }, [user?.id]);

  // ── Custom quests ───────────────────────────────────────
  const addCustomQuest = useCallback(async (pillarId: string, label: string) => {
    if (!user?.id || !label.trim()) return;
    const { data } = await supabase
      .from("custom_quests")
      .insert({ user_id: user.id, pillar: pillarId, label: label.trim(), xp_value: DEFAULT_XP })
      .select().single();
    if (data) setCustomQ((prev) => [...prev, data as CustomQuest]);
  }, [user?.id]);

  const deleteCustomQuest = useCallback(async (questId: string) => {
    if (!user?.id) return;
    await supabase.from("custom_quests").delete().eq("id", questId).eq("user_id", user.id);
    setCustomQ((prev) => prev.filter((q) => q.id !== questId));
  }, [user?.id]);

  const getCustomQuestsForPillar = useCallback(
    (pillarId: string) => customQ.filter((q) => q.pillar === pillarId),
    [customQ],
  );

  return {
    completed, toggleQuest, totalXp, dailyXp,
    pillarProgress: pillarProg, applyPenalty, confetti,
    addCustomQuest, deleteCustomQuest, getCustomQuestsForPillar,
  };
}
