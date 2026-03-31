import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";

const PRAYERS = [
  { name: "fajr", label: "Fajr", icon: "🌅", defaultTime: "05:30", xp: 30 },
  { name: "dhuhr", label: "Dhuhr", icon: "☀️", defaultTime: "13:00", xp: 10 },
  { name: "asr", label: "Asr", icon: "🌤️", defaultTime: "16:30", xp: 10 },
  { name: "maghrib", label: "Maghrib", icon: "🌇", defaultTime: "19:45", xp: 10 },
  { name: "isha", label: "Isha", icon: "🌙", defaultTime: "21:15", xp: 10 },
];

const MOTIVATIONS = [
  "« La prière est la clé du Paradis. » — Hadith",
  "« Certes, la prière préserve de la turpitude. » — Coran 29:45",
  "« La première chose dont on sera jugé est la Salat. » — Hadith",
  "« Établissez la prière et ne soyez pas parmi les insouciants. » — Coran 7:205",
  "« Et cherchez secours dans la patience et la prière. » — Coran 2:45",
  "« O mon fils, accomplis la prière. » — Coran 31:17",
  "« La prière en son temps est l'acte le plus aimé d'Allah. » — Hadith",
  "« Récitez le Coran, car il viendra intercéder pour ses compagnons. » — Hadith",
];

interface SalatEntry {
  id: string;
  prayer_name: string;
  completed: boolean;
  completed_at: string | null;
  on_time: boolean;
  custom_time: string | null;
  date: string;
}

const SalatTracker = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<SalatEntry[]>([]);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("salat_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today);
    if (data) setEntries(data as SalatEntry[]);
  };

  const getEntry = (prayerName: string) => entries.find(e => e.prayer_name === prayerName);

  const togglePrayer = async (prayerName: string) => {
    if (!user) return;
    const existing = getEntry(prayerName);
    const now = new Date();
    const prayer = PRAYERS.find(p => p.name === prayerName)!;
    const customTime = existing?.custom_time || prayer.defaultTime;
    const [h, m] = customTime.split(":").map(Number);
    const prayerTime = new Date();
    prayerTime.setHours(h, m, 0, 0);
    const diffMin = (now.getTime() - prayerTime.getTime()) / 60000;
    const onTime = diffMin >= -10 && diffMin <= 30;

    if (existing) {
      await supabase.from("salat_tracking")
        .update({ completed: !existing.completed, completed_at: now.toISOString(), on_time: onTime })
        .eq("id", existing.id);
    } else {
      await supabase.from("salat_tracking").insert({
        user_id: user.id,
        date: today,
        prayer_name: prayerName,
        completed: true,
        completed_at: now.toISOString(),
        on_time: onTime,
        custom_time: customTime,
      });
    }

    const motivation = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
    toast.success(
      onTime ? `${prayer.label} à l'heure ! +${prayer.xp} XP` : `${prayer.label} validée`,
      { description: motivation }
    );
    loadEntries();
  };

  const updateCustomTime = async (prayerName: string, time: string) => {
    if (!user) return;
    const existing = getEntry(prayerName);
    if (existing) {
      await supabase.from("salat_tracking").update({ custom_time: time }).eq("id", existing.id);
    }
    setEditingTime(null);
    loadEntries();
  };

  const completedCount = entries.filter(e => e.completed).length;
  const onTimeCount = entries.filter(e => e.completed && e.on_time).length;

  const motivation = useMemo(() => MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)], []);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🕌 Salat</h1>
          <p className="text-xs text-muted-foreground">Suivi des 5 prières quotidiennes</p>
        </motion.div>

        {/* Motivation */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4 text-center">
          <p className="text-xs text-accent italic">{motivation}</p>
        </motion.div>

        {/* Summary */}
        <div className="flex gap-3">
          <div className={`flex-1 glass rounded-lg p-3 text-center ${completedCount >= 5 ? "glow-border-emerald" : ""}`}>
            <p className="text-xs text-muted-foreground">Complétées</p>
            <p className="text-lg font-bold text-primary">{completedCount}/5</p>
          </div>
          <div className={`flex-1 glass rounded-lg p-3 text-center ${onTimeCount >= 5 ? "glow-border-gold" : ""}`}>
            <p className="text-xs text-muted-foreground">À l'heure</p>
            <p className="text-lg font-bold text-accent">{onTimeCount}/5</p>
          </div>
        </div>

        {/* Prayers */}
        {PRAYERS.map((prayer, i) => {
          const entry = getEntry(prayer.name);
          const done = entry?.completed || false;
          const onTime = entry?.on_time || false;
          const customTime = entry?.custom_time || prayer.defaultTime;

          return (
            <motion.div
              key={prayer.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`glass rounded-xl p-4 ${done && onTime ? "glow-border-gold" : done ? "glow-border-emerald" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{prayer.icon}</span>
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-sm">{prayer.label}</h3>
                    <div className="flex items-center gap-2">
                      {editingTime === prayer.name ? (
                        <input
                          type="time"
                          defaultValue={customTime}
                          onBlur={(e) => updateCustomTime(prayer.name, e.target.value)}
                          autoFocus
                          className="bg-secondary/50 border border-border rounded px-2 py-0.5 text-xs text-foreground"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingTime(prayer.name)}
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          ⏰ {customTime} (modifier)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {done && onTime && <span className="text-[10px] text-accent font-semibold">À L'HEURE</span>}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => togglePrayer(prayer.name)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      done
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 border border-border text-muted-foreground"
                    }`}
                    style={done ? { boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)" } : {}}
                  >
                    {done ? "✓" : "○"}
                  </motion.button>
                </div>
              </div>

              {done && entry?.completed_at && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Validée à {new Date(entry.completed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
};

export default SalatTracker;
