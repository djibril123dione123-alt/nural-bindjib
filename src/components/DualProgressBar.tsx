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
}

export function DualProgressBar() {
  const { user } = useAuth();
  const [partners, setPartners] = useState<PartnerInfo[]>([]);

  useEffect(() => {
    loadBoth();
  }, [user]);

  const loadBoth = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, role");
    if (!profiles) return;

    const infos: PartnerInfo[] = [];
    for (const p of profiles) {
      const { data: progress } = await supabase
        .from("daily_progress")
        .select("total_xp")
        .eq("user_id", p.user_id)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      const xp = progress?.total_xp || 0;
      infos.push({
        name: p.display_name,
        totalXp: xp,
        level: calculateLevel(xp),
        emoji: p.role === "guardian" ? "🛡️" : "🧭",
      });
    }
    setPartners(infos);
  };

  if (partners.length < 2) return null;

  const maxLvl = 150;

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-display font-semibold text-primary flex items-center gap-2">
        📈 Ascension Parallèle
      </h3>
      {partners.map((p, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-foreground">{p.emoji} {p.name}</span>
            <span className="text-muted-foreground">Lvl {p.level}/150</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-primary/80 to-primary" : "bg-gradient-to-r from-accent/80 to-accent"}`}
              initial={{ width: 0 }}
              animate={{ width: `${(p.level / maxLvl) * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
