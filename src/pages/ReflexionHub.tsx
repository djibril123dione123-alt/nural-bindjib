import { useState } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import JournalContent from "@/components/modules/JournalContent";
import StatsContent from "@/components/modules/StatsContent";

const TABS = [
  { id: "journal", label: "Journal", icon: "📝" },
  { id: "stats", label: "Statistiques", icon: "📊" },
];

export default function ReflexionHub() {
  const [activeTab, setActiveTab] = useState("journal");

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">✍️ Réflexion</h1>
          <p className="text-xs text-muted-foreground">Journal & Bilan</p>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "journal" && <JournalContent />}
          {activeTab === "stats" && <StatsContent />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
