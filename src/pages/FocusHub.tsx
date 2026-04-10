import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import DeepWorkContent from "@/components/modules/DeepWorkContent";
import AlterEgoLabContent from "@/components/modules/AlterEgoLabContent";

const TAB_IDS = ["deepwork", "missions"] as const;
type TabId = (typeof TAB_IDS)[number];

const TABS = [
  { id: "deepwork", label: "Deep Work", icon: "🎯" },
  { id: "missions", label: "Alter Ego", icon: "⚔️" },
];

export default function FocusHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initial: TabId = tabParam === "missions" ? "missions" : "deepwork";
  const [activeTab, setActiveTab] = useState<TabId>(initial);

  useEffect(() => {
    if (tabParam === "missions" || tabParam === "deepwork") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const onTab = (id: string) => {
    const t = (TAB_IDS as readonly string[]).includes(id) ? (id as TabId) : "deepwork";
    setActiveTab(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🎯 Focus</h1>
          <p className="text-xs text-muted-foreground">Productivité profonde & missions</p>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={onTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "deepwork" && <DeepWorkContent />}
          {activeTab === "missions" && <AlterEgoLabContent />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
