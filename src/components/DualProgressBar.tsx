import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calculateLevel } from "@/lib/questData";

interface PartnerInfo {
  name: string;
  totalXp: number;
  level: number;
  emoji: string;
  role: string;
}

export function DualProgressBar() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PartnerInfo[]>([]);

  useEffect(() => {
    if (!user) return;
    loadBoth();

    // Realtime updates
    const channel = supabase
      .channel("dual-progress-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => loadBoth())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadBoth = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, role, total_xp, level");
    if (!profiles) return;

    setPartners(profiles.map((p: any) => ({
      name: p.display_name,
      totalXp: p.total_xp || 0,
      level: p.level || calculateLevel(p.total_xp || 0),
      emoji: p.role === "guardian" ? "🛡️" : "🧭",
      role: p.role,
    })));
  };

  if (partners.length < 2) return null;

  const maxLvl = 150;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-display font-semibold text-primary flex items-center gap-2">
        📈 Ascension Parallèle
      </h3>
      {partners.map((p, i) => {
        const barColor = p.role === "guardian"
          ? "bg-gradient-to-r from-pink-600/80 to-pink-400"
          : "bg-gradient-to-r from-blue-600/80 to-blue-400";
        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-foreground">{p.emoji} {p.name}</span>
              <span className="text-muted-foreground">Lvl {p.level}/150 • {p.totalXp} XP</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${(p.level / maxLvl) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
