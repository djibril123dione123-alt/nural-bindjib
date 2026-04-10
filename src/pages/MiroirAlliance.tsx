// =============================================================================
// src/pages/MiroirAlliance.tsx
// Sprint 1 — Pilier 1.3 : Composant UI pur
//
// Toute la logique data vit dans useMiroir.ts.
// Ce composant ne fait que : prendre les données → les afficher → déclencher
// des actions. Aucun supabase.from() ici.
// =============================================================================

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useMiroir, type MiroirProfile, type DailyPillarState } from "@/hooks/useMiroir";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { calculateLevel, getRank } from "@/lib/questData";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { SkeletonScreen } from "@/components/SkeletonScreen";
import { useAuth } from "@/hooks/useAuth";

// ─── Sous-composants UI ───────────────────────────────────────────────────────

// Overlay Level Up fullscreen
function LevelUpOverlay({ level, onClose }: { level: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 cursor-pointer"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="text-center space-y-4 px-6"
      >
        <div className="text-8xl">👑</div>
        <h1 className="text-4xl font-bold" style={{ color: "#F59E0B" }}>
          LEVEL UP !
        </h1>
        <p className="text-2xl font-bold text-emerald-400">Niveau {level}</p>
        <p className="text-sm text-white/70">Elite Mindset activé ✨</p>
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ y: [-20, 0, -20], opacity: [0, 1, 0] }}
              transition={{ duration: 1.2, delay: i * 0.1, repeat: Infinity }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Barre verticale de progression XP journalier
function VerticalBar({
  profile,
  xp,
  target,
  color,
  isSelf,
}: {
  profile: MiroirProfile;
  xp: number;
  target: number;
  color: "blue" | "pink";
  isSelf?: boolean;
}) {
  const pct   = Math.min(100, (xp / target) * 100);
  const level = profile.level || calculateLevel(profile.total_xp || 0);
  const rank  = getRank(level);

  const barBg       = color === "blue" ? "from-blue-600 to-blue-400" : "from-pink-600 to-pink-400";
  const borderColor = color === "blue" ? "border-blue-500/30" : "border-pink-500/30";
  const glowShadow  = color === "blue"
    ? "0 0 20px rgba(59,130,246,0.4)"
    : "0 0 20px rgba(244,114,182,0.4)";

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <span className="text-xl">{profile.avatar_emoji}</span>
      <p className="text-xs font-display font-bold text-foreground">{profile.display_name}</p>
      <p className="text-[9px] text-accent">{rank.emoji} Lvl {level}</p>

      <div
        className={`relative w-12 rounded-full border ${borderColor} overflow-hidden bg-secondary/30`}
        style={{ height: 160, boxShadow: pct > 50 ? glowShadow : undefined }}
      >
        <motion.div
          className={`absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t ${barBg}`}
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-lg">{Math.round(pct)}%</span>
        </div>
      </div>

      <p className="text-sm font-bold text-primary">{xp}</p>
      <p className="text-[8px] text-muted-foreground">XP aujourd'hui</p>
      {isSelf && (
        <span className="text-[8px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          Vous
        </span>
      )}
    </div>
  );
}

// Indicateurs piliers pour un profil
const PILLARS_DEF = [
  { key: "body" as const,  icon: "⚔️", label: "Corps"  },
  { key: "mind" as const,  icon: "📚", label: "Esprit" },
  { key: "faith" as const, icon: "🕌", label: "Foi"    },
  { key: "life" as const,  icon: "🏠", label: "Vie"    },
];

function PillarIndicators({ state }: { state: DailyPillarState }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {PILLARS_DEF.map(pillar => {
        const done = state.pillars[pillar.key];
        return (
          <div key={pillar.key} className="flex flex-col items-center gap-0.5">
            <motion.span
              animate={done ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.4 }}
              className={`text-lg transition-all ${
                done
                  ? "opacity-100 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                  : "opacity-25 grayscale"
              }`}
            >
              {pillar.icon}
            </motion.span>
            <span className={`text-[7px] ${done ? "text-emerald-400" : "text-muted-foreground/50"}`}>
              {pillar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Feed d'activité réutilisable (remplace ActivityFeed.tsx en doublon)
function ActivityFeedList({
  items,
  me,
  partner,
  currentUserId,
}: {
  items: ReturnType<typeof useMiroir>["activity"];
  me: MiroirProfile | undefined;
  partner: MiroirProfile | undefined;
  currentUserId: string | undefined;
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}j`;
  };

  if (items.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-4 space-y-3 border border-accent/10">
      <h3 className="text-xs font-display font-bold uppercase tracking-wider text-accent">
        🪞 Activité du jour
      </h3>
      <AnimatePresence mode="popLayout">
        {items.map(item => {
          // Utiliser actor_id si disponible, sinon user_id (compat legacy)
          const ownerId = item.actor_id ?? item.user_id;
          const isMe  = ownerId === currentUserId;
          const prof  = isMe ? me : partner;
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 text-xs"
            >
              <span>{prof?.role === "guide" ? "🧭" : "🛡️"}</span>
              <span className="flex-1 text-foreground/80 truncate">
                <strong>{prof?.display_name ?? "..."}</strong> {item.action}
              </span>
              {item.xp_earned > 0 && (
                <span className="text-accent text-[10px]">+{item.xp_earned}</span>
              )}
              <span className="text-muted-foreground text-[9px]">
                {timeAgo(item.created_at)}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function MiroirAlliance() {
  const { user } = useAuth();
  const { partnerOnline, partnerStatus, streakCount } = useDuoPresence();

  const {
    me,
    partner,
    dailyState,
    activity,
    loading,
    bothComplete,
    levelUpLevel,
    dailyTarget,
    sendEncouragement,
    dismissLevelUp,
  } = useMiroir();

  if (loading) return <SkeletonScreen />;

  const myState      = dailyState.find(d => d.userId === me?.id);
  const partnerState = dailyState.find(d => d.userId === partner?.id);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Level Up Overlay */}
      <AnimatePresence>
        {levelUpLevel !== null && (
          <LevelUpOverlay level={levelUpLevel} onClose={dismissLevelUp} />
        )}
      </AnimatePresence>

      <BackButton />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pt-16">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">
            🪞 Miroir de l'Alliance
          </h1>
          <p className="text-xs text-muted-foreground">
            Ascension synchronisée en temps réel
          </p>
          {streakCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-full px-3 py-1 mt-2"
            >
              <span className="text-sm">🔥</span>
              <span className="text-xs text-accent font-bold">
                {streakCount} Duo-Streaks
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Barres verticales VS */}
        {me && partner && myState && partnerState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-6 glow-border-gold"
          >
            <div className="flex items-end justify-center gap-8" style={{ height: 280 }}>
              <VerticalBar
                profile={me}
                xp={myState.xp}
                target={dailyTarget}
                color="blue"
                isSelf
              />
              <div className="flex flex-col items-center gap-2 pb-4">
                <span className="text-2xl">⚡</span>
                <span className="text-[10px] text-accent font-bold uppercase tracking-wider">
                  VS
                </span>
              </div>
              <VerticalBar
                profile={partner}
                xp={partnerState.xp}
                target={dailyTarget}
                color="pink"
              />
            </div>

            {/* Indicateurs piliers */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <PillarIndicators state={myState} />
              <PillarIndicators state={partnerState} />
            </div>
          </motion.div>
        )}

        {/* Bouton encouragement */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={sendEncouragement}
          className="w-full py-3 rounded-xl glass border border-accent/30 text-accent text-sm font-bold hover:bg-accent/5 transition-all"
        >
          💌 Envoyer un encouragement instantané
        </motion.button>

        {/* Bonus Synergie */}
        <motion.div
          className={`glass rounded-2xl p-4 text-center space-y-2 border transition-all ${
            bothComplete ? "border-accent glow-border-gold" : "border-accent/20"
          }`}
          animate={bothComplete ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: bothComplete ? Infinity : 0, duration: 2 }}
        >
          <p className="text-sm font-display font-semibold text-accent">🏆 Bonus Synergie</p>
          {bothComplete ? (
            <p className="text-xs text-accent font-bold">
              ✨ Les deux ont atteint 100% ! +100 XP !
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Si les deux atteignent 5/5 prières,{" "}
              <span className="text-accent font-bold">+100 XP Synergie</span>
            </p>
          )}
        </motion.div>

        {/* Présence partenaire */}
        {partner && (
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                partnerOnline
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-muted-foreground/30"
              }`}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {partner.display_name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {partnerOnline
                  ? `En ligne • ${
                      partnerStatus === "etudie"  ? "📚 Étudie"
                      : partnerStatus === "endormi" ? "🌙 Dort"
                      : partnerStatus === "occupe"  ? "🔴 Occupé"
                      : "🟢 Libre"
                    }`
                  : "Hors-ligne"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{partner.total_xp}</p>
              <p className="text-[9px] text-muted-foreground">XP Total</p>
            </div>
          </div>
        )}

        {/* Activity Feed — composant UI pur réutilisable */}
        <ActivityFeedList
          items={activity}
          me={me}
          partner={partner}
          currentUserId={user?.id}
        />

      </div>
      <BottomNav />
    </div>
  );
}
