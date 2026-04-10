import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBaraka } from "@/hooks/useBaraka";
import { toast } from "sonner";

const PHASES = [
  { label: "سُبْحَانَ اللَّهِ", transliteration: "SubhanAllah", target: 33, color: "primary" },
  { label: "الْحَمْدُ لِلَّهِ", transliteration: "Alhamdulillah", target: 33, color: "accent" },
  { label: "اللَّهُ أَكْبَرُ", transliteration: "Allahu Akbar", target: 34, color: "primary" },
];

interface Props {
  onComplete?: () => void;
}

export function TasbihCounter({ onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const { awardXp } = useBaraka();

  const current = PHASES[phase];
  const totalDone = PHASES.slice(0, phase).reduce((s, p) => s + p.target, 0) + count;
  const totalTarget = 100;

  const handleTap = useCallback(() => {
    if (completed) return;

    if (navigator.vibrate) navigator.vibrate(15);

    const next = count + 1;
    if (next >= current.target) {
      if (phase < PHASES.length - 1) {
        setPhase(p => p + 1);
        setCount(0);
      } else {
        setCount(next);
        setCompleted(true);
        if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
        awardXp(10, "Tasbih post-prière");
        toast.success("Tasbih complété ! +10 XP ✨");
        onComplete?.();
      }
    } else {
      setCount(next);
    }
  }, [count, phase, completed, current, awardXp, onComplete]);

  const validateAll = useCallback(() => {
    if (completed) return;
    setPhase(PHASES.length - 1);
    setCount(PHASES[PHASES.length - 1].target);
    setCompleted(true);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 100]);
    awardXp(10, "Tasbih post-prière");
    toast.success("Tasbih validé d’un coup ! +10 XP ✨");
    onComplete?.();
  }, [completed, awardXp, onComplete]);

  const reset = () => {
    setPhase(0);
    setCount(0);
    setCompleted(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl p-6 space-y-4 glow-border-gold"
    >
      <div className="text-center space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Tasbih Post-Prière</p>
        <p className="text-3xl font-display text-accent" dir="rtl">{current.label}</p>
        <p className="text-xs text-primary italic">{current.transliteration}</p>
      </div>

      <div className="flex justify-center">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleTap}
          disabled={completed}
          className={`w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold transition-all ${
            completed
              ? "bg-accent/20 text-accent glow-gold"
              : "bg-primary/20 text-primary active:bg-primary/30"
          }`}
          style={{ boxShadow: completed ? "0 0 30px rgba(212,175,55,0.5)" : "0 0 20px rgba(16,185,129,0.3)" }}
        >
          {completed ? "✓" : count}
        </motion.button>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            animate={{ width: `${(totalDone / totalTarget) * 100}%` }}
            transition={{ type: "spring", stiffness: 300 }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{totalDone} / {totalTarget}</span>
          <span>Phase {phase + 1}/3</span>
        </div>
      </div>

      {/* Phase indicators */}
      <div className="flex gap-2 justify-center">
        {PHASES.map((p, i) => (
          <div
            key={i}
            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all ${
              i < phase ? "bg-primary/20 text-primary" :
              i === phase && !completed ? "bg-accent/20 text-accent border border-accent/50" :
              completed ? "bg-primary/20 text-primary" :
              "bg-secondary/50 text-muted-foreground"
            }`}
          >
            {p.transliteration} {i < phase || completed ? "✓" : `${i === phase ? count : 0}/${p.target}`}
          </div>
        ))}
      </div>

      {!completed && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.98 }}
          onClick={validateAll}
          className="w-full rounded-xl py-2 text-sm font-semibold bg-accent/15 border border-accent/30 text-accent hover:bg-accent/20 transition"
        >
          Valider tout d’un coup (100)
        </motion.button>
      )}

      {completed && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={reset}
          className="w-full py-2 rounded-xl bg-secondary/50 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          🔄 Recommencer
        </motion.button>
      )}
    </motion.div>
  );
}
