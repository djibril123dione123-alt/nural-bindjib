import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

export function GoldenParticles({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 3,
      delay: Math.random() * 0.3,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 1200);
    return () => clearTimeout(timer);
  }, [trigger]);

  // Haptic feedback
  useEffect(() => {
    if (trigger > 0 && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 0, x: `${p.x}%`, y: `${p.y}%` }}
          animate={{ opacity: 0, scale: 1, y: `${p.y - 30}%` }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
          className="absolute pointer-events-none"
          style={{ width: p.size, height: p.size }}
        >
          <div className="w-full h-full rounded-full bg-accent" style={{ boxShadow: "0 0 6px hsl(var(--gold))" }} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export function useParticles() {
  const [trigger, setTrigger] = useState(0);
  const fire = () => {
    setTrigger(t => t + 1);
    if (navigator.vibrate) navigator.vibrate(30);
  };
  return { trigger, fire };
}
