import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { toast } from "sonner";
import { SURAHS } from "@/lib/surahData";

const PRESETS = [
  { label: "25 min", seconds: 25 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
  { label: "90 min", seconds: 90 * 60 },
];

const RECITERS = [
  { id: "ar.alafasy", name: "Mishary Rashid Alafasy" },
  { id: "ar.husary", name: "Mahmoud Khalil Al-Hussary" },
];

export default function DeepWorkContent() {
  const [duration, setDuration] = useState(PRESETS[1].seconds);
  const [remaining, setRemaining] = useState(PRESETS[1].seconds);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [quranEnabled, setQuranEnabled] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState(SURAHS[0]);
  const [selectedReciter, setSelectedReciter] = useState(RECITERS[0]);
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");

  const { play, stop, isPlaying, isLoading } = useAudioEngine();

  const progress = 1 - remaining / duration;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const filteredSurahs = surahSearch
    ? SURAHS.filter(s => s.name.toLowerCase().includes(surahSearch.toLowerCase()) || s.arabicName.includes(surahSearch) || String(s.number).includes(surahSearch))
    : SURAHS;

  useEffect(() => {
    if (!running) return;
    const handleVisibility = () => {
      if (document.hidden) toast.warning("L'Alliance a besoin de ta concentration ! 🔥", { duration: 5000 });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [running]);

  useEffect(() => {
    if (running && !paused) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            stop();
            toast.success("Session terminée ! Baraka Points gagnés ✨");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, paused, stop]);

  const playQuran = useCallback(() => {
    const url = `https://cdn.islamic.network/quran/audio-surah/128/${selectedReciter.id}/${selectedSurah.number}.mp3`;
    play(url, true);
  }, [selectedSurah, selectedReciter, play]);

  const start = useCallback(() => {
    setRemaining(duration);
    setRunning(true);
    setPaused(false);
    if (quranEnabled) playQuran();
  }, [duration, quranEnabled, playQuran]);

  const reset = () => {
    setRunning(false);
    setPaused(false);
    setRemaining(duration);
    stop();
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const circumference = 2 * Math.PI * 90;

  return (
    <div className="space-y-6">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex justify-center">
        <div className="relative w-56 h-56">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
            <motion.circle cx="100" cy="100" r="90" fill="none" stroke="url(#timerGrad)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} transition={{ duration: 0.5 }} />
            <defs>
              <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-display font-bold text-foreground tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            {running && <span className="text-xs text-primary mt-1">{isPlaying ? "📖 Récitation" : "En cours..."}</span>}
          </div>
        </div>
      </motion.div>

      {!running && (
        <div className="flex gap-2 justify-center">
          {PRESETS.map(p => (
            <motion.button key={p.seconds} whileTap={{ scale: 0.95 }}
              onClick={() => { setDuration(p.seconds); setRemaining(p.seconds); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${duration === p.seconds ? "bg-primary/20 border border-primary text-primary" : "bg-secondary/50 border border-border text-muted-foreground"}`}>
              {p.label}
            </motion.button>
          ))}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📖</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Récitation du Coran</p>
              <p className="text-[10px] text-muted-foreground">{selectedReciter.name}</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setQuranEnabled(!quranEnabled)}
            className={`w-12 h-6 rounded-full transition-all relative ${quranEnabled ? "bg-primary" : "bg-secondary"}`}>
            <motion.div className="w-5 h-5 bg-foreground rounded-full absolute top-0.5"
              animate={{ left: quranEnabled ? 26 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
          </motion.button>
        </div>

        <AnimatePresence>
          {quranEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
              {/* Reciter selector */}
              <div className="flex gap-2">
                {RECITERS.map(r => (
                  <button key={r.id} onClick={() => setSelectedReciter(r)}
                    className={`flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all ${selectedReciter.id === r.id ? "bg-primary/20 border border-primary text-primary" : "bg-secondary/50 border border-border text-muted-foreground"}`}>
                    {r.name.split(" ").pop()}
                  </button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowSurahPicker(!showSurahPicker)}
                className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-6">{selectedSurah.number}</span>
                  <span className="text-sm text-foreground">{selectedSurah.name}</span>
                  <span className="text-sm text-muted-foreground">{selectedSurah.arabicName}</span>
                </div>
                <span className="text-xs text-muted-foreground">{showSurahPicker ? "▲" : "▼"}</span>
              </motion.button>

              <AnimatePresence>
                {showSurahPicker && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                    <input type="text" value={surahSearch} onChange={e => setSurahSearch(e.target.value)} placeholder="Rechercher..."
                      className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg">
                      {filteredSurahs.map(s => (
                        <button key={s.number} onClick={() => {
                          setSelectedSurah(s); setShowSurahPicker(false); setSurahSearch("");
                          if (isPlaying) { stop(); setTimeout(() => playQuran(), 200); }
                        }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${selectedSurah.number === s.number ? "bg-primary/20 border border-primary/30" : "hover:bg-secondary/80"}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-6">{s.number}</span>
                            <span className="text-foreground">{s.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{s.arabicName}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {running && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => isPlaying ? stop() : playQuran()} disabled={isLoading}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${isPlaying ? "bg-accent/20 border border-accent text-accent" : "bg-primary/20 border border-primary text-primary"}`}>
                  {isLoading ? "Chargement..." : isPlaying ? "⏹ Arrêter" : "▶ Lancer la récitation"}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="flex gap-3 justify-center">
        {!running ? (
          <motion.button whileTap={{ scale: 0.95 }} onClick={start}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm">
            Commencer le Deep Work
          </motion.button>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPaused(!paused)}
              className="px-6 py-3 rounded-xl bg-secondary border border-border text-foreground font-semibold text-sm">
              {paused ? "Reprendre" : "Pause"}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={reset}
              className="px-6 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-sm">
              Arrêter
            </motion.button>
          </>
        )}
      </div>

      <div className="glass rounded-lg p-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">🛡️ <strong className="text-foreground">Focus Guard</strong> activé</p>
        <p className="text-[10px] text-muted-foreground">Alerte si vous quittez l'onglet</p>
      </div>
    </div>
  );
}
