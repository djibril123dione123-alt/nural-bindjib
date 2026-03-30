import { motion } from "framer-motion";
import { getLevel, getLevelProgress } from "@/lib/questData";

interface LevelBarProps {
  totalXp: number;
  dailyXp: number;
}

export function LevelBar({ totalXp, dailyXp }: LevelBarProps) {
  const level = getLevel(totalXp);
  const progress = getLevelProgress(totalXp);

  return (
    <div className="glass rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{level.emoji}</span>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Niveau {level.level}
            </p>
            <p className="font-display text-lg text-foreground">{level.title}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{totalXp} <span className="text-sm text-muted-foreground">XP</span></p>
          <p className="text-xs text-muted-foreground">Aujourd'hui : +{dailyXp} XP</p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{level.minXp} XP</span>
        <span>{level.maxXp === Infinity ? "∞" : `${level.maxXp} XP`}</span>
      </div>
    </div>
  );
}
