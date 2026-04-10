import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { toast } from "sonner";

const CHALLENGES = [
  {
    type: "purete_sonore",
    label: "Pureté Sonore",
    icon: "🎧",
    desc: "7 jours sans musique",
    badge: "Gardien de la Langue 🛡️",
    badgeIcon: "🛡️",
    xp: 30,
    gradient: "from-primary/20 to-primary/5",
    quotes: [
      "« Certes, la musique fait pousser l'hypocrisie dans le cœur. » — Ibn Mas'ud",
      "« Il y aura des gens qui rendront licites la soie, le vin et les instruments de musique. » — Bukhari",
      "« Le Coran et la musique ne peuvent coexister dans un même cœur. » — Ibn al-Qayyim",
    ],
  },
  {
    type: "digital_detox",
    label: "Digital Detox",
    icon: "📵",
    desc: "< 1h de réseaux sociaux/jour",
    badge: "Esprit Libre 🧠",
    badgeIcon: "🧠",
    xp: 40,
    gradient: "from-accent/20 to-accent/5",
    quotes: [
      "« Fais partie de ceux qui se rappellent d'Allah abondamment. » — Coran 33:41",
      "« Préserve ta langue du futile et ton cœur du superflu. » — Hassan al-Basri",
      "« Le temps est comme une épée, si tu ne le coupes pas, il te coupe. » — Imam Shafi'i",
    ],
  },
  {
    type: "parure_sakinah",
    label: "Parure de Sakinah",
    icon: "🌸",
    desc: "Sérénité & comportement exemplaire",
    badge: "Perle de l'Alliance 🦪",
    badgeIcon: "🦪",
    xp: 30,
    gradient: "from-purple-500/20 to-purple-500/5",
    quotes: [
      "« C'est Lui qui a fait descendre la quiétude (sakinah) dans les cœurs des croyants. » — Coran 48:4",
      "« Le croyant le plus parfait en foi est celui qui a le meilleur caractère. » — Tirmidhi",
      "« Les meilleurs d'entre vous sont ceux qui sont les meilleurs avec leurs épouses. » — Tirmidhi",
    ],
  },
];

interface ChallengeEntry {
  id: string;
  challenge_type: string;
  day_number: number;
  completed: boolean;
  date: string;
}

const Tazkiyah = ({ embedded = false }: { embedded?: boolean }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const { trigger, fire } = useParticles();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tazkiyah_challenges")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });
    if (data) setEntries(data as ChallengeEntry[]);
  };

  const getStreak = (type: string) => {
    const typeEntries = entries
      .filter(e => e.challenge_type === type && e.completed)
      .map(e => e.date).sort().reverse();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const dateStr = d.toISOString().slice(0, 10);
      if (typeEntries.includes(dateStr)) streak++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  const isTodayCompleted = (type: string) =>
    entries.some(e => e.challenge_type === type && e.date === today && e.completed);

  const toggleChallenge = async (type: string) => {
    if (!user) return;
    const existing = entries.find(e => e.challenge_type === type && e.date === today);

    if (existing) {
      await supabase.from("tazkiyah_challenges")
        .update({ completed: !existing.completed })
        .eq("id", existing.id);
    } else {
      await supabase.from("tazkiyah_challenges").insert({
        user_id: user.id, challenge_type: type,
        completed: true, date: today, day_number: getStreak(type) + 1,
      });
    }

    fire();
    const challenge = CHALLENGES.find(c => c.type === type);
    const newStreak = getStreak(type) + (isTodayCompleted(type) ? 0 : 1);
    if (newStreak >= 7 && !isTodayCompleted(type)) {
      toast.success(`🏆 Badge débloqué : ${challenge?.badge} !`);
    } else {
      toast.success(`+${challenge?.xp} Baraka — ${challenge?.label}`);
    }
    loadEntries();
  };

  const todayXp = CHALLENGES.reduce((sum, ch) => sum + (isTodayCompleted(ch.type) ? ch.xp : 0), 0);
  const totalBadges = CHALLENGES.filter(ch => getStreak(ch.type) >= 7).length;

  return (
    <div className={`min-h-screen bg-background relative overflow-hidden ${embedded ? "pb-4" : "pb-20"}`}>
      <GoldenParticles trigger={trigger} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">✨ Tazkiyah</h1>
          <p className="text-xs text-muted-foreground">Purification de l'âme — Défis 7 jours</p>
        </motion.div>

        {/* Score + Badges summary */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-6 flex items-center justify-between">
          <div className="text-center">
            <CircularProgress value={todayXp} max={100} size={90}>
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{todayXp}</p>
                <p className="text-[8px] text-muted-foreground uppercase">XP</p>
              </div>
            </CircularProgress>
          </div>
          <div className="flex-1 ml-5 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Badges de Prestige</p>
            <div className="flex gap-2">
              {CHALLENGES.map(ch => {
                const earned = getStreak(ch.type) >= 7;
                return (
                  <motion.div key={ch.type}
                    animate={earned ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                      earned ? "border-accent bg-accent/20 glow-gold" : "border-border/30 bg-secondary/30 opacity-40"
                    }`}>
                    {ch.badgeIcon}
                  </motion.div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">{totalBadges}/3 débloqués</p>
          </div>
        </motion.div>

        {/* Challenge Cards */}
        {CHALLENGES.map((ch, i) => {
          const streak = getStreak(ch.type);
          const done = isTodayCompleted(ch.type);
          const badgeEarned = streak >= 7;
          const expanded = expandedChallenge === ch.type;
          const quote = ch.quotes[Math.floor(Math.random() * ch.quotes.length)];

          return (
            <motion.div key={ch.type}
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`glass rounded-2xl overflow-hidden ${badgeEarned ? "glow-border-gold" : ""}`}
            >
              {/* Header */}
              <div
                className={`p-5 bg-gradient-to-r ${ch.gradient} cursor-pointer`}
                onClick={() => setExpandedChallenge(expanded ? null : ch.type)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl glass flex items-center justify-center text-2xl">
                      {ch.icon}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-foreground">{ch.label}</h3>
                      <p className="text-[10px] text-muted-foreground">{ch.desc}</p>
                    </div>
                  </div>
                  <CircularProgress value={streak} max={7} size={52} strokeWidth={4}>
                    <span className="text-xs font-bold text-primary">{streak}/7</span>
                  </CircularProgress>
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4">
                      {/* Quote */}
                      <div className="bg-secondary/30 rounded-xl p-3 border border-border/50">
                        <p className="text-xs text-accent italic leading-relaxed">{quote}</p>
                      </div>

                      {/* 7-day tracker */}
                      <div className="flex gap-2 justify-center">
                        {Array.from({ length: 7 }).map((_, day) => {
                          const d = new Date();
                          d.setDate(d.getDate() - (6 - day));
                          const dateStr = d.toISOString().slice(0, 10);
                          const dayCompleted = entries.some(
                            e => e.challenge_type === ch.type && e.date === dateStr && e.completed
                          );
                          return (
                            <div key={day} className="flex flex-col items-center gap-1">
                              <span className="text-[8px] text-muted-foreground">
                                {["D", "L", "M", "M", "J", "V", "S"][d.getDay()]}
                              </span>
                              <motion.div
                                animate={dayCompleted ? { scale: [1, 1.1, 1] } : {}}
                                transition={{ duration: 0.3 }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                                  dayCompleted
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary/50 text-muted-foreground border border-border/50"
                                }`}
                                style={dayCompleted ? { boxShadow: "0 0 10px rgba(16, 185, 129, 0.5)" } : {}}
                              >
                                {dayCompleted ? "✓" : day + 1}
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Badge */}
                      {badgeEarned && (
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-center py-2 bg-accent/10 rounded-xl border border-accent/30"
                        >
                          <p className="text-sm font-display font-bold text-accent">{ch.badge}</p>
                          <p className="text-[10px] text-muted-foreground">Badge de Prestige obtenu</p>
                        </motion.div>
                      )}

                      {/* Action */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleChallenge(ch.type)}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
                          done
                            ? "bg-primary/10 border-2 border-primary text-primary"
                            : "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                        }`}
                      >
                        {done ? "✓ Accompli aujourd'hui" : `Valider +${ch.xp} XP`}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Collapsed XP tag */}
              {!expanded && (
                <div className="px-5 pb-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {done ? "✓ Fait" : `+${ch.xp} XP`}
                  </span>
                  {badgeEarned && (
                    <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30 font-semibold">
                      {ch.badge}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      {!embedded && <BottomNav />}
    </div>
  );
};

export default Tazkiyah;
