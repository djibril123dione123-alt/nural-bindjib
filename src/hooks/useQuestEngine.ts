// ============================================================
// hooks/useQuestEngine.ts
// BUILD FIX : n'importe rien depuis questData qui n'est pas garanti
// Tous les changements XP via RPC add_xp / remove_xp (atomiques)
// Confetti uniquement sur level-up réel ou franchissement Baraka
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Quest } from "@/lib/questData";

// ─── Types ───────────────────────────────────────────────────
export interface QuestEngineReturn {
  completed:              Record<string, boolean>;
  toggleQuest:            (questId: string, pillar: string, xpValue?: number) => Promise<void>;
  totalXp:                number;
  dailyXp:                number;
  pillarProgress:         Record<string, number>;
  applyPenalty:           (amount: number, reason: string) => Promise<void>;
  confetti:               "levelup" | "baraka" | null;
  addCustomQuest:         (pillarId: string, label: string, xpValue?: number) => Promise<void>;
  deleteCustomQuest:      (questId: string) => Promise<void>;
  getCustomQuestsForPillar: (pillarId: string) => CustomQuest[];
}

interface CustomQuest extends Quest {
  pillar: string;
}

const DEFAULT_XP = 10;

// Seuils Baraka selon le rôle (cohérent avec Index.tsx)
const BARAKA_TARGET: Record<string, number> = {
  guide:    150,
  guardian: 300,
};

// ─── Hook ────────────────────────────────────────────────────
export function useQuestEngine(): QuestEngineReturn {
  const { user, profile }     = useAuth();
  const [completed,   setCompleted]   = useState<Record<string, boolean>>({});
  const [totalXp,     setTotalXp]     = useState(0);
  const [dailyXp,     setDailyXp]     = useState(0);
  const [pillarProg,  setPillarProg]  = useState<Record<string, number>>({});
  const [confetti,    setConfetti]    = useState<"levelup" | "baraka" | null>(null);
  const [customQ,     setCustomQ]     = useState<CustomQuest[]>([]);

  // Mutex léger anti double-clic
  const pending      = useRef<Set<string>>(new Set());
  // Ref pour daily XP (évite les closures stales dans les callbacks)
  const dailyXpRef   = useRef(0);
  dailyXpRef.current = dailyXp;

  const today = new Date().toISOString().slice(0, 10);
  const role  = (profile?.role as string) ?? "guide";

  // ─── loadState ─────────────────────────────────────────────
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
        .single(),

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

    // Construire la map completed et la progression par pilier
    const completedMap: Record<string, boolean> = {};
    const pillarDone:  Record<string, number>  = {};
    const pillarTotal: Record<string, number>  = {};

    for (const t of (tasksRes.data ?? []) as Array<{ task_id: string; completed: boolean; pillar?: string }>) {
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
    const newDaily = dpRes.data?.daily_xp ?? 0;
    setDailyXp(newDaily);
    setPillarProg(progress);
    setCustomQ(
      ((cqRes.data ?? []) as Array<{ id: string; label: string; pillar: string; xp_value: number }>).map((quest) => ({
        id: quest.id,
        label: quest.label,
        pillar: quest.pillar,
        xp: quest.xp_value,
      })),
    );
  }, [user?.id, today]);

  // ─── Realtime + initial load ────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    loadState();

    const ch = supabase
      .channel(`quest-engine-${user.id}`)
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

  // ─── toggleQuest ────────────────────────────────────────────
  const toggleQuest = useCallback(async (
    questId: string,
    pillar: string,
    xpValue = DEFAULT_XP
  ) => {
    if (!user?.id || pending.current.has(questId)) return;
    pending.current.add(questId);

    const wasDone = completed[questId] ?? false;
    const nowDone = !wasDone;
    const prevDaily = dailyXpRef.current;

    // Optimistic
    setCompleted((prev) => ({ ...prev, [questId]: nowDone }));

    try {
      // 1. UPSERT user_tasks
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
        { onConflict: "user_id,task_id,date" }
      );
      if (taskErr) {
        console.error("[QuestEngine][user_tasks upsert]", {
          questId,
          pillar,
          xpValue,
          userId: user.id,
          error: taskErr,
        });
        throw taskErr;
      }

      // 2. XP via RPC atomique
      if (nowDone) {
        const { data: res, error: xpErr } = await supabase.rpc("add_xp", {
          p_user_id: user.id,
          p_amount:  xpValue,
          p_source:  `task_${questId}`,
        });
        if (xpErr) {
          console.error("[QuestEngine][add_xp]", {
            questId,
            pillar,
            xpValue,
            userId: user.id,
            error: xpErr,
          });
          throw xpErr;
        }

        const row = Array.isArray(res) ? res[0] : res;
        if (typeof row?.new_xp === "number") setTotalXp(row.new_xp);

        // ✅ Confetti level-up uniquement si réellement passé de niveau
        if (row?.leveled_up) {
          setConfetti("levelup");
          toast.success(`👑 Level ${row.new_level ?? "Up"} débloqué !`, { duration: 4000 });
          setTimeout(() => setConfetti(null), 4500);
        }
      } else {
        const { data: newXp, error: xpErr } = await supabase.rpc("remove_xp", {
          p_user_id: user.id,
          p_amount:  xpValue,
          p_source:  `task_unchecked_${questId}`,
        });
        if (xpErr) {
          console.error("[QuestEngine][remove_xp]", {
            questId,
            pillar,
            xpValue,
            userId: user.id,
            error: xpErr,
          });
          throw xpErr;
        }
        const row = Array.isArray(newXp) ? newXp[0] : newXp;
        if (typeof row?.new_xp === "number") setTotalXp(row.new_xp);
      }

      // 3. daily_progress UPSERT
      const newDaily  = nowDone
        ? prevDaily + xpValue
        : Math.max(0, prevDaily - xpValue);

      const { error: dailyErr } = await supabase.from("daily_progress").upsert(
        { user_id: user.id, date: today, daily_xp: newDaily },
        { onConflict: "user_id,date" }
      );
      if (dailyErr) {
        console.error("[QuestEngine][daily_progress upsert]", {
          questId,
          pillar,
          xpValue,
          userId: user.id,
          prevDaily,
          newDaily,
          error: dailyErr,
        });
        throw dailyErr;
      }
      setDailyXp(newDaily);

      // 4. ✅ Confetti Baraka uniquement au franchissement du seuil
      const target = BARAKA_TARGET[role] ?? 150;
      if (nowDone && newDaily >= target && prevDaily < target) {
        setConfetti("baraka");
        toast.success("✨ Objectif Baraka ! +50 XP bonus !", { duration: 4000 });

        const { data: bonusRes } = await supabase.rpc("add_xp", {
          p_user_id: user.id,
          p_amount:  50,
          p_source:  "baraka_bonus",
        });
        const bonusRow = Array.isArray(bonusRes) ? bonusRes[0] : bonusRes;
        if (typeof bonusRow?.new_xp === "number") setTotalXp(bonusRow.new_xp);

        setTimeout(() => setConfetti(null), 4500);
      }

      // 5. Activity feed (non-bloquant)
      supabase.from("activity_feed").insert({
        user_id:   user.id,
        action:    nowDone
          ? `a validé [${pillar}] +${xpValue} XP`
          : `a décoché [${pillar}] -${xpValue} XP`,
        xp_earned: nowDone ? xpValue : -xpValue,
      }).then(() => {});

    } catch (err) {
      // Rollback optimiste
      setCompleted((prev) => ({ ...prev, [questId]: wasDone }));
      setDailyXp(prevDaily);
      console.error("[QuestEngine] toggleQuest error:", {
        questId,
        pillar,
        xpValue,
        wasDone,
        prevDaily,
        err,
      });
      toast.error("Erreur de synchronisation — réessaie.");
    } finally {
      pending.current.delete(questId);
      loadState();
    }
  }, [user?.id, completed, role, today, loadState]);

  // ─── applyPenalty ────────────────────────────────────────────
  const applyPenalty = useCallback(async (amount: number, reason: string) => {
    if (!user?.id) return;

    const { data: newXp } = await supabase.rpc("remove_xp", {
      p_user_id: user.id,
      p_amount:  amount,
      p_source:  reason,
    });
    const row = Array.isArray(newXp) ? newXp[0] : newXp;
    if (typeof row?.new_xp === "number") setTotalXp(row.new_xp);

    await supabase.from("activity_feed").insert({
      user_id:   user.id,
      action:    `⚠️ Pénalité : ${reason} (-${amount} XP)`,
      xp_earned: -amount,
    });
  }, [user?.id]);

  // ─── Custom quests ────────────────────────────────────────────
  const addCustomQuest = useCallback(async (pillarId: string, label: string, xpValue = DEFAULT_XP) => {
    if (!user?.id || !label.trim()) return;
    const { data } = await supabase
      .from("custom_quests")
      .insert({ user_id: user.id, pillar: pillarId, label: label.trim(), xp_value: xpValue })
      .select()
      .single();
    if (data) {
      const row = data as { id: string; label: string; pillar: string; xp_value: number };
      setCustomQ((prev) => [
        ...prev,
        {
          id: row.id,
          label: row.label,
          pillar: row.pillar,
          xp: row.xp_value,
        },
      ]);
    }
  }, [user?.id]);

  const deleteCustomQuest = useCallback(async (questId: string) => {
    if (!user?.id) return;
    await supabase.from("custom_quests").delete().eq("id", questId).eq("user_id", user.id);
    setCustomQ((prev) => prev.filter((q) => q.id !== questId));
  }, [user?.id]);

  const getCustomQuestsForPillar = useCallback(
    (pillarId: string) => customQ.filter((q) => q.pillar === pillarId),
    [customQ]
  );

  return {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress: pillarProg,
    applyPenalty,
    confetti,
    addCustomQuest,
    deleteCustomQuest,
    getCustomQuestsForPillar,
  };
}
