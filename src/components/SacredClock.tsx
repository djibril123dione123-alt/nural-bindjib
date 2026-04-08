// ============================================================
// SacredClock.tsx — Horloge Sacrée
// Affiche la prochaine prière : 64px Monospace Or pulsant
// S'intègre dans Index.tsx en remplacement du bloc nextPrayer
// ============================================================

import { motion } from "framer-motion";
import { useSanctuaryTime } from "@/hooks/useSanctuaryTime";

export function SacredClock() {
  const { nextPrayer } = useSanctuaryTime();

  if (!nextPrayer) return null;

  const displayTime = nextPrayer.minutesUntil > 60
    ? `${Math.floor(nextPrayer.minutesUntil / 60)}h${String(nextPrayer.minutesUntil % 60).padStart(2, "0")}`
    : `${nextPrayer.minutesUntil} min`;

  const isUrgent = nextPrayer.minutesUntil <= 20;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-2xl p-5 text-center glow-border-gold relative overflow-hidden"
    >
      {/* Fond étoilé subtil */}
      <div className="absolute inset-0 opacity-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-accent"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
          />
        ))}
      </div>

      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 relative z-10">
        Prochaine prière
      </p>

      <motion.span
        className="text-3xl block mb-1 relative z-10"
        animate={{ scale: isUrgent ? [1, 1.1, 1] : 1 }}
        transition={{ duration: 1, repeat: isUrgent ? Infinity : 0 }}
      >
        {nextPrayer.icon}
      </motion.span>

      <p className="text-lg font-display font-bold text-foreground relative z-10">
        {nextPrayer.label}
      </p>

      {/* ⭐ L'horloge sacrée : 64px, monospace, or, pulsation */}
      <motion.p
        animate={{
          textShadow: isUrgent
            ? [
                "0 0 10px rgba(245,158,11,0.6)",
                "0 0 30px rgba(245,158,11,1)",
                "0 0 10px rgba(245,158,11,0.6)",
              ]
            : [
                "0 0 10px rgba(245,158,11,0.3)",
                "0 0 20px rgba(245,158,11,0.7)",
                "0 0 10px rgba(245,158,11,0.3)",
              ],
        }}
        transition={{ repeat: Infinity, duration: isUrgent ? 0.8 : 2 }}
        className="font-mono font-black text-accent tracking-tight relative z-10 select-none"
        style={{
          fontSize: "clamp(48px, 10vw, 64px)",
          fontVariantNumeric: "tabular-nums",
          color: "#F59E0B",
          lineHeight: 1,
        }}
      >
        {displayTime}
      </motion.p>

      <p className="text-xs text-muted-foreground mt-1 relative z-10">à {nextPrayer.time}</p>

      {isUrgent && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 relative z-10"
        >
          <span className="text-[10px] bg-accent/20 border border-accent/40 text-accent px-3 py-1 rounded-full font-bold">
            ⏰ Prépare-toi maintenant
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
