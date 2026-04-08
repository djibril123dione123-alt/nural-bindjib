// ============================================================
// useQuestEngine.ts — Anti-Race-Condition V3
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
import { PILLARS, getPillarsForRole, type Quest } from "@/lib/questData";
import { toast } from "sonner";

interface QuestState { [questId: string]: boolean; }
interface PillarProgress { [pillarId: string]: number; }

interface CustomQuestRow {
  id: string;
  user_id: string;
  title: string;
  category: string;
  xp: number;
}

export interface QuestEngineReturn {
  completed:              QuestState;
  toggleQuest:            (questId: string) => Promise<void>;
  totalXp:                number;
  dailyXp:                number;
  pillarProgress:         PillarProgress;
  applyPenalty:           (amount: number, reason?: string) => Promise<void>;
  confetti:               boolean;
  addCustomQuest:         (pillarId: string, label: string, xp: number) => Promise<void>;
  deleteCustomQuest:      (questId: string) => Promise<void>;
  getCustomQuestsForPillar: (pillarId: string) => Quest[];
}

const STORAGE_KEY   = "nur-albindjib-quests";
const XP_STORAGE_KEY = "nur-albindjib-total-xp";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadLocalState(): QuestState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data.date !== getTodayKey()) return {};
    return data.completed || {};
  } catch { return {}; }
}

function loadLocalXp(): number {
  try { return parseInt(localStorage.getItem(XP_STORAGE_KEY) || "0", 10); }
  catch { return 0; }
}

export function useQuestEngine(): QuestEngineReturn {
  const { user, profile } = useAuth();
  const role = (profile?.role as "guide" | "guardian") ?? "guide";

  const [completed,      setCompleted]      = useState<QuestState>(loadLocalState);
  const [totalXp,        setTotalXp]        = useState<number>(loadLocalXp);
  const [dailyXp,        setDailyXp]        = useState<number>(0);
  const [pillarProgress, setPillarProgress] = useState<PillarProgress>({});
  const [confetti,       setConfetti]       = useState<boolean>(false);
  const [customQuests,   setCustomQuests]   = useState<CustomQuestRow[]>([]);

  // Mutex léger — empêche les double-clics
  const pending = useRef<Set<string>>(new Set());
  const today   = getTodayKey();

  // ─── Charger depuis Supabase ─────────────────────────────
  const loadFromBackend = useCallback(async () => {
    if (!user) return;

    const [dpRes, profRes, cqRes] = await Promise.all([
      supabase.from("daily_progress").select("completed_quests,daily_xp,total_xp")
        .eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("profiles").select("total_xp").eq("user_id", user.id).single(),
      supabase.from("custom_quests").select("*").eq("user_id", user.id),
    ]);

    if (dpRes.data) {
      const quests = (dpRes.data.completed_quests || {}) as QuestState;
      setCompleted(quests);
      setDailyXp(dpRes.data.daily_xp || 0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, completed: quests }));
    }

    if (profRes.data) {
      const xp = profRes.data.total_xp || 0;
      setTotalXp(xp);
      localStorage.setItem(XP_STORAGE_KEY, String(xp));
    }

    if (cqRes.data) setCustomQuests(cqRes.data as CustomQuestRow[]);
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    loadFromBackend();

    // Realtime : mise à jour XP depuis n'importe quelle source
    const ch = supabase
      .channel(`quest-engine-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "profiles",
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new?.total_xp !== undefined) {
          setTotalXp(payload.new.total_xp);
          localStorage.setItem(XP_STORAGE_KEY, String(payload.new.total_xp));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, loadFromBackend]);

  // ─── Toutes les quêtes disponibles ──────────────────────
  const allPillars = getPillarsForRole(role);
  const allQuests: Quest[] = [
    ...allPillars.flatMap((p) => p.quests),
    ...customQuests.map((cq) => ({ id: cq.id, label: cq.title, xp: cq.xp })),
  ];

  // ─── Calculer la progression des piliers ───────────────
  const computePillarProgress = useCallback((c: QuestState): PillarProgress => {
    const result: PillarProgress = {};
    allPillars.forEach((p) => {
      const required = p.quests.filter((q) => !q.optional);
      if (required.length === 0) { result[p.id] = 0; return; }
      const done = required.filter((q) => c[q.id]).length;
      result[p.id] = Math.round((done / required.length) * 100);
    });
    return result;
  }, [allPillars]);

  useEffect(() => {
    setPillarProgress(computePillarProgress(completed));
  }, [completed, computePillarProgress]);

  // ─── Toggle quête ────────────────────────────────────────
  const toggleQuest = useCallback(async (questId: string) => {
    if (!user || pending.current.has(questId)) return;

    const quest   = allQuests.find((q) => q.id === questId);
    if (!quest) return;

    pending.current.add(questId);

    const wasDone = completed[questId] ?? false;
    const nowDone = !wasDone;

    // Optimistic UI
    const nextCompleted = { ...completed, [questId]: nowDone };
    if (!nowDone) delete nextCompleted[questId];
    setCompleted(nextCompleted);

    try {
      // ── 1. RPC atomique XP ──────────────────────────────
      if (nowDone) {
        const { data: res, error: xpErr } = await supabase.rpc("add_xp", {
          p_user_id: user.id,
          p_amount:  quest.xp,
          p_source:  `task_${questId}`,
        });
        if (xpErr) throw xpErr;

        const row = Array.isArray(res) ? res[0] : res;
        if (row) {
          setTotalXp(row.new_xp);
          localStorage.setItem(XP_STORAGE_KEY, String(row.new_xp));

          // Confetti UNIQUEMENT sur level-up réel
          if (row.leveled_up) {
            setConfetti(true);
            toast.success(`👑 Level ${row.new_level} débloqué !`, { duration: 4000 });
            setTimeout(() => setConfetti(false), 4500);
          }
        }
      } else {
        const { data: newXp, error: xpErr } = await supabase.rpc("remove_xp", {
          p_user_id: user.id,
          p_amount:  quest.xp,
          p_source:  `task_unchecked_${questId}`,
        });
        if (xpErr) throw xpErr;
        if (newXp !== null && newXp !== undefined) {
          setTotalXp(newXp);
          localStorage.setItem(XP_STORAGE_KEY, String(newXp));
        }
      }

      // ── 2. daily_progress UPSERT ─────────────────────────
      const newDaily = nowDone
        ? dailyXp + quest.xp
        : Math.max(0, dailyXp - quest.xp);

      await supabase.from("daily_progress").upsert(
        {
          user_id:          user.id,
          date:             today,
          daily_xp:         newDaily,
          completed_quests: nextCompleted,
        },
        { onConflict: "user_id,date" }
      );
      setDailyXp(newDaily);

      // ── 3. Confetti Baraka au franchissement du seuil ────
      const barakaTarget = role === "guardian" ? 300 : 150;
      if (nowDone && newDaily >= barakaTarget && dailyXp < barakaTarget) {
        setConfetti(true);
        toast.success("✨ Objectif Baraka atteint ! +50 XP bonus !", { duration: 4000 });

        const { data: bonusRes } = await supabase.rpc("add_xp", {
          p_user_id: user.id,
          p_amount:  50,
          p_source:  "baraka_bonus",
        });
        const bonusRow = Array.isArray(bonusRes) ? bonusRes[0] : bonusRes;
        if (bonusRow) {
          setTotalXp(bonusRow.new_xp);
          localStorage.setItem(XP_STORAGE_KEY, String(bonusRow.new_xp));
        }
        setTimeout(() => setConfetti(false), 4500);
      }

      // ── 4. Activity feed ─────────────────────────────────
      await supabase.from("activity_feed").insert({
        user_id:   user.id,
        action:    nowDone
          ? `a terminé "${quest.label}" +${quest.xp} XP`
          : `a décoché "${quest.label}" -${quest.xp} XP`,
        xp_earned: nowDone ? quest.xp : -quest.xp,
      });

      // ── 5. Persister localStorage ─────────────────────────
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, completed: nextCompleted }));

    } catch (err) {
      // Rollback optimistic
      setCompleted(completed);
      console.error("[QuestEngine] toggleQuest error:", err);
      toast.error("Erreur de synchronisation — réessaie.");
    } finally {
      pending.current.delete(questId);
    }
  }, [user, completed, dailyXp, allQuests, role, today]);

  // ─── Pénalité manuelle ──────────────────────────────────
  const applyPenalty = useCallback(async (amount: number, reason = "manual_penalty") => {
    if (!user) return;
    const { data: newXp } = await supabase.rpc("remove_xp", {
      p_user_id: user.id,
      p_amount:  amount,
      p_source:  reason,
    });
    if (newXp !== null && newXp !== undefined) {
      setTotalXp(newXp);
      localStorage.setItem(XP_STORAGE_KEY, String(newXp));
    }
    await supabase.from("activity_feed").insert({
      user_id:   user.id,
      action:    `⚠️ Pénalité : ${reason} (-${amount} XP)`,
      xp_earned: -amount,
    });
  }, [user]);

  // ─── Custom quests ───────────────────────────────────────
  const addCustomQuest = useCallback(async (pillarId: string, label: string, xp: number) => {
    if (!user || !label.trim()) return;
    const { data } = await supabase.from("custom_quests")
      .insert({ user_id: user.id, title: label.trim(), category: pillarId, xp })
      .select().single();
    if (data) setCustomQuests((prev) => [...prev, data as CustomQuestRow]);
  }, [user]);

  const deleteCustomQuest = useCallback(async (questId: string) => {
    if (!user) return;
    await supabase.from("custom_quests").delete().eq("id", questId).eq("user_id", user.id);
    setCustomQuests((prev) => prev.filter((q) => q.id !== questId));
    setCompleted((prev) => {
      const next = { ...prev };
      delete next[questId];
      return next;
    });
  }, [user]);

  const getCustomQuestsForPillar = useCallback((pillarId: string): Quest[] =>
    customQuests
      .filter((q) => q.category === pillarId)
      .map((q) => ({ id: q.id, label: q.title, xp: q.xp })),
    [customQuests]
  );

  return {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress,
    applyPenalty,
    confetti,
    addCustomQuest,
    deleteCustomQuest,
    getCustomQuestsForPillar,
  };
}
