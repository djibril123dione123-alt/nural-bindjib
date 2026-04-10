import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import SalatContent from "@/components/modules/SalatContent";
import HifzContent from "@/components/modules/HifzContent";
import DuaContent from "@/components/modules/DuaContent";
import Tazkiyah from "./Tazkiyah";

const TAB_IDS = ["salat", "hifz", "dua", "defis"] as const;
type TabId = (typeof TAB_IDS)[number];

const TABS = [
  { id: "salat", label: "Salat", icon: "🕌" },
  { id: "hifz", label: "Hifz", icon: "📖" },
  { id: "dua", label: "Dua", icon: "🤲" },
  { id: "defis", label: "Défis", icon: "✨" },
];

export default function TazkiyahHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initial: TabId =
    tabParam && (TAB_IDS as readonly string[]).includes(tabParam) ? (tabParam as TabId) : "salat";
  const [activeTab, setActiveTab] = useState<TabId>(initial);

  useEffect(() => {
    if (tabParam && (TAB_IDS as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [tabParam]);

  const onTab = (id: string) => {
    const t = (TAB_IDS as readonly string[]).includes(id) ? (id as TabId) : "salat";
    setActiveTab(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🕌 Tazkiyah</h1>
          <p className="text-xs text-muted-foreground">Spirituel — Salat, Hifz, Dua & défis</p>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={onTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "salat" && <SalatContent />}
          {activeTab === "hifz" && <HifzContent />}
          {activeTab === "dua" && <DuaContent />}
          {activeTab === "defis" && <Tazkiyah embedded />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
