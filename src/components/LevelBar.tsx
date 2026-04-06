import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { getLevelInfo, getRank, ALLIANCE_REWARDS, getMilestoneMessage, type LevelInfo } from "@/lib/questData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface LevelBarProps {
  totalXp: number;
  dailyXp: number;
  role?: "guide" | "guardian";
  partnerName?: string;
}

export function LevelBar({ totalXp: initialXp, dailyXp, role = "guide", partnerName = "Partenaire" }: LevelBarProps) {
  const { user } = useAuth();
  const [totalXp, setTotalXp] = useState(initialXp);
  const [showMilestone, setShowMilestone] = useState(false);
  const [prevLevel, setPrevLevel] = useState(0);

  // Sync with prop
  useEffect(() => { setTotalXp(initialXp); }, [initialXp]);

  // Realtime profile subscription for level-up
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("level-bar-rt")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newXp = payload.new?.total_xp;
        if (newXp !== undefined) setTotalXp(newXp);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const info = getLevelInfo(totalXp, role);

  // Detect level-up
  useEffect(() => {
    if (prevLevel > 0 && info.level > prevLevel) {
      setShowMilestone(true);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
      setTimeout(() => setShowMilestone(false), 4000);
    }
    setPrevLevel(info.level);
  }, [info.level]);

  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (info.progress / 100) * circumference;
  const rankColor = `hsl(${info.rank.color})`;
  const nextReward = ALLIANCE_REWARDS.find(r => r.level > info.level);

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Milestone popup */}
      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="glass glow-border-gold rounded-lg p-4 text-center space-y-2"
          >
            <p className="text-2xl">🎉</p>
            <p className="font-display text-accent text-lg">Level Up ! Niveau {info.level} 👑</p>
            <p className="text-sm text-muted-foreground">
              {getMilestoneMessage(info.level, partnerName) || `Félicitations ! Continue l'ascension !`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-5">
        {/* Circular Progress */}
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} />
            <motion.circle
              cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={rankColor}
              strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ filter: info.progress >= 80 ? `drop-shadow(0 0 8px ${rankColor})` : undefined }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color: rankColor }}>{info.level}</span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{info.rank.name}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">{info.emoji}</span>
            <div>
              <p className="font-display text-base text-foreground leading-tight">{info.title}</p>
              <p className="text-xs text-muted-foreground">{info.rank.emoji} Rang {info.rank.name}</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">{totalXp}</span>
            <span className="text-xs text-muted-foreground">XP total</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>+{dailyXp} aujourd'hui</span>
            <span>•</span>
            <span>{info.xpForNext - totalXp} XP → Lvl {Math.min(info.level + 1, 150)}</span>
          </div>
        </div>
      </div>

      {/* Rank progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Lvl {info.level} — {info.xpForCurrent} XP</span>
          <span>{info.level >= 150 ? "MAX" : `Lvl ${info.level + 1} — ${info.xpForNext} XP`}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: rankColor }}
            initial={{ width: 0 }}
            animate={{ width: `${info.progress}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Next Alliance Reward */}
      {nextReward && (
        <div className="flex items-center gap-3 glass rounded-lg p-2.5">
          <span className="text-lg">{nextReward.emoji}</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">{nextReward.title}</p>
            <p className="text-[10px] text-muted-foreground">{nextReward.description}</p>
          </div>
          <span className="text-xs font-bold text-accent">Lvl {nextReward.level}</span>
        </div>
      )}
    </div>
  );
}
