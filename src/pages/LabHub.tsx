import { useState } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import DeepWork from "@/pages/DeepWork";
import AlterEgoLab from "@/pages/AlterEgoLab";

const TABS = [
  { id: "deepwork", label: "Deep Work", icon: "🎯" },
  { id: "missions", label: "Missions", icon: "⚔️" },
];

export default function LabHub() {
  const [activeTab, setActiveTab] = useState("deepwork");

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🧪 Lab</h1>
          <p className="text-xs text-muted-foreground">Performance & Missions</p>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "deepwork" && <DeepWorkEmbed />}
          {activeTab === "missions" && <MissionsEmbed />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}

// Embedded versions without their own BottomNav/header
function DeepWorkEmbed() {
  // Re-use DeepWork content inline (import the page but strip wrapper)
  return <DeepWorkContent />;
}

function MissionsEmbed() {
  return <AlterEgoLabContent />;
}

// We need to create content-only versions — for now, re-render pages
// This is a temporary solution; ideally the content would be extracted
import DeepWorkContent from "@/components/modules/DeepWorkContent";
import AlterEgoLabContent from "@/components/modules/AlterEgoLabContent";
