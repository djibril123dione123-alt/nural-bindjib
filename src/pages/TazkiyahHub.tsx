import { useState } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import SalatContent from "@/components/modules/SalatContent";
import HifzContent from "@/components/modules/HifzContent";
import DuaContent from "@/components/modules/DuaContent";

const TABS = [
  { id: "salat", label: "Salat", icon: "🕌" },
  { id: "hifz", label: "Hifz", icon: "📖" },
  { id: "dua", label: "Dua", icon: "🤲" },
];

export default function TazkiyahHub() {
  const [activeTab, setActiveTab] = useState("salat");

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🕌 Tazkiyah</h1>
          <p className="text-xs text-muted-foreground">L'Élévation Spirituelle</p>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "salat" && <SalatContent />}
          {activeTab === "hifz" && <HifzContent />}
          {activeTab === "dua" && <DuaContent />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
