import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { calculateLevel, getRank, getTitle } from "@/lib/questData";
import { BottomNav } from "@/components/BottomNav";
import { BackButton } from "@/components/BackButton";
import { SkeletonScreen } from "@/components/SkeletonScreen";

interface ProfileData {
  user_id: string;
  display_name: string;
  role: string;
  total_xp: number;
  level: number;
  avatar_emoji: string;
}

interface DailyXp {
  userId: string;
  xp: number;
  pillars: Record<string, boolean>;
}

export default function MiroirAlliance() {
  const { user } = useAuth();
  const { partnerOnline, partnerStatus, streakCount } = useDuoPresence();
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [dailyXp, setDailyXp] = useState<DailyXp[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bothComplete, setBothComplete] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const dailyTarget = 150;

  useEffect(() => {
    if (!user) return;
    loadAll();

    const channel = supabase
      .channel("miroir-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "salat_tracking" }, () => loadAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_progress" }, () => loadAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadAll = async () => {
    if (!user) return;

    // Load profiles
    const { data: profs } = await supabase.from("profiles").select("*");
    if (profs) setProfiles(profs as ProfileData[]);

    // Load today's salat for both
    const { data: salatData } = await supabase
      .from("salat_tracking")
      .select("user_id, prayer_name, completed")
      .eq("date", today)
      .eq("completed", true);

    if (salatData && profs) {
      const dailies: DailyXp[] = profs.map((p: any) => {
        const userSalat = salatData.filter((s: any) => s.user_id === p.user_id);
        return {
          userId: p.user_id,
          xp: userSalat.length * 10, // simplified daily XP from salat
          pillars: {
            faith: userSalat.length >= 5,
          },
        };
      });
      setDailyXp(dailies);

      // Check if both completed 5+ prayers
      const allDone = profs.length >= 2 && profs.every((p: any) => {
        const count = salatData.filter((s: any) => s.user_id === p.user_id).length;
        return count >= 5;
      });
      setBothComplete(allDone);
    }

    // Load daily progress for XP
    const { data: progData } = await supabase
      .from("daily_progress")
      .select("user_id, daily_xp")
      .eq("date", today);

    if (progData && profs) {
      setDailyXp(prev => prev.map(d => {
        const prog = progData.find((p: any) => p.user_id === d.userId);
        return prog ? { ...d, xp: prog.daily_xp || d.xp } : d;
      }));
    }

    // Activity feed (deduplicated)
    const { data: actData } = await supabase
      .from("activity_feed")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(30);

    if (actData) {
      const seen = new Set<string>();
      const deduped = actData.filter((a: any) => {
        const key = `${a.user_id}-${a.action}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setActivity(deduped.slice(0, 12));
    }

    setLoading(false);
  };

  const me = profiles.find(p => p.user_id === user?.id);
  const partner = profiles.find(p => p.user_id !== user?.id);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}j`;
  };

  if (loading) return <SkeletonScreen />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <BackButton />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1 pt-8">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🪞 Miroir de l'Alliance</h1>
          <p className="text-xs text-muted-foreground">Ascension synchronisée en temps réel</p>
          {streakCount > 0 && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="inline-flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-full px-3 py-1 mt-2">
              <span className="text-sm">🔥</span>
              <span className="text-xs text-accent font-bold">{streakCount} Duo-Streaks</span>
            </motion.div>
          )}
        </motion.div>

        {/* Monumental Vertical Bars */}
        {me && partner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass rounded-2xl p-6 glow-border-gold">
            <div className="flex items-end justify-center gap-8" style={{ height: 280 }}>
              <VerticalBar
                profile={me}
                dailyXp={dailyXp.find(d => d.userId === me.user_id)?.xp || 0}
                target={dailyTarget}
                color="blue"
                isSelf
              />
              <div className="flex flex-col items-center gap-2 pb-4">
                <span className="text-2xl">⚡</span>
                <span className="text-[10px] text-accent font-bold uppercase tracking-wider">VS</span>
              </div>
              <VerticalBar
                profile={partner}
                dailyXp={dailyXp.find(d => d.userId === partner.user_id)?.xp || 0}
                target={dailyTarget}
                color="pink"
              />
            </div>

            {/* Pillar icons */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[me, partner].map(p => {
                const dx = dailyXp.find(d => d.userId === p.user_id);
                return (
                  <div key={p.user_id} className="flex items-center justify-center gap-3">
                    {["⚔️", "📚", "🕌", "🏠"].map((icon, i) => {
                      const pillarKeys = ["body", "mind", "faith", "life"];
                      const done = dx?.pillars?.[pillarKeys[i]];
                      return (
                        <motion.span key={i}
                          animate={done ? { scale: [1, 1.2, 1] } : {}}
                          className={`text-lg transition-all ${done ? "opacity-100 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "opacity-30"}`}>
                          {icon}
                        </motion.span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Synergy Bonus */}
        <motion.div
          className={`glass rounded-2xl p-4 text-center space-y-2 border transition-all ${
            bothComplete ? "border-accent glow-border-gold" : "border-accent/20"
          }`}
          animate={bothComplete ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: bothComplete ? Infinity : 0, duration: 2 }}
        >
          <p className="text-sm font-display font-semibold text-accent">🏆 Bonus Synergie</p>
          {bothComplete ? (
            <p className="text-xs text-accent font-bold">✨ Les deux Alter Egos ont atteint 100% ! +100 XP !</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Si les deux atteignent 5/6 prières, <span className="text-accent font-bold">+100 XP Synergie</span>
            </p>
          )}
        </motion.div>

        {/* Partner presence */}
        {partner && (
          <div className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${partnerOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{partner.display_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {partnerOnline ? `En ligne • ${partnerStatus === "etudie" ? "📚 Étudie" : partnerStatus === "endormi" ? "🌙 Dort" : partnerStatus === "occupe" ? "🔴 Occupé" : "🟢 Libre"}` : "Hors-ligne"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">{partner.total_xp || 0}</p>
              <p className="text-[9px] text-muted-foreground">XP Total</p>
            </div>
          </div>
        )}

        {/* Activity */}
        {activity.length > 0 && (
          <div className="glass rounded-2xl p-4 space-y-3 border border-accent/10">
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-accent">🪞 Activité du jour</h3>
            {activity.map((item: any) => {
              const isMe = item.user_id === user?.id;
              const prof = isMe ? me : partner;
              return (
                <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-xs">
                  <span>{prof?.role === "guide" ? "🧭" : "🛡️"}</span>
                  <span className="flex-1 text-foreground/80 truncate">
                    <strong>{prof?.display_name}</strong> {item.action}
                  </span>
                  {item.xp_earned > 0 && <span className="text-accent text-[10px]">+{item.xp_earned}</span>}
                  <span className="text-muted-foreground text-[9px]">{timeAgo(item.created_at)}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function VerticalBar({ profile, dailyXp, target, color, isSelf }: {
  profile: ProfileData; dailyXp: number; target: number; color: "blue" | "pink"; isSelf?: boolean;
}) {
  const pct = Math.min(100, (dailyXp / target) * 100);
  const level = profile.level || calculateLevel(profile.total_xp || 0);
  const rank = getRank(level);
  const { title } = getTitle(level, profile.role as "guide" | "guardian");
  
  const barBg = color === "blue" 
    ? "from-blue-600 to-blue-400" 
    : "from-pink-600 to-pink-400";
  const borderColor = color === "blue" ? "border-blue-500/30" : "border-pink-500/30";
  const glowShadow = color === "blue"
    ? "0 0 20px rgba(59,130,246,0.3)"
    : "0 0 20px rgba(244,114,182,0.3)";

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      {/* Name & level */}
      <span className="text-xl">{profile.avatar_emoji || (profile.role === "guide" ? "🧭" : "🛡️")}</span>
      <p className="text-xs font-display font-bold text-foreground">{profile.display_name}</p>
      <p className="text-[9px] text-accent">{rank.emoji} Lvl {level}</p>

      {/* Vertical bar */}
      <div className={`relative w-12 rounded-full border ${borderColor} overflow-hidden bg-secondary/30`}
        style={{ height: 160, boxShadow: pct > 50 ? glowShadow : undefined }}>
        <motion.div
          className={`absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t ${barBg}`}
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-lg">{Math.round(pct)}%</span>
        </div>
      </div>

      {/* Daily XP */}
      <p className="text-sm font-bold text-primary">{dailyXp}</p>
      <p className="text-[8px] text-muted-foreground">XP aujourd'hui</p>
      {isSelf && <span className="text-[8px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">Vous</span>}
    </div>
  );
}
