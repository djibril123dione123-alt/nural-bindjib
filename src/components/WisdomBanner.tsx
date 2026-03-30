import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WISDOM_QUOTES } from "@/lib/questData";

export function WisdomBanner() {
  const [index, setIndex] = useState(() => {
    const hour = new Date().getHours();
    return Math.floor(hour / 6) % WISDOM_QUOTES.length;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % WISDOM_QUOTES.length);
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass rounded-lg px-6 py-4 text-center glow-border-gold">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.6 }}
          className="text-sm italic text-accent font-display"
        >
          {WISDOM_QUOTES[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
