import { motion } from "framer-motion";

interface GlassTabsProps {
  tabs: { id: string; label: string; icon: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function GlassTabs({ tabs, active, onChange }: GlassTabsProps) {
  return (
    <div className="glass rounded-xl p-1 flex gap-1">
      {tabs.map(tab => (
        <motion.button
          key={tab.id}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(tab.id)}
          className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
            active === tab.id
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {active === tab.id && (
            <motion.div
              layoutId="glass-tab-bg"
              className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-lg"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{tab.icon}</span>
          <span className="relative z-10">{tab.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
