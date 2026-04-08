import { motion } from "framer-motion";
import { getPillarsForRole } from "@/lib/questData";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { useAuth } from "@/hooks/useAuth";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { SacredClock } from "@/components/SacredClock";
import { WisdomBanner } from "@/components/WisdomBanner";
import { LevelBar } from "@/components/LevelBar";
import { PillarCard } from "@/components/PillarCard";
import { PenaltyButtons } from "@/components/PenaltyButtons";
import { ConfettiOverlay } from "@/components/ConfettiOverlay";
import { BottomNav } from "@/components/BottomNav";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DualProgressBar } from "@/components/DualProgressBar";

const Index = () => {
  const { profile } = useAuth();
  const role = useRoleTheme();
  const pillars = getPillarsForRole(role);

  const {
    completed,
    toggleQuest,
    totalXp,
    dailyXp,
    pillarProgress,
    applyPenalty,
    confetti,
    addCustomQuest,
    deleteCustomQuest,
    getCustomQuestsForPillar,
  } = useQuestEngine();

  const isGuardian = role === "guardian";
  const minTarget = isGuardian ? 100 : 80;
  const perfectTarget = isGuardian ? 200 : 120;
  const barakaTarget = isGuardian ? 300 : 150;

  return (
    <div className="min-h-screen bg-background pb-20">
      {confetti && <ConfettiOverlay />}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* En-tête */}
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

        {/* ⭐ SacredClock — Horloge Sacrée (remplace l'ancien bloc nextPrayer) */}
        <SacredClock />

        <WisdomBanner />

        <LevelBar
          totalXp={totalXp}
          dailyXp={dailyXp}
          role={role}
          partnerName={isGuardian ? "Djibril" : "Binta"}
        />

        {/* Ascension Parallèle */}
        <DualProgressBar />

        {/* Objectifs journaliers */}
        <div className="flex gap-3">
          {[
            { label: "Minimum", target: minTarget, glow: "glow-border-emerald", color: "text-primary" },
            { label: "Parfait", target: perfectTarget, glow: "glow-border-gold", color: "text-accent" },
            { label: "Baraka", target: barakaTarget, glow: "glow-border-gold", color: "text-accent" },
          ].map(t => (
            <div
              key={t.label}
              className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= t.target ? t.glow : ""}`}
            >
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={`text-lg font-bold ${dailyXp >= t.target ? t.color : "text-foreground"}`}>
                {t.target} XP
              </p>
            </div>
          ))}
        </div>

        {/* Miroir de l'Alliance — activité temps réel */}
        <ActivityFeed />

        {/* Piliers */}
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
              customQuests={getCustomQuestsForPillar(pillar.id)}
              onAddCustom={addCustomQuest}
              onDeleteCustom={deleteCustomQuest}
            />
          </motion.div>
        ))}

        {/* Pénalités */}
        <PenaltyButtons onPenalty={applyPenalty} />

        {/* Footer */}
        <div className="text-center py-4 space-y-1">
          <p className="text-xs text-muted-foreground">
            🎯 Remportez la victoire. Même sans motivation.
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            La constance {">"} la motivation
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
