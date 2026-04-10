// =============================================================================
// src/pages/BilanSoir.tsx
// Sprint 1 — Migré vers database.service.saveJournalEntry (safeWrite)
// Correction : daily_progress utilise .maybeSingle() (plus de 406)
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuestEngine } from "@/hooks/useQuestEngine";
import { PILLARS } from "@/lib/questData";
import { BottomNav } from "@/components/BottomNav";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { Textarea } from "@/components/ui/textarea";
import { saveJournalEntry } from "@/services/database.service";
import { toast } from "sonner";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

const BilanSoir = () => {
  const { user, profile } = useAuth();
  const { dailyXp, totalXp, pillarProgress } = useQuestEngine();
  const [yesterdayXp, setYesterdayXp] = useState(0);
  const [partnerXp, setPartnerXp]     = useState(0);
  const [reflection, setReflection]   = useState("");
  const [gratitude, setGratitude]     = useState("");
  const [saved, setSaved]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const { trigger, fire }             = useParticles();

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const myName      = profile?.role === "guide" ? "Djibril" : "Binta";
  const partnerName = profile?.role === "guide" ? "Binta" : "Djibril";

  useEffect(() => {
    if (!user) return;

    // XP hier — .maybeSingle() évite le 406 si aucune ligne
    supabase
      .from("daily_progress")
      .select("daily_xp")
      .eq("user_id", user.id)
      .eq("date", yesterday)
      .maybeSingle()
      .then(({ data }) => { if (data) setYesterdayXp(data.daily_xp ?? 0); });

    // XP partenaire aujourd'hui — .maybeSingle()
    supabase
      .from("daily_progress")
      .select("daily_xp")
      .neq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => { if (data) setPartnerXp(data.daily_xp ?? 0); });
  }, [user, yesterday, today]);

  const xpDiff = dailyXp - yesterdayXp;

  const radarData = PILLARS.map(p => ({
    pillar: p.icon + " " + p.name,
    [myName]:      pillarProgress[p.id] ?? 0,
    [partnerName]: Math.floor(Math.random() * 100), // TODO Sprint 2 : données réelles
  }));

  // ── Sauvegarde via database.service ──────────────────────────────────────
  const saveAll = async () => {
    if (!user || saving) return;
    if (!gratitude.trim()) {
      toast.error("Écris au moins une gratitude 💛");
      return;
    }

    setSaving(true);
    const promises: Promise<any>[] = [];

    // Réflexion (optionnelle)
    if (reflection.trim()) {
      promises.push(
        saveJournalEntry({
          user_id:     user.id,
          content:     reflection,
          mood_score:  3,
          visibility:  "private",
          prompt_used: "Bilan du soir — Réflexion",
        }),
      );
    }

    // Gratitude (partagée)
    promises.push(
      saveJournalEntry({
        user_id:     user.id,
        content:     `💛 Gratitude pour ${partnerName}: ${gratitude}`,
        mood_score:  5,
        visibility:  "shared",
        prompt_used: "Bilan du soir — Gratitude partagée",
      }),
    );

    const results = await Promise.all(promises);
    const anyError = results.find(r => r.error);

    setSaving(false);

    if (anyError) {
      toast.error("Erreur de sauvegarde", {
        description: anyError.error?.message,
      });
      return;
    }

    fire();
    toast.success("Bilan enregistré 🌙");
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20 relative overflow-hidden">
      <GoldenParticles trigger={trigger} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-display font-bold text-gradient-emerald">
            🌙 Bilan du Soir
          </h1>
          <p className="text-xs text-muted-foreground">Analyse et introspection</p>
        </motion.div>

        {/* Comparatif XP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-4">
            Comparatif XP
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Hier</p>
              <p className="text-xl font-bold text-foreground">{yesterdayXp}</p>
            </div>
            <div>
              <CircularProgress value={dailyXp} max={150} size={70} strokeWidth={5}>
                <p className="text-lg font-bold text-primary">{dailyXp}</p>
              </CircularProgress>
              <p className="text-[10px] text-muted-foreground mt-1">Aujourd'hui</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Diff.</p>
              <p
                className={`text-xl font-bold ${
                  xpDiff >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {xpDiff >= 0 ? "+" : ""}
                {xpDiff}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
            Performance Alliance
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="pillar"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              />
              <Radar
                name={myName}
                dataKey={myName}
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
              <Radar
                name={partnerName}
                dataKey={partnerName}
                stroke="hsl(var(--accent))"
                fill="hsl(var(--accent))"
                fillOpacity={0.15}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {myName}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent" />
              {partnerName}
            </span>
          </div>
        </motion.div>

        {/* Piliers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            Piliers
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {PILLARS.map(p => {
              const pct = pillarProgress[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl p-3 border transition-all ${
                    pct === 100
                      ? "border-primary/40 bg-primary/5 glow-border-emerald"
                      : pct === 0
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border bg-secondary/20"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-foreground">
                      {p.icon} {p.name}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        pct === 100
                          ? "text-primary"
                          : pct === 0
                          ? "text-destructive"
                          : "text-foreground"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Gratitude (obligatoire) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-2xl p-5 space-y-3 glow-border-gold"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-accent font-bold">
            💛 Gratitude Partagée
          </h3>
          <p className="text-xs text-muted-foreground italic">
            Écris une chose positive sur {partnerName} aujourd'hui
          </p>
          <Textarea
            value={gratitude}
            onChange={e => setGratitude(e.target.value)}
            placeholder={`Merci ${partnerName} pour...`}
            className="bg-secondary/30 border-accent/30 min-h-[70px] text-sm"
            disabled={saved}
          />
        </motion.div>

        {/* Réflexion (optionnelle) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5 space-y-3"
        >
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
            📝 Auto-réflexion
          </h3>
          <p className="text-xs text-muted-foreground italic">
            Pourquoi certaines tâches n'ont-elles pas été faites ?
          </p>
          <Textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            placeholder="Sois honnête avec toi-même..."
            className="bg-secondary/30 border-border min-h-[80px] text-sm"
            disabled={saved}
          />
        </motion.div>

        {/* Bouton sauvegarde */}
        {!saved ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={saveAll}
            disabled={!gratitude.trim() || saving}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm disabled:opacity-40"
          >
            {saving ? "Enregistrement..." : "Clôturer la journée 🌙"}
          </motion.button>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-primary font-display font-bold">
              ✓ Journée clôturée
            </p>
            <p className="text-xs text-muted-foreground">
              La constance {">"} la motivation
            </p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default BilanSoir;
