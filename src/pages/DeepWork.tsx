import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";
import { SURAHS } from "@/lib/surahData";

const PRESETS = [
  { label: "25 min", seconds: 25 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
  { label: "90 min", seconds: 90 * 60 },
];

const RECITERS = [
  { id: "ar.alafasy", name: "Mishary Rashid Alafasy", urlFn: (n: number) => `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${n}.mp3` },
  { id: "ar.husary", name: "Mahmoud Khalil Al-Hussary", urlFn: (n: number) => `https://www.everyayah.com/data/Husary_64kbps/${String(n).padStart(3, '0')}001.mp3` },
];

const RECITER_DEFAULT = RECITERS[0];

const DeepWork = () => {
  const [duration, setDuration] = useState(PRESETS[1].seconds);
  const [remaining, setRemaining] = useState(PRESETS[1].seconds);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Quran audio state
  const [quranEnabled, setQuranEnabled] = useState(false);
  const [selectedSurah, setSelectedSurah] = useState(SURAHS[0]);
  const [showSurahPicker, setShowSurahPicker] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const progress = 1 - remaining / duration;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const filteredSurahs = surahSearch
    ? SURAHS.filter(s =>
        s.name.toLowerCase().includes(surahSearch.toLowerCase()) ||
        s.arabicName.includes(surahSearch) ||
        String(s.number).includes(surahSearch)
      )
    : SURAHS;

  // Page visibility detection
  useEffect(() => {
    if (!running) return;
    const handleVisibility = () => {
      if (document.hidden) {
        toast.warning("L'Alliance a besoin de ta concentration ! 🔥", { duration: 5000 });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [running]);

  // Timer
  useEffect(() => {
    if (running && !paused) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            stopAudio();
            toast.success("Session terminée ! Baraka Points gagnés ✨");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, paused]);

  const playQuranAudio = useCallback(async () => {
    try {
      setAudioLoading(true);
      const audioUrl = `https://cdn.islamic.network/quran/audio-surah/128/${RECITER.id}/${selectedSurah.number}.mp3`;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audio.loop = true;
      audioRef.current = audio;

      audio.addEventListener("canplaythrough", () => {
        setAudioLoading(false);
        audio.play();
        setIsPlaying(true);
      });

      audio.addEventListener("error", () => {
        setAudioLoading(false);
        toast.error("Impossible de charger l'audio. Vérifiez votre connexion.");
      });

      audio.load();
    } catch {
      setAudioLoading(false);
      toast.error("Erreur de chargement audio");
    }
  }, [selectedSurah]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const toggleAudio = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      playQuranAudio();
    }
  }, [isPlaying, playQuranAudio, stopAudio]);

  const start = useCallback(() => {
    setRemaining(duration);
    setRunning(true);
    setPaused(false);
    if (quranEnabled) playQuranAudio();
  }, [duration, quranEnabled, playQuranAudio]);

  const reset = () => {
    setRunning(false);
    setPaused(false);
    setRemaining(duration);
    stopAudio();
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const circumference = 2 * Math.PI * 90;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-display font-bold text-foreground">🎯 Deep Work</h1>
          <p className="text-xs text-muted-foreground">Concentration absolue — Audio Halal uniquement</p>
        </motion.div>

        {/* Timer Circle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-center"
        >
          <div className="relative w-56 h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
              <motion.circle
                cx="100" cy="100" r="90" fill="none"
                stroke="url(#timerGradient)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                transition={{ duration: 0.5 }}
              />
              <defs>
                <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-display font-bold text-foreground tabular-nums">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              {running && (
                <span className="text-xs text-primary mt-1">
                  {isPlaying ? "📖 Récitation en cours" : "En cours..."}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Duration presets */}
        {!running && (
          <div className="flex gap-2 justify-center">
            {PRESETS.map(p => (
              <motion.button
                key={p.seconds}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setDuration(p.seconds); setRemaining(p.seconds); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  duration === p.seconds
                    ? "bg-primary/20 border border-primary text-primary"
                    : "bg-secondary/50 border border-border text-muted-foreground"
                }`}
              >
                {p.label}
              </motion.button>
            ))}
          </div>
        )}

        {/* Quran Audio Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📖</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Récitation du Coran</p>
                <p className="text-[10px] text-muted-foreground">{RECITER.name}</p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setQuranEnabled(!quranEnabled)}
              className={`w-12 h-6 rounded-full transition-all relative ${
                quranEnabled ? "bg-primary" : "bg-secondary"
              }`}
            >
              <motion.div
                className="w-5 h-5 bg-foreground rounded-full absolute top-0.5"
                animate={{ left: quranEnabled ? 26 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </div>

          <AnimatePresence>
            {quranEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {/* Selected surah display */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSurahPicker(!showSurahPicker)}
                  className="w-full flex items-center justify-between bg-secondary/50 border border-border rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{selectedSurah.number}</span>
                    <span className="text-sm text-foreground">{selectedSurah.name}</span>
                    <span className="text-sm text-muted-foreground">{selectedSurah.arabicName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{showSurahPicker ? "▲" : "▼"}</span>
                </motion.button>

                {/* Surah picker */}
                <AnimatePresence>
                  {showSurahPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <input
                        type="text"
                        value={surahSearch}
                        onChange={e => setSurahSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg">
                        {filteredSurahs.map(s => (
                          <button
                            key={s.number}
                            onClick={() => {
                              setSelectedSurah(s);
                              setShowSurahPicker(false);
                              setSurahSearch("");
                              if (isPlaying) {
                                stopAudio();
                                setTimeout(() => playQuranAudio(), 200);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedSurah.number === s.number
                                ? "bg-primary/20 border border-primary/30"
                                : "hover:bg-secondary/80"
                            }`}
                          >
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

                {/* Play/Stop button (when timer is running) */}
                {running && (
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleAudio}
                      disabled={audioLoading}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isPlaying
                          ? "bg-accent/20 border border-accent text-accent"
                          : "bg-primary/20 border border-primary text-primary"
                      }`}
                    >
                      {audioLoading ? "Chargement..." : isPlaying ? "⏸ Pause récitation" : "▶ Lancer la récitation"}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Controls */}
        <div className="flex gap-3 justify-center">
          {!running ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={start}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm"
            >
              Commencer le Deep Work
            </motion.button>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setPaused(!paused);
                  if (!paused && isPlaying) audioRef.current?.pause();
                  if (paused && isPlaying) audioRef.current?.play();
                }}
                className="px-6 py-3 rounded-xl bg-secondary border border-border text-foreground font-semibold text-sm"
              >
                {paused ? "Reprendre" : "Pause"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={reset}
                className="px-6 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-semibold text-sm"
              >
                Arrêter
              </motion.button>
            </>
          )}
        </div>

        {/* Focus Guard Info */}
        <div className="glass rounded-lg p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            🛡️ <strong className="text-foreground">Focus Guard</strong> activé
          </p>
          <p className="text-[10px] text-muted-foreground">
            Une alerte s'affiche si vous quittez l'onglet pendant le Deep Work
          </p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default DeepWork;
