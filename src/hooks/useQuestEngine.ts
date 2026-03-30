import { useState, useCallback, useMemo } from "react";
import { PILLARS } from "@/lib/questData";

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

  const save = useCallback((c: Record<string, boolean>, xp: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayKey(), completed: c }));
    localStorage.setItem(XP_STORAGE_KEY, String(xp));
  }, []);

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

        // Check wake-up bonus
        if (questId === "v1") newXp += 20;
      }

      // Check perfect day
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
      return next;
    });
  }, [totalXp, save]);

  const applyPenalty = useCallback((amount: number) => {
    setTotalXp(prev => {
      const next = Math.max(0, prev - amount);
      localStorage.setItem(XP_STORAGE_KEY, String(next));
      return next;
    });
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

  const pillarProgress = useMemo(() => {
    const result: Record<string, number> = {};
    PILLARS.forEach(p => {
      const required = p.quests.filter(q => !q.optional);
      const done = required.filter(q => completed[q.id]).length;
      result[p.id] = required.length > 0 ? Math.round((done / required.length) * 100) : 0;
    });
    return result;
  }, [completed]);

  const isIncomplete = useMemo(() => {
    return PILLARS.some(p => {
      const required = p.quests.filter(q => !q.optional);
      return required.every(q => !completed[q.id]);
    });
  }, [completed]);

  return {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress,
    isIncomplete,
    applyPenalty,
    confetti,
  };
}
