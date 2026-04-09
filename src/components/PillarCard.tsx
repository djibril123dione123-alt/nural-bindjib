import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Pillar, Quest } from "@/lib/questData";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

interface PillarCardProps {
  pillar: Pillar;
  completed: Record<string, boolean>;
  progress: number;
  onToggle: (id: string) => void;
  customQuests?: Quest[];
  onAddCustom?: (category: string, title: string, xp: number) => void;
  onDeleteCustom?: (questId: string) => void;
}

export function PillarCard({ pillar, completed, progress, onToggle, customQuests = [], onAddCustom, onDeleteCustom }: PillarCardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newXp, setNewXp] = useState(10);

  const glowClass = pillar.color === "gold" ? "glow-border-gold" : "glow-border-emerald";
  const accentClass = pillar.color === "gold" ? "text-accent" : "text-primary";
  const barBg = pillar.color === "gold"
    ? "bg-gradient-to-r from-accent/80 to-accent"
    : "bg-gradient-to-r from-primary/80 to-primary";

  const allQuests = [...pillar.quests, ...customQuests];

  const handleAdd = () => {
    if (newTitle.trim() && onAddCustom) {
      onAddCustom(pillar.id, newTitle.trim(), newXp);
      setNewTitle("");
      setNewXp(10);
      setShowAdd(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass rounded-xl p-5 space-y-4 ${progress === 100 ? glowClass : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{pillar.icon}</span>
          <h3 className={`font-display text-lg font-semibold tracking-wide ${accentClass}`}>
            {pillar.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${accentClass}`}>{progress}%</span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAdd(!showAdd)}
            className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div className={`h-full rounded-full ${barBg}`} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6 }} />
      </div>

      {/* Add custom quest */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 items-center overflow-hidden">
            <Input placeholder="Nouvelle tâche..." value={newTitle} onChange={e => setNewTitle(e.target.value)}
              className="flex-1 h-8 text-xs bg-secondary/50 border-border" onKeyDown={e => e.key === "Enter" && handleAdd()} />
            <Input type="number" value={newXp} onChange={e => setNewXp(Number(e.target.value))}
              className="w-16 h-8 text-xs bg-secondary/50 border-border" min={5} max={100} />
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleAdd}
              className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold">OK</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {allQuests.map(quest => {
            const isCustom = customQuests.some(q => q.id === quest.id);
            return (
              <motion.div key={quest.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  completed[quest.id] ? "bg-primary/10 border border-primary/20" : "bg-secondary/50 hover:bg-secondary"
                }`}
              >
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => onToggle(quest.id)} className="flex items-center gap-3 flex-1 text-left">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    completed[quest.id] ? "border-primary bg-primary" : "border-muted-foreground/40"
                  }`}>
                    {completed[quest.id] && (
                      <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                      </motion.svg>
                    )}
                  </div>
                  <span className={`text-sm flex-1 ${completed[quest.id] ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {quest.label}
                  </span>
                </motion.button>
                {quest.optional && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">opt</span>
                )}
                <span className="text-xs text-muted-foreground">+{quest.xp}</span>
                {isCustom && onDeleteCustom && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => onDeleteCustom(quest.id)}
                    className="text-destructive/60 hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
