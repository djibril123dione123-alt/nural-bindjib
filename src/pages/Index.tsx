import { motion } from "framer-motion";
import { getPillarsForRole } from "@/lib/questData";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { useAuth } from "@/hooks/useAuth";
import { useRoleTheme } from "@/hooks/useRoleTheme";
import { useSanctuaryTime } from "@/hooks/useSanctuaryTime";
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
  const { nextPrayer } = useSanctuaryTime();

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
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-3xl font-display font-bold text-gradient-emerald">Nur al-BinDjib</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Sultan Engine V3 — {isGuardian ? "La Gardienne 🛡️" : "Le Guide 🧭"}
          </p>
        </motion.div>

        {/* Sacred Clock — focal point */}
        {nextPrayer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-5 text-center glow-border-gold"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Prochaine prière</p>
            <span className="text-3xl block mb-1">{nextPrayer.icon}</span>
            <p className="text-lg font-display font-bold text-foreground">{nextPrayer.label}</p>
            <motion.p
              animate={{ textShadow: ["0 0 10px rgba(245,158,11,0.4)", "0 0 20px rgba(245,158,11,0.7)", "0 0 10px rgba(245,158,11,0.4)"] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="font-mono font-black text-accent tracking-tight"
              style={{ fontSize: "clamp(48px, 10vw, 64px)", fontVariantNumeric: "tabular-nums" }}
            >
              {nextPrayer.minutesUntil > 60
                ? `${Math.floor(nextPrayer.minutesUntil / 60)}h${String(nextPrayer.minutesUntil % 60).padStart(2, "0")}`
                : `${nextPrayer.minutesUntil} min`}
            </motion.p>
            <p className="text-xs text-muted-foreground">à {nextPrayer.time}</p>
          </motion.div>
        )}

        <WisdomBanner />

        <LevelBar totalXp={totalXp} dailyXp={dailyXp} role={role} partnerName={isGuardian ? "Djibril" : "Binta"} />

        {/* Dual Progress */}
        <DualProgressBar />

        {/* Daily targets */}
        <div className="flex gap-3">
          {[
            { label: "Minimum", target: minTarget, glow: "glow-border-emerald", color: "text-primary" },
            { label: "Parfait", target: perfectTarget, glow: "glow-border-gold", color: "text-accent" },
            { label: "Baraka", target: barakaTarget, glow: "glow-border-gold", color: "text-accent" },
          ].map(t => (
            <div key={t.label} className={`flex-1 glass rounded-lg p-3 text-center ${dailyXp >= t.target ? t.glow : ""}`}>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={`text-lg font-bold ${dailyXp >= t.target ? t.color : "text-foreground"}`}>{t.target} XP</p>
            </div>
          ))}
        </div>

        {/* Activity feed */}
        <ActivityFeed />

        {/* Pillars */}
        {pillars.map((pillar, i) => (
          <motion.div key={pillar.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
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

        <PenaltyButtons onPenalty={applyPenalty} />

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
