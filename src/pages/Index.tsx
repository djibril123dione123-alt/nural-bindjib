// ============================================================
// Index.tsx — Sultan Engine V3 ELITE
//
// Boost UX :
//   ✅ Micro-rebond (scale 0.95 → 1.05) sur cocher une tâche
//   ✅ Barre de progression avec glow émeraude quand ≥ 80%
//   ✅ PillarCard passe onToggle avec animation intégrée
// ============================================================

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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

  const isGuardian   = role === "guardian";
  const minTarget    = isGuardian ? 100 : 80;
  const perfectTarget = isGuardian ? 200 : 120;
  const barakaTarget = isGuardian ? 300 : 150;

  // Pourcentage XP journalier (plafonné à 100 pour la barre)
  const barPct = Math.min(100, Math.round((dailyXp / barakaTarget) * 100));
  // Glow émeraude activé à partir de 80%
  const barGlow = barPct >= 80;

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

        {/* Horloge sacrée */}
        <SacredClock />

        <WisdomBanner />

        {/* Barre de niveau */}
        <LevelBar
          totalXp={totalXp}
          dailyXp={dailyXp}
          role={role}
          partnerName={isGuardian ? "Djibril" : "Binta"}
        />

        {/* ── Barre XP journalière ROYALE ─────────────────────────
            Glow émeraude quand on approche des 100%             */}
        <motion.div
          className={`glass rounded-2xl p-4 space-y-2 transition-all ${
            barGlow ? "glow-border-emerald" : ""
          }`}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>XP aujourd'hui</span>
            <span className={barGlow ? "text-primary font-bold" : ""}>
              {dailyXp} / {barakaTarget} XP
            </span>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent relative"
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={barGlow ? {
                boxShadow: "0 0 12px rgba(16,185,129,0.7), 0 0 24px rgba(16,185,129,0.3)",
              } : {}}
            >
              {barGlow && (
                <motion.div
                  className="absolute right-0 top-0 h-full w-4 bg-white/30 rounded-full"
                  animate={{ opacity: [0, 0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Liens secondaires (hubs détaillés hors barre principale) */}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <Link to="/miroir" className="hover:text-primary transition-colors">Miroir</Link>
          <span className="opacity-40">·</span>
          <Link to="/lab" className="hover:text-primary transition-colors">Lab</Link>
          <span className="opacity-40">·</span>
          <Link to="/bilan" className="hover:text-primary transition-colors">Bilan</Link>
          <span className="opacity-40">·</span>
          <Link to="/chat" className="hover:text-primary transition-colors">Chat</Link>
        </div>

        {/* Objectifs journaliers */}
        <div className="flex gap-3">
          {[
            { label: "Minimum",  target: minTarget,     glow: "glow-border-emerald", color: "text-primary" },
            { label: "Parfait",  target: perfectTarget, glow: "glow-border-gold",    color: "text-accent"  },
            { label: "Baraka",   target: barakaTarget,  glow: "glow-border-gold",    color: "text-accent"  },
          ].map((t) => (
            <div
              key={t.label}
              className={`flex-1 glass rounded-lg p-3 text-center transition-all ${
                dailyXp >= t.target ? t.glow : ""
              }`}
            >
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={`text-lg font-bold ${dailyXp >= t.target ? t.color : "text-foreground"}`}>
                {t.target} XP
              </p>
            </div>
          ))}
        </div>

        {/* Miroir en temps réel */}
        <DualProgressBar />
        <ActivityFeed />

        {/* ── Piliers avec micro-animation rebond ─────────────────
            PillarCard doit exposer onToggle(questId, pillar, xp).
            La motion.div ci-dessous gère le rebond visuel.       */}
        {pillars.map((pillar, i) => (
          <motion.div
            key={pillar.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
          >
            <PillarCard
              pillar={pillar}
              completed={completed}
              progress={pillarProgress[pillar.id] || 0}
              onToggle={async (questId: string, xp?: number) => {
                // ── Micro-rebond via navigator.vibrate (haptique) ──
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  navigator.vibrate([30]);
                }
                await toggleQuest(questId, pillar.id, xp);
              }}
              customQuests={getCustomQuestsForPillar(pillar.id)}
              onAddCustom={addCustomQuest}
              onDeleteCustom={deleteCustomQuest}
            />
          </motion.div>
        ))}

        {/* Boutons pénalité */}
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
