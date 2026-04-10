import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBaraka } from "@/hooks/useBaraka";
import { useSanctuaryTime } from "@/hooks/useSanctuaryTime";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { useParticles } from "@/components/GoldenParticles";
import { vibrate, vibrateSuccess, vibrateError } from "@/hooks/useHaptics";
import { toast } from "sonner";
import { removeTaskActivity, safeWrite } from "@/services/database.service";

export interface SalatEntry {
  id: string;
  prayer_name: string;
  completed: boolean;
  completed_at: string | null;
  on_time: boolean;
  custom_time: string | null;
  date: string;
}

export function useSalat() {
  const { user } = useAuth();
  const { getXp, awardXp, applyPenalty } = useBaraka();
  const { prayers, updateTime, nextPrayer, atmosphere, isLoading: isTimesLoading } = useSanctuaryTime();
  const { partnerOnline, partnerName, streakCount, recordStreak } = useDuoPresence();
  const { trigger, fire } = useParticles();

  const [entries, setEntries] = useState<SalatEntry[]>([]);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [draftTime, setDraftTime] = useState<Record<string, string>>({});
  const [mosqueDone, setMosqueDone] = useState<Record<string, boolean>>({});
  const [showTasbih, setShowTasbih] = useState<string | null>(null);
  const [preQuranDone, setPreQuranDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const entriesRef = useRef<SalatEntry[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const loadEntries = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("salat_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today);
    if (error) {
      console.error("loadEntries error:", error);
      return;
    }
    const typed = (data ?? []) as SalatEntry[];
    setEntries(typed);
    entriesRef.current = typed;
  }, [user, today]);

  useEffect(() => {
    if (user) loadEntries();
  }, [user, loadEntries]);

  const getEntry = useCallback((name: string) => entriesRef.current.find((e) => e.prayer_name === name), []);

  const startEditTime = useCallback((prayerKey: string, currentTime: string) => {
    setDraftTime((prev) => ({ ...prev, [prayerKey]: prev[prayerKey] ?? currentTime }));
    setEditingTime(prayerKey);
  }, []);

  const cancelEditTime = useCallback((prayerKey: string) => {
    setDraftTime((prev) => {
      const next = { ...prev };
      delete next[prayerKey];
      return next;
    });
    setEditingTime(null);
  }, []);

  const saveEditTime = useCallback(async (prayerKey: string) => {
    const next = draftTime[prayerKey];
    if (!next) return;
    await updateTime(prayerKey, next);
    cancelEditTime(prayerKey);
  }, [draftTime, updateTime, cancelEditTime]);

  const togglePrayer = useCallback(async (prayerKey: string) => {
    if (!user) return;
    const prayer = prayers.find((p) => p.key === prayerKey);
    if (!prayer) return;
    if (loading[prayerKey]) return;
    setLoading((prev) => ({ ...prev, [prayerKey]: true }));

    try {
      if (!prayer.isUnlocked && !prayer.isPast) {
        vibrateError();
        toast.error(`Le temps appartient a Allah. Patience, l'heure de ${prayer.label} (${prayer.time}) n'est pas encore venue.`);
        return;
      }

      const existing = getEntry(prayerKey);
      const isMosque = mosqueDone[prayerKey];

      if (existing?.completed) {
        await safeWrite(
          supabase.from("salat_tracking").delete().eq("id", existing.id),
          "salat_tracking.delete",
        );

        let xpToRemove = getXp(prayerKey);
        if (isMosque) xpToRemove += getXp("mosque") + 5;
        if (preQuranDone[prayerKey]) xpToRemove += getXp("quran_pre");

        try {
          await applyPenalty(xpToRemove, `Annulation ${prayer.label}`);
          await removeTaskActivity(user.id, prayer.label, undefined, "task");
        } catch (err) {
          console.warn("Salat rollback side-effects failed:", err);
        }
        toast.info(`${prayer.label} decochee. -${xpToRemove} XP`);
      } else {
        await safeWrite(
          supabase.from("salat_tracking").upsert({
            user_id: user.id,
            date: today,
            prayer_name: prayerKey,
            completed: true,
          }, { onConflict: "user_id,prayer_name,date" }),
          "salat_tracking.upsert",
        );

        fire();
        vibrateSuccess();
        let totalXp = getXp(prayerKey);
        if (isMosque) totalXp += getXp("mosque") + 5;
        if (preQuranDone[prayerKey]) totalXp += getXp("quran_pre");

        const source = isMosque ? `Salat ${prayer.label} + Mosquee` : `Salat ${prayer.label}`;
        try {
          await awardXp(totalXp, source);
          await recordStreak(prayerKey);
        } catch (err) {
          console.warn("XP/streak side-effects failed:", err);
        }

        if (isMosque) {
          toast.success(`${prayer.label} a la Mosquee ! Tasbih auto-valide.`);
          await awardXp(10, "Tasbih (Mosquee)");
        } else {
          toast.success(`${prayer.label} validee +${totalXp} XP`);
          if (!existing?.completed) setShowTasbih(prayerKey);
        }
      }
    } catch (err: any) {
      toast.error("Erreur de sauvegarde", { description: err?.message });
    } finally {
      await loadEntries();
      setLoading((prev) => ({ ...prev, [prayerKey]: false }));
    }
  }, [user, prayers, loading, getEntry, mosqueDone, preQuranDone, getXp, applyPenalty, today, fire, awardXp, recordStreak, loadEntries]);

  const batchValidate = useCallback(async () => {
    if (!user) return;
    const missed = prayers.filter((p) => p.isPast && !getEntry(p.key)?.completed);
    if (missed.length === 0) {
      toast.info("Aucune priere passee a valider.");
      return;
    }

    let totalBatchXp = 0;
    try {
      for (const p of missed) {
        await safeWrite(
          supabase.from("salat_tracking").upsert({
            user_id: user.id,
            date: today,
            prayer_name: p.key,
            completed: true,
          }, { onConflict: "user_id,prayer_name,date" }),
          "salat_tracking.batch_upsert",
        );
        const xp = getXp(p.key) + getXp("mosque") + 5;
        totalBatchXp += xp;
        await recordStreak(p.key);
      }

      await awardXp(totalBatchXp, `Batch Mosquee (${missed.length} prieres)`);
      await awardXp(10, "Tasbih (Mosquee batch)");
      fire();
      vibrateSuccess();
      toast.success(`${missed.length} prieres validees ! +${totalBatchXp} XP`);
      await loadEntries();
    } catch (err: any) {
      toast.error("Erreur batch Salat", { description: err?.message });
    }
  }, [user, prayers, getEntry, today, getXp, recordStreak, awardXp, fire, loadEntries]);

  const setMosqueToggle = useCallback((prayerKey: string) => {
    setMosqueDone((prev) => ({ ...prev, [prayerKey]: !prev[prayerKey] }));
    vibrate(10);
  }, []);

  return {
    trigger,
    entries,
    editingTime,
    draftTime,
    mosqueDone,
    showTasbih,
    preQuranDone,
    loading,
    prayers,
    nextPrayer,
    atmosphere,
    isTimesLoading,
    partnerOnline,
    partnerName,
    streakCount,
    getXp,
    awardXp,
    startEditTime,
    cancelEditTime,
    saveEditTime,
    setDraftTime,
    togglePrayer,
    batchValidate,
    setMosqueToggle,
    setPreQuranDone,
    setShowTasbih,
    completedCount: entries.filter((e) => e.completed).length,
    onTimeCount: entries.filter((e) => e.completed && e.on_time).length,
  };
}
