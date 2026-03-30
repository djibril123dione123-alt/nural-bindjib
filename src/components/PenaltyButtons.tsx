import { motion } from "framer-motion";

interface PenaltyButtonsProps {
  onPenalty: (amount: number) => void;
}

export function PenaltyButtons({ onPenalty }: PenaltyButtonsProps) {
  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <p className="text-xs uppercase tracking-widest text-destructive font-semibold">💀 Pénalités (Honnêteté)</p>
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onPenalty(30)}
          className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive hover:bg-destructive/20 transition-colors"
        >
          Catégorie sautée (-30 XP)
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onPenalty(20)}
          className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive hover:bg-destructive/20 transition-colors"
        >
          J'ai procrastiné (-20 XP)
        </motion.button>
      </div>
    </div>
  );
}
