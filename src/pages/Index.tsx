import { motion } from "framer-motion";
import { PILLARS } from "@/lib/questData";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { WisdomBanner } from "@/components/WisdomBanner";
import { LevelBar } from "@/components/LevelBar";
import { PillarCard } from "@/components/PillarCard";
import { PenaltyButtons } from "@/components/PenaltyButtons";
import { ConfettiOverlay } from "@/components/ConfettiOverlay";

const Index = () => {
  const {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress,
    applyPenalty,
    confetti,
  } = useQuestEngine();

  return (
    <div className="min-h-screen bg-background">
      {confetti && <ConfettiOverlay />}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-3xl font-display font-bold text-gradient-emerald">
            Nur al-BinDjib
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Sultan Engine V2 — Système de Quêtes
          </p>
        </motion.div>

        {/* Wisdom */}
        <WisdomBanner />

        {/* Level */}
        <LevelBar totalXp={totalXp} dailyXp={dailyXp} />

        {/* Daily targets */}
        <div className="flex gap-3">
          <div className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= 80 ? "glow-border-emerald" : ""}`}>
            <p className="text-xs text-muted-foreground">Minimum</p>
            <p className={`text-lg font-bold ${dailyXp >= 80 ? "text-primary" : "text-foreground"}`}>80 XP</p>
          </div>
          <div className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= 120 ? "glow-border-gold" : ""}`}>
            <p className="text-xs text-muted-foreground">Parfait</p>
            <p className={`text-lg font-bold ${dailyXp >= 120 ? "text-accent" : "text-foreground"}`}>120 XP</p>
          </div>
        </div>

        {/* Pillars */}
        {PILLARS.map((pillar, i) => (
          <motion.div
            key={pillar.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
          >
            <PillarCard
              pillar={pillar}
              completed={completed}
              progress={pillarProgress[pillar.id] || 0}
              onToggle={toggleQuest}
            />
          </motion.div>
        ))}

        {/* Penalties */}
        <PenaltyButtons onPenalty={applyPenalty} />

        {/* Footer */}
        <div className="text-center py-4 space-y-1">
          <p className="text-xs text-muted-foreground">🎯 Remportez la victoire. Même sans motivation.</p>
          <p className="text-[10px] text-muted-foreground/50">La constance {">"} la motivation</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
