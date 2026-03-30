import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { SURAHS } from "@/lib/surahData";
import { toast } from "sonner";

interface HifzEntry {
  id: string;
  surah_number: number;
  surah_name: string;
  start_verse: number;
  end_verse: number;
  total_verses: number;
  percentage: number;
  last_reviewed: string;
  review_count: number;
}

const HifzTracker = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HifzEntry[]>([]);
  const [selectedSurah, setSelectedSurah] = useState(SURAHS[0]);
  const [startVerse, setStartVerse] = useState(1);
  const [endVerse, setEndVerse] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSurahs = useMemo(() => {
    if (!searchQuery) return SURAHS;
    const q = searchQuery.toLowerCase();
    return SURAHS.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.arabicName.includes(q) ||
      String(s.number).includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    loadEntries();
  }, [user]);

  const loadEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("hifz_progress")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setEntries(data as unknown as HifzEntry[]);
  };

  const percentage = useMemo(() => {
    const range = endVerse - startVerse + 1;
    return Math.min(100, Math.round((range / selectedSurah.verses) * 100));
  }, [startVerse, endVerse, selectedSurah]);

  const addEntry = async () => {
    if (!user) return;
    if (endVerse < startVerse) {
      toast.error("Le verset de fin doit être ≥ au verset de début");
      return;
    }

    const { error } = await supabase.from("hifz_progress").insert({
      user_id: user.id,
      surah_number: selectedSurah.number,
      surah_name: selectedSurah.name,
      start_verse: startVerse,
      end_verse: endVerse,
      total_verses: selectedSurah.verses,
      percentage,
    });

    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      toast.success(`${selectedSurah.name} ajouté au Hifz ! +25 Baraka`);
      setShowForm(false);
      setStartVerse(1);
      setEndVerse(1);
      loadEntries();
    }
  };

  const reviewEntry = async (entry: HifzEntry) => {
    await supabase.from("hifz_progress").update({
      last_reviewed: new Date().toISOString(),
      review_count: entry.review_count + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", entry.id);
    toast.success(`Révision de ${entry.surah_name} enregistrée ✨`);
    loadEntries();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("hifz_progress").delete().eq("id", id);
    loadEntries();
  };

  const totalProgress = useMemo(() => {
    if (entries.length === 0) return 0;
    const totalVersesMemorized = entries.reduce((sum, e) => sum + (e.end_verse - e.start_verse + 1), 0);
    const totalVerses = 6236;
    return Math.round((totalVersesMemorized / totalVerses) * 10000) / 100;
  }, [entries]);

  const daysSinceReview = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <h1 className="text-2xl font-display font-bold text-foreground">🕌 Hifz Tracker</h1>
          <p className="text-xs text-muted-foreground">Mémorisation du Saint Coran</p>
        </motion.div>

        {/* Global progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 space-y-3 glow-border-gold"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Progression globale</span>
            <span className="text-lg font-bold text-accent">{totalProgress}%</span>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent"
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ boxShadow: "0 0 12px rgba(212, 175, 55, 0.5)" }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{entries.length} sourates en cours</span>
            <span>6236 versets total</span>
          </div>
        </motion.div>

        {/* Add button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowForm(!showForm)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm"
        >
          {showForm ? "Annuler" : "+ Ajouter une sourate"}
        </motion.button>

        {/* Add form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass rounded-xl p-5 space-y-4 overflow-hidden"
            >
              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une sourate..."
                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />

              {/* Surah selector */}
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg">
                {filteredSurahs.map(s => (
                  <button
                    key={s.number}
                    onClick={() => {
                      setSelectedSurah(s);
                      setStartVerse(1);
                      setEndVerse(s.verses);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      selectedSurah.number === s.number
                        ? "bg-primary/20 border border-primary/30"
                        : "hover:bg-secondary/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-6">{s.number}</span>
                      <span className="text-foreground">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-arabic">{s.arabicName}</span>
                      <span className="text-[10px] text-muted-foreground">{s.verses}v</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Verse range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Verset début</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedSurah.verses}
                    value={startVerse}
                    onChange={e => setStartVerse(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Verset fin</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedSurah.verses}
                    value={endVerse}
                    onChange={e => setEndVerse(Math.min(selectedSurah.verses, parseInt(e.target.value) || 1))}
                    className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Preview progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {selectedSurah.name} — {endVerse - startVerse + 1}/{selectedSurah.verses} versets
                  </span>
                  <span className="text-primary font-bold">{percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    animate={{ width: `${percentage}%` }}
                    style={{ boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" }}
                  />
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={addEntry}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
              >
                Ajouter au Hifz
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entries list */}
        <div className="space-y-3">
          {entries.map(entry => {
            const days = daysSinceReview(entry.last_reviewed);
            const needsReview = days >= 3;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-xl p-4 space-y-3 ${needsReview ? "border border-accent/40" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-sm">
                      {entry.surah_number}. {entry.surah_name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      Versets {entry.start_verse}–{entry.end_verse} • {entry.review_count} révision{entry.review_count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary">{Number(entry.percentage)}%</span>
                </div>

                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{
                      width: `${entry.percentage}%`,
                      boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-[10px] ${needsReview ? "text-accent font-semibold" : "text-muted-foreground"}`}>
                    {needsReview ? `⚠️ Révision nécessaire (${days}j)` : `Révisé il y a ${days}j`}
                  </span>
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => reviewEntry(entry)}
                      className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary"
                    >
                      ✓ Révisé
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => deleteEntry(entry.id)}
                      className="px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                    >
                      ✕
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {entries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-3xl mb-2">📖</p>
              <p className="text-sm">Commencez votre parcours de mémorisation</p>
              <p className="text-xs mt-1">« Celui qui lit le Coran et le mémorise... »</p>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default HifzTracker;
