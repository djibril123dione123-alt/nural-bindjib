import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { SURAHS } from "@/lib/surahData";
import { toast } from "sonner";

const TOTAL_VERSES = 6236;
const JUZ_COUNT = 30;

interface HifzEntry {
  id: string; surah_number: number; surah_name: string; start_verse: number; end_verse: number;
  total_verses: number; percentage: number; last_reviewed: string; review_count: number;
}

export default function HifzContent() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HifzEntry[]>([]);
  const [selectedSurah, setSelectedSurah] = useState(SURAHS[0]);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { trigger, fire } = useParticles();

  const filteredSurahs = useMemo(() => {
    if (!searchQuery) return SURAHS;
    const q = searchQuery.toLowerCase();
    return SURAHS.filter(s => s.name.toLowerCase().includes(q) || s.arabicName.includes(q) || String(s.number).includes(q));
  }, [searchQuery]);

  useEffect(() => { if (user) loadEntries(); }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    const { data } = await supabase.from("hifz_progress").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (data) setEntries(data as unknown as HifzEntry[]);
  };

  const percentage = useMemo(() => {
    const range = endVerse - startVerse + 1;
    return Math.min(100, Math.round((range / selectedSurah.verses) * 100));
  }, [startVerse, endVerse, selectedSurah]);

  const addEntry = async () => {
    if (!user) return;
    if (endVerse < startVerse) { toast.error("Verset fin ≥ verset début"); return; }
    const { error } = await supabase.from("hifz_progress").insert({
      user_id: user.id, surah_number: selectedSurah.number, surah_name: selectedSurah.name,
      start_verse: startVerse, end_verse: endVerse, total_verses: selectedSurah.verses, percentage,
    });
    if (!error) { fire(); toast.success(`${selectedSurah.name} ajouté ! +25 Baraka`); setShowForm(false); loadEntries(); }
  };

  const reviewEntry = async (entry: HifzEntry) => {
    await supabase.from("hifz_progress").update({
      last_reviewed: new Date().toISOString(), review_count: entry.review_count + 1, updated_at: new Date().toISOString(),
    }).eq("id", entry.id);
    fire(); toast.success(`Révision de ${entry.surah_name} ✨`); loadEntries();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("hifz_progress").delete().eq("id", id); loadEntries();
  };

  const totalProgress = useMemo(() => {
    if (entries.length === 0) return 0;
    const versesMemorized = entries.reduce((sum, e) => sum + (e.end_verse - e.start_verse + 1), 0);
    return Math.round((versesMemorized / TOTAL_VERSES) * 10000) / 100;
  }, [entries]);

  const totalVersesMemorized = entries.reduce((sum, e) => sum + (e.end_verse - e.start_verse + 1), 0);
  const daysSinceReview = (dateStr: string) => Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);

  const srsEntries = useMemo(() => {
    return [...entries]
      .map(e => ({ ...e, days: daysSinceReview(e.last_reviewed), urgency: daysSinceReview(e.last_reviewed) / Math.max(e.review_count, 1) }))
      .filter(e => e.days >= 2).sort((a, b) => b.urgency - a.urgency).slice(0, 5);
  }, [entries]);

  const juzProgress = useMemo(() => {
    const versesPerJuz = Math.ceil(TOTAL_VERSES / JUZ_COUNT);
    return Array.from({ length: JUZ_COUNT }, (_, i) => {
      const juzStart = i * versesPerJuz;
      const juzEnd = Math.min((i + 1) * versesPerJuz, TOTAL_VERSES);
      const overlap = Math.min(totalVersesMemorized, juzEnd) - Math.min(totalVersesMemorized, juzStart);
      return Math.max(0, Math.min(100, (overlap / (juzEnd - juzStart)) * 100));
    });
  }, [totalVersesMemorized]);

  return (
    <div className="relative overflow-hidden space-y-5">
      <GoldenParticles trigger={trigger} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 glow-border-gold">
        <div className="flex items-center gap-6">
          <CircularProgress value={totalProgress} max={100} size={100} strokeWidth={8} glowColor="var(--glow-gold)">
            <div className="text-center">
              <p className="text-lg font-bold text-accent">{totalProgress}%</p>
              <p className="text-[7px] text-muted-foreground uppercase">Coran</p>
            </div>
          </CircularProgress>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{entries.length} sourates</span>
              <span>{totalVersesMemorized}/{TOTAL_VERSES} versets</span>
            </div>
            <div className="grid grid-cols-15 gap-[2px]">
              {juzProgress.map((pct, i) => (
                <div key={i} className="h-3 rounded-sm transition-all" style={{
                  background: pct > 0 ? `linear-gradient(to top, hsl(var(--primary)) ${pct}%, hsl(var(--secondary)) ${pct}%)` : "hsl(var(--secondary))",
                }} title={`Juz ${i + 1}: ${Math.round(pct)}%`} />
              ))}
            </div>
            <p className="text-[8px] text-muted-foreground text-center">30 Juz du Mushaf</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowForm(!showForm); setShowReview(false); }}
          className="py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm">
          {showForm ? "Annuler" : "+ Ajouter"}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setShowReview(!showReview); setShowForm(false); }}
          className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${showReview ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground"}`}>
          🔄 SRS {srsEntries.length > 0 && <span className="ml-1 bg-accent text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full">{srsEntries.length}</span>}
        </motion.button>
      </div>

      <AnimatePresence>
        {showReview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-3">
            <div className="glass rounded-2xl p-4 border border-accent/30">
              <h3 className="text-xs uppercase tracking-wider text-accent font-bold mb-3">🧠 À réviser</h3>
              {srsEntries.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Tout est à jour ✨</p> : (
                <div className="space-y-2">
                  {srsEntries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between bg-secondary/30 rounded-xl p-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{entry.surah_name}</p>
                        <p className="text-[10px] text-muted-foreground">v.{entry.start_verse}–{entry.end_verse} • {entry.days}j</p>
                      </div>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => reviewEntry(entry)}
                        className="px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-xs text-accent font-bold">Réviser ✓</motion.button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl p-5 space-y-4 overflow-hidden">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher une sourate..."
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredSurahs.map(s => (
                <button key={s.number} onClick={() => { setSelectedSurah(s); setStartVerse(1); setEndVerse(s.verses); setSearchQuery(""); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${selectedSurah.number === s.number ? "bg-primary/20 border border-primary/30" : "hover:bg-secondary/80"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{s.number}</span>
                    <span className="text-foreground">{s.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.arabicName} • {s.verses}v</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Début</label>
                <input type="number" min={1} max={selectedSurah.verses} value={startVerse}
                  onChange={e => setStartVerse(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fin</label>
                <input type="number" min={1} max={selectedSurah.verses} value={endVerse}
                  onChange={e => setEndVerse(Math.min(selectedSurah.verses, parseInt(e.target.value) || 1))}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{selectedSurah.name} — {endVerse - startVerse + 1}/{selectedSurah.verses}</span>
                <span className="text-primary font-bold">{percentage}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" animate={{ width: `${percentage}%` }} />
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={addEntry}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm">Ajouter au Hifz</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {entries.map(entry => {
          const days = daysSinceReview(entry.last_reviewed);
          const needsReview = days >= 3;
          return (
            <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-2xl p-4 space-y-3 ${needsReview ? "border border-accent/40" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CircularProgress value={Number(entry.percentage)} max={100} size={44} strokeWidth={3}>
                    <span className="text-[9px] font-bold text-primary">{Math.round(Number(entry.percentage))}</span>
                  </CircularProgress>
                  <div>
                    <h3 className="font-display font-bold text-foreground text-sm">{entry.surah_number}. {entry.surah_name}</h3>
                    <p className="text-[10px] text-muted-foreground">v.{entry.start_verse}–{entry.end_verse} • {entry.review_count} rév.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => reviewEntry(entry)}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-semibold">✓</motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteEntry(entry.id)}
                    className="px-2 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">✕</motion.button>
                </div>
              </div>
              {needsReview && <p className="text-[10px] text-accent font-semibold">⚠️ Révision nécessaire ({days}j)</p>}
            </motion.div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">📖</p>
            <p className="text-sm font-display">Commencez votre parcours</p>
          </div>
        )}
      </div>
    </div>
  );
}
