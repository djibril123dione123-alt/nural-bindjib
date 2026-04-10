import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles } from "@/components/GoldenParticles";
import { TasbihCounter } from "@/components/TasbihCounter";
import { toast } from "sonner";
import { useSalat } from "@/hooks/useSalat";

export default function SalatContent() {
  const {
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
    completedCount,
    onTimeCount,
  } = useSalat();

  const motivation = useMemo(() => {
    const list = [
      "« La priere est la cle du Paradis. » — Hadith",
      "« Certes, la priere preserve de la turpitude. » — Coran 29:45",
      "« La premiere chose dont on sera juge est la Salat. » — Hadith",
      "« Et cherchez secours dans la patience et la priere. » — Coran 2:45",
      "« La priere en son temps est l'acte le plus aime d'Allah. » — Hadith",
    ];
    return list[Math.floor(Math.random() * list.length)];
  }, []);

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
        {isTimesLoading && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-block w-3 h-3 rounded-full border border-primary/30 border-t-primary animate-spin" />
            Chargement des horaires...
          </div>
        )}
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
            setPreQuranDone((p) => ({ ...p, [nextPrayer.key]: true }));
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
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={draftTime[prayer.key] ?? prayer.time}
                        onChange={(e) => setDraftTime((p) => ({ ...p, [prayer.key]: e.target.value }))}
                        className="bg-secondary/50 border border-border rounded px-2 py-0.5 text-xs text-foreground"
                      />
                      <button
                        onClick={() => saveEditTime(prayer.key)}
                        className="text-[10px] px-2 py-0.5 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                      >
                        Enregistrer
                      </button>
                      <button
                        onClick={() => cancelEditTime(prayer.key)}
                        className="text-[10px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditTime(prayer.key, prayer.time)}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      ⏰ Modifier l'heure
                    </button>
                  )}
                  <span className="text-[10px] text-primary font-semibold">+{getXp(prayer.key)} XP</span>
                </div>

                {/* Mosque toggle */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setMosqueToggle(prayer.key)}
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
