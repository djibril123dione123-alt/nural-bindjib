import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBaraka } from "@/hooks/useBaraka";
import { useSanctuaryTime } from "@/hooks/useSanctuaryTime";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { TasbihCounter } from "@/components/TasbihCounter";
import { vibrate, vibrateSuccess, vibrateError } from "@/hooks/useHaptics";
import { toast } from "sonner";

const MOTIVATIONS = [
  "« La prière est la clé du Paradis. » — Hadith",
  "« Certes, la prière préserve de la turpitude. » — Coran 29:45",
  "« La première chose dont on sera jugé est la Salat. » — Hadith",
  "« Et cherchez secours dans la patience et la prière. » — Coran 2:45",
  "« La prière en son temps est l'acte le plus aimé d'Allah. » — Hadith",
];

interface SalatEntry {
  id: string;
  prayer_name: string;
  completed: boolean;
  completed_at: string | null;
  on_time: boolean;
  custom_time: string | null;
  date: string;
}

export default function SalatContent() {
  const { user } = useAuth();
  const { getXp, awardXp, applyPenalty } = useBaraka();
  const { prayers, updateTime, nextPrayer, atmosphere } = useSanctuaryTime();
  const { partnerOnline, partnerName, streakCount, recordStreak } = useDuoPresence();
  const [entries, setEntries] = useState<SalatEntry[]>([]);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [mosqueDone, setMosqueDone] = useState<Record<string, boolean>>({});
  const [showTasbih, setShowTasbih] = useState<string | null>(null);
  const [preQuranDone, setPreQuranDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { trigger, fire } = useParticles();
  const today = new Date().toISOString().slice(0, 10);
  const entriesRef = useRef<SalatEntry[]>([]);

  const motivation = useMemo(() => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)], []);

  useEffect(() => { if (user) loadEntries(); }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("salat_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today);
    if (error) { console.error("loadEntries error:", error); return; }
    if (data) {
      const typed = data as SalatEntry[];
      setEntries(typed);
      entriesRef.current = typed;
    }
  };

  const getEntry = useCallback((name: string) => {
    return entriesRef.current.find(e => e.prayer_name === name);
  }, []);

  const togglePrayer = useCallback(async (prayerKey: string) => {
    if (!user) return;
    const prayer = prayers.find(p => p.key === prayerKey);
    if (!prayer) return;

    // Prevent double-click
    if (loading[prayerKey]) return;
    setLoading(prev => ({ ...prev, [prayerKey]: true }));

    try {
      // Temporal lock check
      if (!prayer.isUnlocked && !prayer.isPast) {
        vibrateError();
        toast.error(`Le temps appartient à Allah. Patience, l'heure de ${prayer.label} (${prayer.time}) n'est pas encore venue. 🔒`);
        return;
      }

      const existing = getEntry(prayerKey);
      const now = new Date();
      const [h, m] = prayer.time.split(":").map(Number);
      const prayerTime = new Date();
      prayerTime.setHours(h, m, 0, 0);
      const diffMin = (now.getTime() - prayerTime.getTime()) / 60000;
      const onTime = diffMin >= -10 && diffMin <= 30;
      const isMosque = mosqueDone[prayerKey];

      if (existing?.completed) {
        // UNCHECK: Remove entry, reverse XP
        await supabase.from("salat_tracking").delete().eq("id", existing.id);

        // Calculate XP to remove
        let xpToRemove = getXp(prayerKey);
        if (isMosque) xpToRemove += getXp("mosque") + 5;
        if (preQuranDone[prayerKey]) xpToRemove += getXp("quran_pre");

        await applyPenalty(xpToRemove, `Annulation ${prayer.label}`);

        // Remove related activity entries
        await supabase.from("activity_feed")
          .delete()
          .eq("user_id", user.id)
          .ilike("action", `%${prayer.label}%`);

        toast.info(`${prayer.label} décochée. -${xpToRemove} XP`);
      } else {
        // CHECK: Upsert entry (unique constraint handles dedup)
        const { error } = await supabase.from("salat_tracking").upsert({
          user_id: user.id,
          date: today,
          prayer_name: prayerKey,
          completed: true,
          completed_at: now.toISOString(),
          on_time: onTime,
          custom_time: prayer.time,
        }, { onConflict: "user_id,prayer_name,date" });

        if (error) { console.error("Upsert salat error:", error); toast.error("Erreur de sauvegarde"); return; }

        fire();
        vibrateSuccess();

        let totalXp = getXp(prayerKey);
        if (isMosque) totalXp += getXp("mosque") + 5;
        if (preQuranDone[prayerKey]) totalXp += getXp("quran_pre");

        const source = isMosque
          ? `Salat ${prayer.label} + Mosquée`
          : `Salat ${prayer.label}`;

        await awardXp(totalXp, source);
        await recordStreak(prayerKey);

        if (isMosque) {
          toast.success(`${prayer.label} à la Mosquée ! Tasbih auto-validé. +${totalXp} XP 🕌`);
          await awardXp(10, "Tasbih (Mosquée)");
        } else {
          toast.success(onTime ? `${prayer.label} à l'heure ! +${totalXp} XP ✨` : `${prayer.label} validée +${totalXp} XP`);
          if (!existing?.completed) setShowTasbih(prayerKey);
        }
      }

      await loadEntries();
    } finally {
      setLoading(prev => ({ ...prev, [prayerKey]: false }));
    }
  }, [user, prayers, mosqueDone, preQuranDone, getXp, awardXp, applyPenalty, recordStreak, fire, loading]);

  // Batch validation (return from mosque)
  const batchValidate = useCallback(async () => {
    if (!user) return;
    const missed = prayers.filter(p => p.isPast && !getEntry(p.key)?.completed);
    if (missed.length === 0) {
      toast.info("Aucune prière passée à valider.");
      return;
    }

    let totalBatchXp = 0;
    for (const p of missed) {
      await supabase.from("salat_tracking").upsert({
        user_id: user.id,
        date: today,
        prayer_name: p.key,
        completed: true,
        completed_at: new Date().toISOString(),
        on_time: false,
        custom_time: p.time,
      }, { onConflict: "user_id,prayer_name,date" });
      const xp = getXp(p.key) + getXp("mosque") + 5;
      totalBatchXp += xp;
      await recordStreak(p.key);
    }

    await awardXp(totalBatchXp, `Batch Mosquée (${missed.length} prières)`);
    await awardXp(10, "Tasbih (Mosquée batch)");
    fire();
    vibrateSuccess();
    toast.success(`${missed.length} prières validées ! +${totalBatchXp} XP 🕌`);
    await loadEntries();
  }, [user, prayers, getXp, awardXp, recordStreak, fire]);

  const completedCount = entries.filter(e => e.completed).length;
  const onTimeCount = entries.filter(e => e.completed && e.on_time).length;

  // Pre-prayer Quran: show 15 min before next prayer
  const showPreQuran = nextPrayer && nextPrayer.minutesUntil <= 15 && nextPrayer.minutesUntil > 0;

  // Atmosphere gradient
  const atmosGradient = useMemo(() => {
    switch (atmosphere) {
      case "warm": return "from-amber-900/20 via-orange-900/10 to-transparent";
      case "bright": return "from-sky-900/10 via-transparent to-transparent";
      case "sunset": return "from-indigo-900/20 via-purple-900/10 to-transparent";
      case "deep": return "from-slate-900/30 via-transparent to-transparent";
    }
  }, [atmosphere]);

  return (
    <div className="relative overflow-hidden space-y-5">
      <GoldenParticles trigger={trigger} />

      {/* Atmosphere overlay */}
      <div className={`absolute inset-0 bg-gradient-to-b ${atmosGradient} pointer-events-none rounded-2xl`} />

      {/* Partner presence */}
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${partnerOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
          <span className="text-[10px] text-muted-foreground">
            {partnerName} {partnerOnline ? "en ligne" : "hors-ligne"}
          </span>
        </motion.div>
        {streakCount > 0 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-full px-2 py-0.5">
            <span className="text-[10px]">🔥</span>
            <span className="text-[10px] text-accent font-bold">{streakCount} Duo-Streak</span>
          </motion.div>
        )}
      </div>

      {/* Next prayer focal point */}
      {nextPrayer && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-5 text-center glow-border-gold"
        >
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Prochaine prière</p>
          <span className="text-3xl block mb-1">{nextPrayer.icon}</span>
          <p className="text-lg font-display font-bold text-foreground">{nextPrayer.label}</p>
          <p className="text-4xl font-mono font-black text-accent tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
            {nextPrayer.minutesUntil > 60
              ? `${Math.floor(nextPrayer.minutesUntil / 60)}h${String(nextPrayer.minutesUntil % 60).padStart(2, "0")}`
              : `${nextPrayer.minutesUntil} min`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">à {nextPrayer.time}</p>
        </motion.div>
      )}

      {/* Motivation */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-4 text-center border border-accent/20">
        <p className="text-xs text-accent italic">{motivation}</p>
      </motion.div>

      {/* Pre-prayer Quran button */}
      {showPreQuran && nextPrayer && !preQuranDone[nextPrayer.key] && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setPreQuranDone(p => ({ ...p, [nextPrayer.key]: true }));
            vibrate(30);
            awardXp(getXp("quran_pre"), `Lecture Coran avant ${nextPrayer.label}`);
            toast.success(`📖 Lecture Coran avant ${nextPrayer.label} ! +15 XP`);
          }}
          className="w-full py-3 rounded-2xl bg-accent/20 border border-accent/50 text-accent font-semibold text-sm glow-gold flex items-center justify-center gap-2"
        >
          📖 Lecture Coran avant {nextPrayer.label} (+15 XP)
        </motion.button>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4 text-center">
          <CircularProgress value={completedCount} max={6} size={60} strokeWidth={4}>
            <span className="text-sm font-bold text-primary">{completedCount}</span>
          </CircularProgress>
          <p className="text-[10px] text-muted-foreground mt-1">Faites</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <CircularProgress value={onTimeCount} max={6} size={60} strokeWidth={4} glowColor="var(--glow-gold)">
            <span className="text-sm font-bold text-accent">{onTimeCount}</span>
          </CircularProgress>
          <p className="text-[10px] text-muted-foreground mt-1">À l'heure</p>
        </div>
      </div>

      {/* Batch validate */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={batchValidate}
        className="w-full py-2.5 rounded-xl glass border border-accent/20 text-xs text-accent font-semibold flex items-center justify-center gap-2">
        🕌 Tout valider (Retour Mosquée)
      </motion.button>

      {/* Tasbih counter modal */}
      <AnimatePresence>
        {showTasbih && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TasbihCounter onComplete={() => setTimeout(() => setShowTasbih(null), 2000)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prayer cards */}
      {prayers.map((prayer, i) => {
        const entry = entries.find(e => e.prayer_name === prayer.key);
        const done = entry?.completed || false;
        const onTime = entry?.on_time || false;
        const isLocked = !prayer.isUnlocked && !prayer.isPast;
        const isMosque = mosqueDone[prayer.key];
        const isLoading = loading[prayer.key];

        return (
          <motion.div
            key={prayer.key}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i }}
            whileHover={{ scale: 1.01 }}
            className={`glass rounded-2xl overflow-hidden transition-all ${
              isLocked ? "opacity-40" : ""
            } ${done && onTime ? "glow-border-gold" : done ? "glow-border-emerald" : ""}`}
          >
            <div className="p-4 flex items-center gap-4">
              {/* Prayer icon */}
              <motion.div
                animate={done ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.5 }}
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  done ? "bg-gradient-to-br from-primary/30 to-accent/20" : "bg-secondary/30"
                }`}
                style={done ? { boxShadow: "0 0 20px rgba(212, 175, 55, 0.3)" } : {}}
              >
                {isLocked ? <span className="text-lg">🔒</span> : <span className="text-2xl">{prayer.icon}</span>}
                <span className="text-[8px] font-mono font-bold text-accent mt-0.5" style={{ fontSize: "clamp(8px, 2.5vw, 11px)" }}>
                  {prayer.time}
                </span>
              </motion.div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-foreground">{prayer.label}</h3>
                  <span className="text-[9px] text-muted-foreground">({prayer.wolof})</span>
                  {done && onTime && (
                    <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-bold">À L'HEURE</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  {editingTime === prayer.key ? (
                    <input
                      type="time"
                      defaultValue={prayer.time}
                      onBlur={(e) => { updateTime(prayer.key, e.target.value); setEditingTime(null); }}
                      autoFocus
                      className="bg-secondary/50 border border-border rounded px-2 py-0.5 text-xs text-foreground"
                    />
                  ) : (
                    <button onClick={() => setEditingTime(prayer.key)}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                      ⏰ Modifier l'heure
                    </button>
                  )}
                  <span className="text-[10px] text-primary font-semibold">+{getXp(prayer.key)} XP</span>
                </div>

                {/* Mosque toggle */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setMosqueDone(m => ({ ...m, [prayer.key]: !m[prayer.key] })); vibrate(10); }}
                    className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${
                      isMosque ? "bg-accent/20 border-accent text-accent" : "border-border/50 text-muted-foreground"
                    }`}
                  >
                    {isMosque ? "✓" : "○"} Mosquée (+{getXp("mosque") + 5})
                  </button>
                </div>
              </div>

              {/* Validate button */}
              <motion.button
                whileTap={{ scale: isLocked ? 1 : 0.85 }}
                onClick={() => togglePrayer(prayer.key)}
                disabled={isLocked || isLoading}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold transition-all ${
                  isLoading
                    ? "bg-secondary/30 border-2 border-border/30 animate-pulse"
                    : done
                    ? "bg-primary text-primary-foreground"
                    : isLocked
                    ? "bg-secondary/20 border-2 border-border/30 text-muted-foreground/30 cursor-not-allowed"
                    : "bg-secondary/50 border-2 border-border text-muted-foreground"
                }`}
                style={done ? { boxShadow: "0 0 16px rgba(16, 185, 129, 0.5)" } : {}}
              >
                {isLoading ? "⏳" : done ? "✓" : isLocked ? "🔒" : "○"}
              </motion.button>
            </div>

            {done && entry?.completed_at && (
              <div className="px-4 pb-3">
                <p className="text-[10px] text-muted-foreground">
                  Validée à {new Date(entry.completed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {isMosque && " 🕌"}
                </p>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
