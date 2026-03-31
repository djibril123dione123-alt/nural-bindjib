import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { PILLARS } from "@/lib/questData";
import { BottomNav } from "@/components/BottomNav";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const BilanSoir = () => {
  const { user } = useAuth();
  const { completed, dailyXp, totalXp, pillarProgress } = useQuestEngine();
  const [yesterdayXp, setYesterdayXp] = useState(0);
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("daily_progress")
      .select("daily_xp")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .single()
      .then(({ data }) => {
        if (data) setYesterdayXp(data.daily_xp || 0);
      });
  }, [user, yesterday]);

  const incompletePillars = useMemo(() => {
    return PILLARS.filter(p => {
      const required = p.quests.filter(q => !q.optional);
      return required.some(q => !completed[q.id]);
    });
  }, [completed]);

  const incompleteQuests = useMemo(() => {
    return PILLARS.flatMap(p =>
      p.quests.filter(q => !q.optional && !completed[q.id]).map(q => ({ ...q, pillar: p.name }))
    );
  }, [completed]);

  const xpDiff = dailyXp - yesterdayXp;

  const saveReflection = async () => {
    if (!user || !reflection.trim()) return;
    await supabase.from("journal_entries").insert({
      user_id: user.id,
      content: reflection,
      prompt_used: "Bilan du soir — Pourquoi certaines tâches n'ont pas été faites ?",
      mood_score: 3,
      visibility: "private",
    });
    toast.success("Réflexion enregistrée 🌙");
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">🌙 Bilan du Soir</h1>
          <p className="text-xs text-muted-foreground">Analyse et introspection de la journée</p>
        </motion.div>

        {/* Comparatif XP */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Comparatif</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Hier</p>
              <p className="text-lg font-bold text-foreground">{yesterdayXp} XP</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aujourd'hui</p>
              <p className="text-lg font-bold text-primary">{dailyXp} XP</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Différence</p>
              <p className={`text-lg font-bold ${xpDiff >= 0 ? "text-primary" : "text-destructive"}`}>
                {xpDiff >= 0 ? "+" : ""}{xpDiff} XP
              </p>
            </div>
          </div>
        </motion.div>

        {/* Pillar overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Piliers</h3>
          <div className="grid grid-cols-2 gap-3">
            {PILLARS.map(p => {
              const pct = pillarProgress[p.id] || 0;
              return (
                <div key={p.id}
                  className={`rounded-lg p-3 border ${pct === 100 ? "border-primary/40 bg-primary/5" : pct === 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-secondary/20"}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-foreground">{p.icon} {p.name}</span>
                    <span className={`text-xs font-bold ${pct === 100 ? "text-primary" : pct === 0 ? "text-destructive" : "text-foreground"}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Incomplete quests */}
        {incompleteQuests.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="glass rounded-xl p-5 space-y-3 border border-destructive/20">
            <h3 className="text-xs uppercase tracking-wider text-destructive font-semibold">⚠️ Quêtes non accomplies</h3>
            <div className="space-y-2">
              {incompleteQuests.map(q => (
                <div key={q.id} className="flex items-center gap-2 text-sm">
                  <span className="text-destructive/60">○</span>
                  <span className="text-foreground">{q.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{q.pillar}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Reflection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">📝 Auto-réflexion</h3>
          <p className="text-xs text-muted-foreground italic">Pourquoi certaines tâches n'ont-elles pas été faites ?</p>
          <Textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Sois honnête avec toi-même..."
            className="bg-secondary/30 border-border min-h-[100px] text-sm"
            disabled={saved}
          />
          {!saved ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={saveReflection}
              disabled={!reflection.trim()}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
            >
              Enregistrer la réflexion
            </motion.button>
          ) : (
            <p className="text-xs text-primary text-center">✓ Réflexion sauvegardée</p>
          )}
        </motion.div>

        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">🌙 La constance {">"} la motivation</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default BilanSoir;
