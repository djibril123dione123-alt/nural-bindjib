// ============================================================
// useQuestEngine.ts — Anti-Race-Condition
//
// TOUS les changements XP passent par les RPC Supabase :
//   add_xp(p_user_id, p_amount, p_source)  → { new_xp, new_level, leveled_up }
//   remove_xp(p_user_id, p_amount, p_source) → new_xp (INTEGER)
//
// Ces fonctions PLPGSQL utilisent une transaction atomique :
//   SELECT total_xp → calcul → UPDATE → INSERT xp_history
// Résultat : zéro conflit d'écriture entre useQuestEngine
// et useMidnightPenalty, même s'ils s'exécutent simultanément.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface QuestState { [questId: string]: boolean; }
interface PillarProgress { [pillarId: string]: number; }
interface CustomQuest { id: string; label: string; pillar: string; xp_value: number; }

export interface QuestEngineReturn {
  completed: QuestState;
  toggleQuest: (questId: string, pillar: string, xpValue?: number) => Promise<void>;
  totalXp: number;
  dailyXp: number;
  pillarProgress: PillarProgress;
  applyPenalty: (amount: number, reason: string) => Promise<void>;
  confetti: "levelup" | "baraka" | null;
  addCustomQuest: (pillarId: string, label: string) => Promise<void>;
  deleteCustomQuest: (questId: string, pillarId: string) => Promise<void>;
  getCustomQuestsForPillar: (pillarId: string) => CustomQuest[];
}

const DEFAULT_XP = 10;

export function useQuestEngine(): QuestEngineReturn {
  const { user, profile } = useAuth();
  const [completed, setCompleted]         = useState<QuestState>({});
  const [totalXp, setTotalXp]             = useState(0);
  const [dailyXp, setDailyXp]             = useState(0);
  const [pillarProgress, setPillarProgress] = useState<PillarProgress>({});
  const [confetti, setConfetti]           = useState<"levelup" | "baraka" | null>(null);
  const [customQuests, setCustomQuests]   = useState<CustomQuest[]>([]);

  // Mutex léger — empêche les double-clics d'envoyer 2 requêtes
  const pending = useRef<Set<string>>(new Set());
  const today   = new Date().toISOString().slice(0, 10);
  const role    = profile?.role ?? "guide";

  // ─── Chargement initial ─────────────────────────────────
  const loadState = useCallback(async () => {
    if (!user) return;

    const [tasksRes, profRes, dpRes, cqRes] = await Promise.all([
      supabase.from("user_tasks").select("task_id,completed,xp_value,pillar")
        .eq("user_id", user.id).eq("date", today),
      supabase.from("profiles").select("total_xp").eq("user_id", user.id).single(),
      supabase.from("daily_progress").select("daily_xp")
        .eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("custom_quests").select("*").eq("user_id", user.id),
    ]);

    const completedMap: QuestState = {};
    const pillarDone: Record<string, number> = {};
    const pillarTotal: Record<string, number> = {};

    (tasksRes.data ?? []).forEach((t: any) => {
      if (t.completed) completedMap[t.task_id] = true;
      if (t.pillar) {
        pillarTotal[t.pillar] = (pillarTotal[t.pillar] ?? 0) + 1;
        if (t.completed) pillarDone[t.pillar] = (pillarDone[t.pillar] ?? 0) + 1;
      }
    });

    setCompleted(completedMap);
    setTotalXp(profRes.data?.total_xp ?? 0);
    setDailyXp(dpRes.data?.daily_xp ?? 0);
    setCustomQuests((cqRes.data ?? []) as CustomQuest[]);

    // Recalculer progression piliers
    const progress: PillarProgress = {};
    Object.keys(pillarTotal).forEach((p) => {
      progress[p] = Math.round(((pillarDone[p] ?? 0) / pillarTotal[p]) * 100);
    });
    setPillarProgress(progress);
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    loadState();

    const ch = supabase
      .channel(`quest-engine-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_tasks",
          filter: `user_id=eq.${user.id}` }, () => loadState())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles",
          filter: `user_id=eq.${user.id}` }, (p: any) => {
        if (p.new?.total_xp !== undefined) setTotalXp(p.new.total_xp);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, loadState]);

  // ─── Toggle tâche — 100% atomique via RPC ───────────────
  const toggleQuest = useCallback(async (
    questId: string,
    pillar: string,
    xpValue = DEFAULT_XP
  ) => {
    if (!user || pending.current.has(questId)) return;
    pending.current.add(questId);

    const wasDone  = completed[questId] ?? false;
    const nowDone  = !wasDone;

    // Optimistic update
    setCompleted((prev) => ({ ...prev, [questId]: nowDone }));

    try {
      // 1. Persister dans user_tasks (UPSERT — clé unique user_id+task_id+date)
      const { error: taskErr } = await supabase.from("user_tasks").upsert({
        user_id: user.id, task_id: questId, date: today,
        completed: nowDone,
        completed_at: nowDone ? new Date().toISOString() : null,
        xp_value: xpValue, pillar,
      }, { onConflict: "user_id,task_id,date" });

      if (taskErr) throw taskErr;

      // 2. XP atomique via RPC — aucune race condition possible
      if (nowDone) {
        const { data: res, error: xpErr } = await supabase.rpc("add_xp", {
          p_user_id: user.id,
          p_amount: xpValue,
          p_source: `task_${questId}`,
        });
        if (xpErr) throw xpErr;

        const row = Array.isArray(res) ? res[0] : res;
        if (row) {
          setTotalXp(row.new_xp);

          // ✅ Confetti SEULEMENT si level-up réel
          if (row.leveled_up) {
            setConfetti("levelup");
            toast.success(`👑 Level ${row.new_level} débloqué !`, { duration: 4000 });
            setTimeout(() => setConfetti(null), 4500);
          }
        }
      } else {
        const { data: newXp, error: xpErr } = await supabase.rpc("remove_xp", {
          p_user_id: user.id,
          p_amount: xpValue,
          p_source: `task_unchecked_${questId}`,
        });
        if (xpErr) throw xpErr;
        if (newXp !== null && newXp !== undefined) setTotalXp(newXp);
      }

      // 3. Mise à jour daily_progress
      const newDaily = nowDone ? dailyXp + xpValue : Math.max(0, dailyXp - xpValue);
      await supabase.from("daily_progress").upsert(
        { user_id: user.id, date: today, daily_xp: newDaily },
        { onConflict: "user_id,date" }
      );
      setDailyXp(newDaily);

      // 4. ✅ Confetti Baraka SEULEMENT au franchissement du seuil
      const barakaTarget = role === "guardian" ? 300 : 150;
      if (nowDone && newDaily >= barakaTarget && dailyXp < barakaTarget) {
        setConfetti("baraka");
        toast.success("✨ Objectif Baraka atteint ! +50 XP bonus !", { duration: 4000 });

        // Bonus atomique
        const { data: bonusRes } = await supabase.rpc("add_xp", {
          p_user_id: user.id, p_amount: 50, p_source: "baraka_bonus",
        });
        const bonusRow = Array.isArray(bonusRes) ? bonusRes[0] : bonusRes;
        if (bonusRow) setTotalXp(bonusRow.new_xp);

        setTimeout(() => setConfetti(null), 4500);
      }

      // 5. Activity feed
      await supabase.from("activity_feed").insert({
        user_id: user.id,
        action: nowDone
          ? `a validé une tâche [${pillar}] +${xpValue} XP`
          : `a décoché une tâche [${pillar}] -${xpValue} XP`,
        xp_earned: nowDone ? xpValue : -xpValue,
      });

    } catch (err) {
      // Rollback
      setCompleted((prev) => ({ ...prev, [questId]: wasDone }));
      console.error("[QuestEngine]", err);
      toast.error("Erreur sync — réessaie.");
    } finally {
      pending.current.delete(questId);
      loadState();
    }
  }, [user, completed, dailyXp, role, today, loadState]);

  // ─── Pénalité manuelle (boutons, minuit) ────────────────
  const applyPenalty = useCallback(async (amount: number, reason: string) => {
    if (!user) return;
    const { data: newXp } = await supabase.rpc("remove_xp", {
      p_user_id: user.id, p_amount: amount, p_source: reason,
    });
    if (newXp !== null && newXp !== undefined) setTotalXp(newXp);
    await supabase.from("activity_feed").insert({
      user_id: user.id,
      action: `⚠️ Pénalité : ${reason} (-${amount} XP)`,
      xp_earned: -amount,
    });
  }, [user]);

  // ─── Custom quests ────────────────────────────────────────
  const addCustomQuest = useCallback(async (pillarId: string, label: string) => {
    if (!user || !label.trim()) return;
    const { data } = await supabase.from("custom_quests")
      .insert({ user_id: user.id, pillar: pillarId, label: label.trim(), xp_value: DEFAULT_XP })
      .select().single();
    if (data) setCustomQuests((prev) => [...prev, data as CustomQuest]);
  }, [user]);

  const deleteCustomQuest = useCallback(async (questId: string) => {
    if (!user) return;
    await supabase.from("custom_quests").delete().eq("id", questId).eq("user_id", user.id);
    setCustomQuests((prev) => prev.filter((q) => q.id !== questId));
  }, [user]);

  const getCustomQuestsForPillar = useCallback(
    (pillarId: string) => customQuests.filter((q) => q.pillar === pillarId),
    [customQuests]
  );

  return {
    completed, toggleQuest, totalXp, dailyXp,
    pillarProgress, applyPenalty, confetti,
    addCustomQuest, deleteCustomQuest, getCustomQuestsForPillar,
  };
}
