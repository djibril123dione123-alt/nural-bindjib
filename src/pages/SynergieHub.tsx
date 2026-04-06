import { useState } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import ChatContent from "@/components/modules/ChatContent";
import ProfileContent from "@/components/modules/ProfileContent";
import { useDuoPresence, type DuoStatus } from "@/hooks/useDuoPresence";
import { BackButton } from "@/components/BackButton";

const TABS = [
  { id: "chat", label: "DuoChat", icon: "💬" },
  { id: "profile", label: "Profil", icon: "👤" },
];

const STATUS_OPTIONS: { value: DuoStatus; label: string; emoji: string }[] = [
  { value: "libre", label: "Libre", emoji: "🟢" },
  { value: "occupe", label: "Occupé", emoji: "🔴" },
  { value: "endormi", label: "Endormi", emoji: "🌙" },
  { value: "etudie", label: "Étudie", emoji: "📚" },
];

export default function SynergieHub() {
  const [activeTab, setActiveTab] = useState("chat");
  const { partnerOnline, partnerName, partnerStatus, streakCount, myStatus, setMyStatus } = useDuoPresence();

  const statusLabel = STATUS_OPTIONS.find(s => s.value === partnerStatus)?.emoji || "🟢";

  return (
    <div className="min-h-screen bg-background pb-20">
      <BackButton />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1 pt-8">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">♾️ Synergie</h1>
          <p className="text-xs text-muted-foreground">L'Alliance en Temps Réel</p>
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

          {/* My status selector */}
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

        <GlassTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "chat" && <ChatContent />}
          {activeTab === "profile" && <ProfileContent />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
