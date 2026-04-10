import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import ChatContent from "@/components/modules/ChatContent";
import ProfileContent from "@/components/modules/ProfileContent";
import MiroirAlliance from "@/pages/MiroirAlliance";
import { useDuoPresence, type DuoStatus } from "@/hooks/useDuoPresence";
import { BackButton } from "@/components/BackButton";

const TAB_IDS = ["chat", "miroir", "profile"] as const;
type TabId = (typeof TAB_IDS)[number];

const TABS = [
  { id: "chat", label: "Duo Chat", icon: "💬" },
  { id: "miroir", label: "Miroir", icon: "🪞" },
  { id: "profile", label: "Profil", icon: "👤" },
];

const STATUS_OPTIONS: { value: DuoStatus; label: string; emoji: string }[] = [
  { value: "libre", label: "Libre", emoji: "🟢" },
  { value: "occupe", label: "Occupé", emoji: "🔴" },
  { value: "endormi", label: "Endormi", emoji: "🌙" },
  { value: "etudie", label: "Étudie", emoji: "📚" },
];

export default function SynergieHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initial: TabId =
    tabParam && (TAB_IDS as readonly string[]).includes(tabParam) ? (tabParam as TabId) : "chat";
  const [activeTab, setActiveTab] = useState<TabId>(initial);
  const { partnerOnline, partnerName, partnerStatus, streakCount, myStatus, setMyStatus } = useDuoPresence();

  useEffect(() => {
    if (tabParam && (TAB_IDS as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [tabParam]);

  const onTab = (id: string) => {
    const t = (TAB_IDS as readonly string[]).includes(id) ? (id as TabId) : "chat";
    setActiveTab(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  const statusLabel = STATUS_OPTIONS.find(s => s.value === partnerStatus)?.emoji || "🟢";

  return (
    <div className="min-h-screen bg-background pb-20">
      <BackButton />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1 pt-8">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">♾️ Synergie</h1>
          <p className="text-xs text-muted-foreground">Social — Chat, miroir & profil</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${partnerOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
              <span className="text-[10px] text-muted-foreground">
                {partnerName || "Partenaire"} {partnerOnline ? `${statusLabel}` : "hors-ligne"}
              </span>
            </div>
            {streakCount > 0 && (
              <span className="text-[10px] text-accent font-bold">🔥 {streakCount} Duo-Streaks</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[10px] text-muted-foreground">Mon statut :</span>
            {STATUS_OPTIONS.map(opt => (
              <motion.button
                key={opt.value}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMyStatus(opt.value)}
                className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                  myStatus === opt.value
                    ? "bg-primary/20 border-primary text-primary"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {opt.emoji} {opt.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={onTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "chat" && <ChatContent />}
          {activeTab === "miroir" && <MiroirAlliance embedInHub />}
          {activeTab === "profile" && <ProfileContent />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
