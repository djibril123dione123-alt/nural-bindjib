import { motion } from "framer-motion";
import type { Pillar } from "@/lib/questData";

interface PillarCardProps {
  pillar: Pillar;
  completed: Record<string, boolean>;
  progress: number;
  onToggle: (id: string) => void;
}

export function PillarCard({ pillar, completed, progress, onToggle }: PillarCardProps) {
  const glowClass = pillar.color === "gold" ? "glow-border-gold" : "glow-border-emerald";
  const accentClass = pillar.color === "gold" ? "text-accent" : "text-primary";
  const barBg = pillar.color === "gold"
    ? "bg-gradient-to-r from-accent/80 to-accent"
    : "bg-gradient-to-r from-primary/80 to-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass rounded-xl p-5 space-y-4 ${progress === 100 ? glowClass : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{pillar.icon}</span>
          <h3 className={`font-display text-lg font-semibold tracking-wide ${accentClass}`}>
            {pillar.name}
          </h3>
        </div>
        <span className={`text-sm font-bold ${accentClass}`}>{progress}%</span>
      </div>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barBg}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>

      <div className="space-y-2">
        {pillar.quests.map(quest => (
          <motion.button
            key={quest.id}
            onClick={() => onToggle(quest.id)}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              completed[quest.id]
                ? "bg-primary/10 border border-primary/20"
                : "bg-secondary/50 hover:bg-secondary"
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              completed[quest.id]
                ? "border-primary bg-primary"
                : "border-muted-foreground/40"
            }`}>
              {completed[quest.id] && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-3 h-3 text-primary-foreground"
                  viewBox="0 0 12 12"
                >
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </motion.svg>
              )}
            </div>
            <span className={`text-sm flex-1 ${
              completed[quest.id] ? "line-through text-muted-foreground" : "text-foreground"
            }`}>
              {quest.label}
            </span>
            {quest.optional && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">opt</span>
            )}
            <span className="text-xs text-muted-foreground">+{quest.xp}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
