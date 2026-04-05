import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { GlassTabs } from "@/components/GlassTabs";
import ChatContent from "@/components/modules/ChatContent";
import ProfileContent from "@/components/modules/ProfileContent";
import { useDuoPresence, type DuoStatus } from "@/hooks/useDuoPresence";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DualProgressBar } from "@/components/DualProgressBar";
import { CircularProgress } from "@/components/CircularProgress";
import { calculateLevel, getRank, getTitle } from "@/lib/questData";

const TABS = [
  { id: "miroir", label: "Miroir", icon: "📈" },
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
  const [activeTab, setActiveTab] = useState("miroir");
  const { partnerOnline, partnerName, partnerStatus, streakCount, myStatus, setMyStatus } = useDuoPresence();
  const { profile } = useAuth();

  const statusLabel = STATUS_OPTIONS.find(s => s.value === partnerStatus)?.emoji || "🟢";

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
  const [todayActivity, setTodayActivity] = useState<any[]>([]);
  const [bothComplete, setBothComplete] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: profiles } = await supabase.from("profiles").select("*");
      if (!profiles) return;
      const me = profiles.find((p: any) => p.user_id === user.id);
      const partner = profiles.find((p: any) => p.user_id !== user.id);
      setMyProfile(me);
      setPartnerProfile(partner);

      // Load today's activity (deduplicated)
      const today = new Date().toISOString().slice(0, 10);
      const { data: activity } = await supabase
        .from("activity_feed")
        .select("*")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (activity) {
        // Deduplicate by action + user_id (keep latest)
        const seen = new Set<string>();
        const deduped = activity.filter((a: any) => {
          const key = `${a.user_id}-${a.action}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setTodayActivity(deduped.slice(0, 10));
      }

      // Check if both have completed daily salat
      const { data: salatMe } = await supabase
        .from("salat_tracking")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("completed", true);

      if (partner) {
        const { data: salatPartner } = await supabase
          .from("salat_tracking")
          .select("*")
          .eq("user_id", partner.user_id)
          .eq("date", today)
          .eq("completed", true);
        setBothComplete((salatMe?.length || 0) >= 5 && (salatPartner?.length || 0) >= 5);
      }
    };
    load();

    // Realtime updates
    const channel = supabase
      .channel("profiles-mirror")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  };

  return (
    <div className="space-y-5">
      <DualProgressBar />

      {/* Side by side stats */}
      {myProfile && partnerProfile && (
        <div className="grid grid-cols-2 gap-3">
          <ProfileStatCard
            name={myProfile.display_name}
            emoji={myProfile.avatar_emoji || (myProfile.role === "guide" ? "🧭" : "🛡️")}
            xp={myProfile.total_xp || 0}
            level={myProfile.level || 1}
            role={myProfile.role}
            isSelf
          />
          <ProfileStatCard
            name={partnerProfile.display_name}
            emoji={partnerProfile.avatar_emoji || (partnerProfile.role === "guide" ? "🧭" : "🛡️")}
            xp={partnerProfile.total_xp || 0}
            level={partnerProfile.level || 1}
            role={partnerProfile.role}
          />
        </div>
      )}

      {/* Synergy bonus */}
      <motion.div
        className={`glass rounded-2xl p-4 text-center space-y-2 border transition-all ${
          bothComplete ? "border-accent glow-border-gold" : "border-accent/20"
        }`}
        animate={bothComplete ? { scale: [1, 1.02, 1] } : {}}
        transition={{ repeat: bothComplete ? Infinity : 0, duration: 2 }}
      >
        <p className="text-sm font-display font-semibold text-accent">🏆 Bonus Synergie</p>
        {bothComplete ? (
          <p className="text-xs text-accent font-bold">
            ✨ Les deux Alter Egos ont atteint 100% ! +100 XP Synergie !
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Si les deux atteignent 5/6 prières,
            <span className="text-accent font-bold"> +100 XP Synergie</span> est accordé.
          </p>
        )}
      </motion.div>

      {/* Today's activity (deduplicated) */}
      {todayActivity.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-accent/10">
          <h3 className="text-xs font-display font-bold uppercase tracking-wider text-accent">
            🪞 Activité du jour
          </h3>
          {todayActivity.map((item: any) => {
            const isMe = item.user_id === user?.id;
            return (
              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-xs">
                <span>{isMe ? (myProfile?.role === "guide" ? "🧭" : "🛡️") : (partnerProfile?.role === "guide" ? "🧭" : "🛡️")}</span>
                <span className="flex-1 text-foreground/80 truncate">
                  <strong>{isMe ? myProfile?.display_name : partnerProfile?.display_name}</strong>{" "}
                  {item.action}
                </span>
                {item.xp_earned > 0 && <span className="text-accent text-[10px]">+{item.xp_earned}</span>}
                <span className="text-muted-foreground text-[9px]">{timeAgo(item.created_at)}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileStatCard({ name, emoji, xp, level, role, isSelf }: {
  name: string; emoji: string; xp: number; level: number; role: string; isSelf?: boolean;
}) {
  const isGuardian = role === "guardian";
  const roleLabel = isGuardian ? "La Gardienne" : "Le Guide";
  const rank = getRank(level);
  const { title } = getTitle(level, role as "guide" | "guardian");
  const borderClass = isGuardian ? "border-pink-500/30" : "border-blue-500/30";
  const glowStyle = isGuardian
    ? { boxShadow: "0 0 15px rgba(244, 114, 182, 0.15)" }
    : { boxShadow: "0 0 15px rgba(59, 130, 246, 0.15)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={`glass rounded-2xl p-4 text-center space-y-2 border ${borderClass}`}
      style={glowStyle}
    >
      <span className="text-3xl">{emoji}</span>
      <p className="text-sm font-display font-bold text-foreground">{name}</p>
      <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
      <p className="text-[9px] text-accent font-semibold">{rank.emoji} {title}</p>
      <div className="glass rounded-lg p-2">
        <p className="text-lg font-bold text-primary">{xp}</p>
        <p className="text-[9px] text-muted-foreground">XP Total</p>
      </div>
      <p className="text-xs text-accent font-semibold">Niveau {level}</p>
      {isSelf && <span className="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">Vous</span>}
    </motion.div>
  );
}
