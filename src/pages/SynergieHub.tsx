import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import ChatContent from "@/components/modules/ChatContent";
import ProfileContent from "@/components/modules/ProfileContent";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DualProgressBar } from "@/components/DualProgressBar";

const TABS = [
  { id: "miroir", label: "Miroir", icon: "📈" },
  { id: "chat", label: "DuoChat", icon: "💬" },
  { id: "profile", label: "Profil", icon: "👤" },
];

export default function SynergieHub() {
  const [activeTab, setActiveTab] = useState("miroir");
  const { partnerOnline, partnerName, streakCount } = useDuoPresence();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">♾️ Synergie</h1>
          <p className="text-xs text-muted-foreground">L'Alliance en Temps Réel</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${partnerOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
              <span className="text-[10px] text-muted-foreground">
                {partnerName || "Partenaire"} {partnerOnline ? "en ligne" : "hors-ligne"}
              </span>
            </div>
            {streakCount > 0 && (
              <span className="text-[10px] text-accent font-bold">🔥 {streakCount} Duo-Streaks</span>
            )}
          </div>
        </motion.div>

        <GlassTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "miroir" && <MiroirContent />}
          {activeTab === "chat" && <ChatContent />}
          {activeTab === "profile" && <ProfileContent />}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}

function MiroirContent() {
  const { user } = useAuth();
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      if (!profiles) return;
      const me = profiles.find((p: any) => p.user_id === user.id);
      const partner = profiles.find((p: any) => p.user_id !== user.id);
      setMyProfile(me);
      setPartnerProfile(partner);
    };
    load();

    // Realtime updates
    const channel = supabase
      .channel("profiles-mirror")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="space-y-5">
      <DualProgressBar />

      {/* Side by side stats */}
      {myProfile && partnerProfile && (
        <div className="grid grid-cols-2 gap-3">
          <ProfileStatCard
            name={myProfile.display_name}
            emoji={myProfile.avatar_emoji || "🧭"}
            xp={myProfile.total_xp || 0}
            level={myProfile.level || 1}
            role={myProfile.role}
            isSelf
          />
          <ProfileStatCard
            name={partnerProfile.display_name}
            emoji={partnerProfile.avatar_emoji || "🛡️"}
            xp={partnerProfile.total_xp || 0}
            level={partnerProfile.level || 1}
            role={partnerProfile.role}
          />
        </div>
      )}

      {/* Synergy bonus info */}
      <div className="glass rounded-2xl p-4 text-center space-y-2 glow-border-gold">
        <p className="text-sm font-display font-semibold text-accent">🏆 Bonus Synergie</p>
        <p className="text-xs text-muted-foreground">
          Si les deux Alter Egos atteignent 100% des objectifs quotidiens,
          <span className="text-accent font-bold"> +100 XP Synergie</span> est accordé aux deux.
        </p>
      </div>
    </div>
  );
}

function ProfileStatCard({ name, emoji, xp, level, role, isSelf }: {
  name: string; emoji: string; xp: number; level: number; role: string; isSelf?: boolean;
}) {
  const isGuardian = role === "guardian";
  const borderClass = isGuardian ? "border-pink-500/30" : "border-blue-500/30";
  const glowStyle = isGuardian
    ? { boxShadow: "0 0 15px rgba(244, 114, 182, 0.15)" }
    : { boxShadow: "0 0 15px rgba(59, 130, 246, 0.15)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-2xl p-4 text-center space-y-2 border ${borderClass}`}
      style={glowStyle}
    >
      <span className="text-3xl">{emoji}</span>
      <p className="text-sm font-display font-bold text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground">{isGuardian ? "La Gardienne" : "Le Guide"}</p>
      <div className="glass rounded-lg p-2">
        <p className="text-lg font-bold text-primary">{xp}</p>
        <p className="text-[9px] text-muted-foreground">XP Total</p>
      </div>
      <p className="text-xs text-accent font-semibold">Niveau {level}</p>
      {isSelf && <span className="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">Vous</span>}
    </motion.div>
  );
}
