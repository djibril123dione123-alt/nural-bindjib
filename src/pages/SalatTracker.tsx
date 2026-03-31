import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { toast } from "sonner";

const PRAYERS = [
  { name: "fajr", label: "Fajr", icon: "🌅", defaultTime: "05:30", xp: 30, sunnah: "2 avant" },
  { name: "dhuhr", label: "Dhuhr", icon: "☀️", defaultTime: "13:00", xp: 10, sunnah: "4 avant, 2 après" },
  { name: "asr", label: "Asr", icon: "🌤️", defaultTime: "16:30", xp: 10, sunnah: "" },
  { name: "maghrib", label: "Maghrib", icon: "🌇", defaultTime: "19:45", xp: 10, sunnah: "2 après" },
  { name: "isha", label: "Isha", icon: "🌙", defaultTime: "21:15", xp: 10, sunnah: "2 après + Witr" },
];

const MOTIVATIONS = [
  "« La prière est la clé du Paradis. » — Hadith",
  "« Certes, la prière préserve de la turpitude. » — Coran 29:45",
  "« La première chose dont on sera jugé est la Salat. » — Hadith",
  "« Établissez la prière et ne soyez pas parmi les insouciants. » — Coran 7:205",
  "« Et cherchez secours dans la patience et la prière. » — Coran 2:45",
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
  const [sunnahDone, setSunnahDone] = useState<Record<string, boolean>>({});
  const [mosqueDone, setMosqueDone] = useState<Record<string, boolean>>({});
  const { trigger, fire } = useParticles();
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

  const getEntry = (name: string) => entries.find(e => e.prayer_name === name);

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
        user_id: user.id, date: today, prayer_name: prayerName,
        completed: true, completed_at: now.toISOString(), on_time: onTime, custom_time: customTime,
      });
    }

    fire();
    let xpGained = prayer.xp;
    if (mosqueDone[prayerName]) xpGained *= 2;
    const motivation = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
    toast.success(
      onTime ? `${prayer.label} à l'heure ! +${xpGained} XP` : `${prayer.label} validée +${xpGained} XP`,
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

  // Next prayer countdown
  const nextPrayer = useMemo(() => {
    const now = new Date();
    for (const p of PRAYERS) {
      const entry = getEntry(p.name);
      const time = entry?.custom_time || p.defaultTime;
      const [h, m] = time.split(":").map(Number);
      const pTime = new Date();
      pTime.setHours(h, m, 0, 0);
      if (pTime > now && !(entry?.completed)) {
        const diff = Math.floor((pTime.getTime() - now.getTime()) / 60000);
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return { label: p.label, icon: p.icon, time: `${hours}h ${mins}min` };
      }
    }
    return null;
  }, [entries]);

  return (
    <div className="min-h-screen bg-background pb-20 relative overflow-hidden">
      <GoldenParticles trigger={trigger} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🕌 Salat</h1>
          <p className="text-xs text-muted-foreground">Suivi spirituel quotidien</p>
        </motion.div>

        {/* Motivation */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-4 text-center border border-accent/20">
          <p className="text-xs text-accent italic">{motivation}</p>
        </motion.div>

        {/* Summary + Next Prayer */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 text-center">
            <CircularProgress value={completedCount} max={5} size={60} strokeWidth={4}>
              <span className="text-sm font-bold text-primary">{completedCount}</span>
            </CircularProgress>
            <p className="text-[10px] text-muted-foreground mt-1">Faites</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass rounded-2xl p-4 text-center">
            <CircularProgress value={onTimeCount} max={5} size={60} strokeWidth={4} glowColor="var(--glow-gold)">
              <span className="text-sm font-bold text-accent">{onTimeCount}</span>
            </CircularProgress>
            <p className="text-[10px] text-muted-foreground mt-1">À l'heure</p>
          </motion.div>
          {nextPrayer && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-4 text-center flex flex-col items-center justify-center">
              <span className="text-xl">{nextPrayer.icon}</span>
              <p className="text-[10px] text-foreground font-semibold mt-1">{nextPrayer.label}</p>
              <p className="text-[10px] text-accent font-bold">{nextPrayer.time}</p>
            </motion.div>
          )}
        </div>

        {/* Prayers */}
        {PRAYERS.map((prayer, i) => {
          const entry = getEntry(prayer.name);
          const done = entry?.completed || false;
          const onTime = entry?.on_time || false;
          const customTime = entry?.custom_time || prayer.defaultTime;
          const isMosque = mosqueDone[prayer.name];
          const isSunnah = sunnahDone[prayer.name];

          return (
            <motion.div key={prayer.name}
              initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
              className={`glass rounded-2xl overflow-hidden transition-all ${
                done && onTime ? "glow-border-gold" : done ? "glow-border-emerald" : ""
              }`}
            >
              <div className="p-4 flex items-center gap-4">
                {/* Animated icon */}
                <motion.div
                  animate={done ? { scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] } : {}}
                  transition={{ duration: 0.5 }}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${
                    done ? "bg-gradient-to-br from-primary/30 to-accent/20" : "bg-secondary/30"
                  }`}
                  style={done ? { boxShadow: "0 0 20px rgba(212, 175, 55, 0.3)" } : {}}
                >
                  {prayer.icon}
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-foreground">{prayer.label}</h3>
                    {done && onTime && (
                      <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-bold">À L'HEURE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {editingTime === prayer.name ? (
                      <input type="time" defaultValue={customTime}
                        onBlur={(e) => updateCustomTime(prayer.name, e.target.value)}
                        autoFocus className="bg-secondary/50 border border-border rounded px-2 py-0.5 text-xs text-foreground" />
                    ) : (
                      <button onClick={() => setEditingTime(prayer.name)}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                        ⏰ {customTime}
                      </button>
                    )}
                    <span className="text-[10px] text-primary font-semibold">+{isMosque ? prayer.xp * 2 : prayer.xp} XP</span>
                  </div>

                  {/* Sunnah & Mosque toggles */}
                  <div className="flex gap-2 mt-2">
                    {prayer.sunnah && (
                      <button onClick={() => setSunnahDone(s => ({ ...s, [prayer.name]: !s[prayer.name] }))}
                        className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${
                          isSunnah ? "bg-primary/20 border-primary text-primary" : "border-border/50 text-muted-foreground"
                        }`}>
                        {isSunnah ? "✓" : "○"} Rawatib ({prayer.sunnah})
                      </button>
                    )}
                    <button onClick={() => setMosqueDone(m => ({ ...m, [prayer.name]: !m[prayer.name] }))}
                      className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${
                        isMosque ? "bg-accent/20 border-accent text-accent" : "border-border/50 text-muted-foreground"
                      }`}>
                      {isMosque ? "✓" : "○"} Mosquée (x2)
                    </button>
                  </div>
                </div>

                <motion.button whileTap={{ scale: 0.85 }}
                  onClick={() => togglePrayer(prayer.name)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold transition-all ${
                    done ? "bg-primary text-primary-foreground" : "bg-secondary/50 border-2 border-border text-muted-foreground"
                  }`}
                  style={done ? { boxShadow: "0 0 16px rgba(16, 185, 129, 0.5)" } : {}}>
                  {done ? "✓" : "○"}
                </motion.button>
              </div>

              {done && entry?.completed_at && (
                <div className="px-4 pb-3">
                  <p className="text-[10px] text-muted-foreground">
                    Validée à {new Date(entry.completed_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
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
