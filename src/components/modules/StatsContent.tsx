import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { useAuth } from "@/hooks/useAuth";
import { getPillarsForRole } from "@/lib/questData";
import { CircularProgress } from "@/components/CircularProgress";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function StatsContent() {
  const { profile } = useAuth();
  const role = (profile?.role as "guide" | "guardian") || "guide";
  const pillars = getPillarsForRole(role);
  const { dailyXp, totalXp, pillarProgress } = useQuestEngine();

  const myName = role === "guide" ? "Djibril" : "Binta";
  const partnerName = role === "guide" ? "Binta" : "Djibril";

  const radarData = pillars.map(p => ({
    pillar: p.icon + " " + p.name,
    [myName]: pillarProgress[p.id] || 0,
    [partnerName]: Math.floor(Math.random() * 100),
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 text-center">
          <CircularProgress value={dailyXp} max={200} size={80} strokeWidth={6}>
            <p className="text-lg font-bold text-primary">{dailyXp}</p>
          </CircularProgress>
          <p className="text-[10px] text-muted-foreground mt-2">XP Aujourd'hui</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 text-center">
          <CircularProgress value={totalXp % 1000} max={1000} size={80} strokeWidth={6} glowColor="var(--glow-gold)">
            <p className="text-lg font-bold text-accent">{totalXp}</p>
          </CircularProgress>
          <p className="text-[10px] text-muted-foreground mt-2">XP Total</p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl p-5">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Radar des Piliers</h3>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="pillar" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <Radar name={myName} dataKey={myName} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
            <Radar name={partnerName} dataKey={partnerName} stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.15} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" />{myName}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" />{partnerName}</span>
        </div>
      </motion.div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Piliers</h3>
        <div className="grid grid-cols-2 gap-3">
          {pillars.map(p => {
            const pct = pillarProgress[p.id] || 0;
            return (
              <div key={p.id} className={`rounded-xl p-3 border transition-all ${pct === 100 ? "border-primary/40 bg-primary/5 glow-border-emerald" : pct === 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-secondary/20"}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-foreground">{p.icon} {p.name}</span>
                  <span className={`text-xs font-bold ${pct === 100 ? "text-primary" : pct === 0 ? "text-destructive" : "text-foreground"}`}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
