import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

const CHALLENGES = [
  {
    type: "purete_sonore",
    label: "Pureté Sonore",
    icon: "🎧",
    desc: "7 jours sans musique",
    badge: "Cœur Apaisé 💎",
    xp: 30,
  },
  {
    type: "digital_detox",
    label: "Digital Detox",
    icon: "📵",
    desc: "< 1h de réseaux sociaux/jour",
    badge: "Esprit Libre 🧠",
    xp: 40,
  },
  {
    type: "parure_sakinah",
    label: "Parure de Sakinah",
    icon: "🌸",
    desc: "Sérénité & comportement exemplaire",
    badge: "Perle de l'Alliance 🦪",
    xp: 30,
  },
];

const PRAYER_VERSES = [
  "« Certes, la prière préserve de la turpitude et du blâmable. » — Coran 29:45",
  "« Et accomplis la prière, car la prière empêche la turpitude. » — Coran 29:45",
  "« La première chose dont le serviteur rendra compte est la prière. » — Hadith",
  "« Hâtez-vous vers la prière avant que la mort ne vous surprenne. » — Hadith",
  "« O mon fils, accomplis la prière. » — Coran 31:17",
];

interface ChallengeEntry {
  id: string;
  challenge_type: string;
  day_number: number;
  completed: boolean;
  date: string;
}

const Tazkiyah = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
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
      .map(e => e.date)
      .sort()
      .reverse();

    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const dateStr = d.toISOString().slice(0, 10);
      if (typeEntries.includes(dateStr)) {
        streak++;
      } else if (i > 0) break;
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
        user_id: user.id,
        challenge_type: type,
        completed: true,
        date: today,
        day_number: getStreak(type) + 1,
      });
    }

    const challenge = CHALLENGES.find(c => c.type === type);
    const newStreak = getStreak(type) + (isTodayCompleted(type) ? 0 : 1);
    if (newStreak >= 7 && !isTodayCompleted(type)) {
      toast.success(`🏆 Badge débloqué : ${challenge?.badge} !`);
    } else {
      toast.success(`+${challenge?.xp} Baraka — ${challenge?.label}`);
    }
    loadEntries();
  };

  const randomVerse = useMemo(() => PRAYER_VERSES[Math.floor(Math.random() * PRAYER_VERSES.length)], []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">✨ Tazkiyah</h1>
          <p className="text-xs text-muted-foreground">Purification de l'âme — Défis 7 jours</p>
        </motion.div>

        {/* Verse banner */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-accent italic">{randomVerse}</p>
        </motion.div>

        {/* Challenges */}
        {CHALLENGES.map((ch, i) => {
          const streak = getStreak(ch.type);
          const done = isTodayCompleted(ch.type);
          const badgeEarned = streak >= 7;

          return (
            <motion.div
              key={ch.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`glass rounded-xl p-5 space-y-4 ${badgeEarned ? "glow-border-gold" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{ch.icon}</span>
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-sm">{ch.label}</h3>
                    <p className="text-[10px] text-muted-foreground">{ch.desc}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary">+{ch.xp} XP</span>
              </div>

              {/* 7-day tracker */}
              <div className="flex gap-1.5 justify-center">
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
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                          dayCompleted
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/50 text-muted-foreground"
                        }`}
                        style={dayCompleted ? { boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" } : {}}
                      >
                        {dayCompleted ? "✓" : day + 1}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Badge & action */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Série : {streak}/7</span>
                  {badgeEarned && (
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">
                      {ch.badge}
                    </span>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleChallenge(ch.type)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    done
                      ? "bg-primary/20 border border-primary text-primary"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {done ? "✓ Fait aujourd'hui" : "Marquer fait"}
                </motion.button>
              </div>
            </motion.div>
          );
        })}

        {/* Score récap */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="glass rounded-xl p-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground">Points Tazkiyah du jour</p>
          <p className="text-2xl font-bold text-primary">
            {CHALLENGES.reduce((sum, ch) => sum + (isTodayCompleted(ch.type) ? ch.xp : 0), 0)} XP
          </p>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Tazkiyah;
