import { motion } from "framer-motion";
import { getPillarsForRole } from "@/lib/questData";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { useAuth } from "@/hooks/useAuth";
import { WisdomBanner } from "@/components/WisdomBanner";
import { LevelBar } from "@/components/LevelBar";
import { PillarCard } from "@/components/PillarCard";
import { PenaltyButtons } from "@/components/PenaltyButtons";
import { ConfettiOverlay } from "@/components/ConfettiOverlay";
import { BottomNav } from "@/components/BottomNav";

const Index = () => {
  const { profile } = useAuth();
  const role = (profile?.role as "guide" | "guardian") || "guide";
  const pillars = getPillarsForRole(role);

  const {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress,
    applyPenalty,
    confetti,
  } = useQuestEngine();

  const isGuardian = role === "guardian";
  const minTarget = isGuardian ? 100 : 80;
  const perfectTarget = isGuardian ? 200 : 120;
  const barakaTarget = isGuardian ? 300 : 150;

  return (
    <div className="min-h-screen bg-background pb-20">
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
            Sultan Engine V3 — {isGuardian ? "La Gardienne 🛡️" : "Le Guide 🧭"}
          </p>
        </motion.div>

        {/* Wisdom */}
        <WisdomBanner />

        {/* Level — V3 circular */}
        <LevelBar
          totalXp={totalXp}
          dailyXp={dailyXp}
          role={role}
          partnerName={isGuardian ? "Djibril" : "Binta"}
        />

        {/* Daily targets */}
        <div className="flex gap-3">
          <div className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= minTarget ? "glow-border-emerald" : ""}`}>
            <p className="text-xs text-muted-foreground">Minimum</p>
            <p className={`text-lg font-bold ${dailyXp >= minTarget ? "text-primary" : "text-foreground"}`}>{minTarget} XP</p>
          </div>
          <div className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= perfectTarget ? "glow-border-gold" : ""}`}>
            <p className="text-xs text-muted-foreground">Parfait</p>
            <p className={`text-lg font-bold ${dailyXp >= perfectTarget ? "text-accent" : "text-foreground"}`}>{perfectTarget} XP</p>
          </div>
          <div className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= barakaTarget ? "glow-border-gold" : ""}`}>
            <p className="text-xs text-muted-foreground">Baraka</p>
            <p className={`text-lg font-bold ${dailyXp >= barakaTarget ? "text-accent" : "text-foreground"}`}>{barakaTarget} XP</p>
          </div>
        </div>

        {/* Pillars */}
        {pillars.map((pillar, i) => (
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
      <BottomNav />
    </div>
  );
};

export default Index;
