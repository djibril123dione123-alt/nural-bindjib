import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

const PRESETS = [
  { label: "25 min", seconds: 25 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
  { label: "90 min", seconds: 90 * 60 },
];

const DeepWork = () => {
  const [duration, setDuration] = useState(PRESETS[1].seconds);
  const [remaining, setRemaining] = useState(PRESETS[1].seconds);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = 1 - remaining / duration;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  // Page visibility detection
  useEffect(() => {
    if (!running) return;

    const handleVisibility = () => {
      if (document.hidden) {
        toast.warning("L'Alliance a besoin de ta concentration ! 🔥", {
          duration: 5000,
        });
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

  const start = useCallback(() => {
    setRemaining(duration);
    setRunning(true);
    setPaused(false);
  }, [duration]);

  const reset = () => {
    setRunning(false);
    setPaused(false);
    setRemaining(duration);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const circumference = 2 * Math.PI * 90;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            🎯 Deep Work
          </h1>
          <p className="text-xs text-muted-foreground">
            Concentration absolue — Audio Halal uniquement
          </p>
        </motion.div>

        {/* Timer Circle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-center"
        >
          <div className="relative w-56 h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100" cy="100" r="90"
                fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth="6"
              />
              <motion.circle
                cx="100" cy="100" r="90"
                fill="none"
                stroke="url(#timerGradient)"
                strokeWidth="6"
                strokeLinecap="round"
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
                <span className="text-xs text-primary mt-1">En cours...</span>
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
                onClick={() => {
                  setDuration(p.seconds);
                  setRemaining(p.seconds);
                }}
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
                onClick={() => setPaused(!paused)}
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
