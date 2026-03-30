import { useState, useCallback, useMemo, useEffect } from "react";
import { PILLARS } from "@/lib/questData";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "nur-albindjib-quests";
const XP_STORAGE_KEY = "nur-albindjib-total-xp";

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadToday(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data.date !== getTodayKey()) return {};
    return data.completed || {};
  } catch { return {}; }
}

function loadTotalXp(): number {
  try {
    return parseInt(localStorage.getItem(XP_STORAGE_KEY) || "0", 10);
  } catch { return 0; }
}

export function useQuestEngine() {
  const [completed, setCompleted] = useState<Record<string, boolean>>(loadToday);
  const [totalXp, setTotalXp] = useState(loadTotalXp);
  const [confetti, setConfetti] = useState(false);

  // Sync to backend
  const syncToBackend = useCallback(async (c: Record<string, boolean>, dxp: number, txp: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = getTodayKey();
    await supabase.from("daily_progress").upsert({
      user_id: user.id,
      date: today,
      completed_quests: c,
      daily_xp: dxp,
      total_xp: txp,
    }, { onConflict: "user_id,date" });
  }, []);

  // Load from backend on mount
  useEffect(() => {
    const loadFromBackend = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = getTodayKey();
      const { data } = await supabase
        .from("daily_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();

      if (data) {
        const quests = (data.completed_quests || {}) as Record<string, boolean>;
        setCompleted(quests);
        setTotalXp(data.total_xp || 0);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, completed: quests }));
        localStorage.setItem(XP_STORAGE_KEY, String(data.total_xp || 0));
      } else {
        // Try to get total XP from previous days
        const { data: prev } = await supabase
          .from("daily_progress")
          .select("total_xp")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(1)
          .single();
        if (prev) {
          setTotalXp(prev.total_xp || 0);
          localStorage.setItem(XP_STORAGE_KEY, String(prev.total_xp || 0));
        }
      }
    };
    loadFromBackend();
  }, []);

  const save = useCallback((c: Record<string, boolean>, xp: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), completed: c }));
    localStorage.setItem(XP_STORAGE_KEY, String(xp));
  }, []);

  const dailyXp = useMemo(() => {
    let xp = 0;
    PILLARS.flatMap(p => p.quests).forEach(q => {
      if (completed[q.id]) xp += q.xp;
    });
    if (completed["v1"]) xp += 20;
    const allRequired = PILLARS.flatMap(p => p.quests).filter(q => !q.optional);
    if (allRequired.every(q => completed[q.id])) xp += 50;
    return xp;
  }, [completed]);

  const toggleQuest = useCallback((questId: string) => {
    setCompleted(prev => {
      const next = { ...prev };
      const quest = PILLARS.flatMap(p => p.quests).find(q => q.id === questId);
      if (!quest) return prev;

      let newXp = totalXp;
      if (next[questId]) {
        delete next[questId];
        newXp -= quest.xp;
      } else {
        next[questId] = true;
        newXp += quest.xp;
        if (questId === "v1") newXp += 20;
      }

      const allRequired = PILLARS.flatMap(p => p.quests).filter(q => !q.optional);
      const allDone = allRequired.every(q => next[q.id]);
      if (allDone && !prev.__perfectBonusGiven) {
        newXp += 50;
        (next as any).__perfectBonusGiven = true;
        setConfetti(true);
        setTimeout(() => setConfetti(false), 3000);
      }

      setTotalXp(newXp);
      save(next, newXp);

      // Compute daily XP for this state
      let dxp = 0;
      PILLARS.flatMap(p => p.quests).forEach(q => {
        if (next[q.id]) dxp += q.xp;
      });
      if (next["v1"]) dxp += 20;
      if (allRequired.every(q => next[q.id])) dxp += 50;

      syncToBackend(next, dxp, newXp);
      return next;
    });
  }, [totalXp, save, syncToBackend]);

  const applyPenalty = useCallback((amount: number) => {
    setTotalXp(prev => {
      const next = Math.max(0, prev - amount);
      localStorage.setItem(XP_STORAGE_KEY, String(next));
      syncToBackend(completed, dailyXp, next);
      return next;
    });
  }, [completed, dailyXp, syncToBackend]);

  const pillarProgress = useMemo(() => {
    const result: Record<string, number> = {};
    PILLARS.forEach(p => {
      const required = p.quests.filter(q => !q.optional);
      const done = required.filter(q => completed[q.id]).length;
      result[p.id] = required.length > 0 ? Math.round((done / required.length) * 100) : 0;
    });
    return result;
  }, [completed]);

  return {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress,
    applyPenalty,
    confetti,
  };
}
