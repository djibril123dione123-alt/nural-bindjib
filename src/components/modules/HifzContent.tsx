// ============================================================
// HifzContent.tsx — Tracker Hifz + Loop Player intégrés
// Audio format : https://www.everyayah.com/data/{reciter}/{SSS}{AAA}.mp3
//   SSS = surah 3 chiffres, AAA = ayah 3 chiffres
// Retry réseau automatique × 2 avant de skipper l'ayah
// ============================================================

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CircularProgress } from "@/components/CircularProgress";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { SURAHS } from "@/lib/surahData";
import { toast } from "sonner";

// ── URL builder ──────────────────────────────────────────────
function buildAyahUrl(surahNum: number, ayah: number, reciterId: string): string {
  const s = String(surahNum).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  return `https://www.everyayah.com/data/${reciterId}/${s}${a}.mp3`;
}

const RECITERS = [
  { id: "Husary_64kbps",             name: "Al-Husary (Murattal)" },
  { id: "Alafasy_64kbps",            name: "Alafasy" },
  { id: "AbdulSamad_64kbps",         name: "Abdul Samad" },
  { id: "Minshawi_Murattal_128kbps", name: "Al-Minshawi" },
];

const TOTAL_VERSES = 6236;

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

// ════════════════════════════════════════════════════════════
// HIFZ LOOP PLAYER — Bulletproof A/B Repeat
// ════════════════════════════════════════════════════════════
function HifzLoopPlayer({ defaultSurah = 1 }: { defaultSurah?: number }) {
  const [surahNum,    setSurahNum]    = useState(defaultSurah);
  const [startAya,   setStartAya]    = useState(1);
  const [endAya,     setEndAya]      = useState(5);
  const [currentAya, setCurrentAya]  = useState(1);
  const [repetitions,setRepetitions] = useState(3);
  const [currentRep, setCurrentRep]  = useState(1);
  const [reciterId,  setReciterId]   = useState(RECITERS[0].id);
  const [isPlaying,  setIsPlaying]   = useState(false);
  const [isLoading,  setIsLoading]   = useState(false);
  const [loopCount,  setLoopCount]   = useState(0);
  const [netErrors,  setNetErrors]   = useState(0);
  const [showConfig, setShowConfig]  = useState(false);

  const isPlayingRef = useRef(false);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const surah = SURAHS.find((s) => s.number === surahNum) ?? SURAHS[0];

  useEffect(() => {
    if (isPlaying) stopAll();
    setStartAya(1);
    setEndAya(Math.min(5, surah.verses));
    setCurrentAya(1);
    setNetErrors(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNum]);

  const stopAll = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsLoading(false);
    if (retryRef.current) clearTimeout(retryRef.current);
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  // Jouer une ayah précise, avec retry
  const playAya = useCallback((aya: number, rep: number, retry = 0) => {
    if (!isPlayingRef.current) return;

    setCurrentAya(aya);
    setCurrentRep(rep);
    setIsLoading(true);

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current.pause();
      audioRef.current = null;
    }

    const url   = buildAyahUrl(surahNum, aya, reciterId);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.oncanplaythrough = () => {
      setIsLoading(false);
      setNetErrors(0);
      if (!isPlayingRef.current) return;
      audio.play().catch(() => {
        if (isPlayingRef.current) handleError(aya, rep, retry);
      });
    };

    audio.onended = () => {
      if (!isPlayingRef.current) return;
      if (rep < repetitions) {
        playAya(aya, rep + 1);
      } else {
        const next = aya + 1;
        if (next <= endAya) {
          playAya(next, 1);
        } else {
          setLoopCount((c) => c + 1);
          playAya(startAya, 1); // reboucle
        }
      }
    };

    audio.onerror = () => handleError(aya, rep, retry);
    audio.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahNum, reciterId, repetitions, endAya, startAya]);

  const handleError = useCallback((aya: number, rep: number, retry: number) => {
    if (!isPlayingRef.current) return;
    setIsLoading(false);
    setNetErrors((c) => c + 1);

    if (retry < 2) {
      console.warn(`[HifzLoop] Erreur ayah ${aya}, retry ${retry + 1}/2`);
      retryRef.current = setTimeout(() => playAya(aya, rep, retry + 1), 2000);
    } else {
      console.error(`[HifzLoop] Ayah ${aya} inaccessible — skip`);
      toast.warning(`Ayah ${aya} indisponible (réseau) — passage à la suivante`);
      const next = aya + 1;
      if (next <= endAya) {
        setTimeout(() => playAya(next, 1, 0), 500);
      } else {
        stopAll();
        toast.error("Boucle terminée — problème de connexion");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAya, stopAll]);

  const startLoop = useCallback(() => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    setLoopCount(0);
    setNetErrors(0);
    playAya(startAya, 1);
  }, [startAya, playAya]);

  useEffect(() => () => stopAll(), [stopAll]);

  const progress = endAya > startAya
    ? Math.max(2, ((currentAya - startAya) / (endAya - startAya)) * 100)
    : 0;

  return (
    <div className="glass rounded-2xl p-5 space-y-4 border border-primary/20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-display font-bold text-foreground">🔄 Hifz Loop</h3>
          <p className="text-[10px] text-muted-foreground">Répétition espacée ayah par ayah</p>
        </div>
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => setShowConfig(!showConfig)}
          className="text-[10px] px-2 py-1 rounded-lg border border-border text-muted-foreground">
          {showConfig ? "✕" : "⚙️ Config"}
        </motion.button>
      </div>

      {/* Sourate */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Sourate</label>
        <select value={surahNum} onChange={(e) => setSurahNum(Number(e.target.value))}
          disabled={isPlaying}
          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground disabled:opacity-50">
          {SURAHS.map((s) => (
            <option key={s.number} value={s.number}>
              {String(s.number).padStart(3, "0")} — {s.name} ({s.arabicName}) · {s.verses}v
            </option>
          ))}
        </select>
      </div>

      {/* Plage */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Ayah début", val: startAya, min: 1, max: surah.verses,
            set: (v: number) => { setStartAya(v); if (v > endAya) setEndAya(v); } },
          { label: "Ayah fin", val: endAya, min: startAya, max: surah.verses,
            set: (v: number) => setEndAya(Math.max(startAya, Math.min(surah.verses, v))) },
        ].map(({ label, val, min, max, set }) => (
          <div key={label}>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">{label}</label>
            <input type="number" min={min} max={max} value={val}
              onChange={(e) => set(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
              disabled={isPlaying}
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground disabled:opacity-50" />
          </div>
        ))}
      </div>

      {/* Config avancée */}
      <AnimatePresence>
        {showConfig && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Récitateur</label>
              <select value={reciterId} onChange={(e) => setReciterId(e.target.value)} disabled={isPlaying}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground disabled:opacity-50">
                {RECITERS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Répétitions par ayah : {repetitions}x
              </label>
              <input type="range" min={1} max={10} value={repetitions}
                onChange={(e) => setRepetitions(Number(e.target.value))}
                disabled={isPlaying} className="w-full accent-primary" />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>1×</span><span>5×</span><span>10×</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Résumé */}
      <div className="flex items-center justify-between glass rounded-xl px-3 py-2 text-xs">
        <span>
          <span className="font-bold text-primary">{surah.name}</span>
          <span className="text-muted-foreground"> · v.{startAya}–{endAya} · {repetitions}× chacune</span>
        </span>
        <span className="text-[9px] text-accent bg-accent/10 px-2 py-0.5 rounded-full font-mono">
          {String(surahNum).padStart(3,"0")}{String(startAya).padStart(3,"0")}.mp3
        </span>
      </div>

      {/* État lecture */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass rounded-xl p-3 space-y-2 border border-primary/30">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <motion.div className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }} />
                <span className="font-bold text-foreground">
                  {isLoading ? "Chargement..." : `Ayah ${currentAya} · rép. ${currentRep}/${repetitions}`}
                </span>
              </div>
              <span className="text-accent font-bold">🔄 {loopCount} boucle{loopCount > 1 ? "s" : ""}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>v.{startAya}</span>
              <span className="text-primary font-bold">v.{currentAya}</span>
              <span>v.{endAya}</span>
            </div>
            {netErrors > 0 && (
              <p className="text-[9px] text-amber-400">⚠️ {netErrors} erreur(s) réseau — retry auto</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contrôles */}
      {!isPlaying ? (
        <motion.button whileTap={{ scale: 0.97 }} onClick={startLoop}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm">
          ▶ Lancer la Boucle Hifz
        </motion.button>
      ) : (
        <motion.button whileTap={{ scale: 0.97 }} onClick={stopAll}
          className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive font-bold text-sm">
          ⏹ Arrêter
        </motion.button>
      )}

      <p className="text-[9px] text-muted-foreground text-center">
        Source : everyayah.com · {RECITERS.find((r) => r.id === reciterId)?.name}
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// HIFZ CONTENT — Tracker principal
// ════════════════════════════════════════════════════════════
export default function HifzContent() {
  const { user } = useAuth();
  const [entries, setEntries]         = useState<HifzEntry[]>([]);
  const [selectedSurah, setSelected]  = useState(SURAHS[0]);
  const [startVerse, setStartVerse]   = useState(1);
  const [endVerse, setEndVerse]       = useState(1);
  const [showForm, setShowForm]       = useState(false);
  const [showLoop, setShowLoop]       = useState(false);
  const [search, setSearch]           = useState("");
  const [loopSurah, setLoopSurah]     = useState(1);
  const { trigger, fire }             = useParticles();

  const filtered = useMemo(() => {
    if (!search) return SURAHS;
    const q = search.toLowerCase();
    return SURAHS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.arabicName.includes(q) || String(s.number).includes(q)
    );
  }, [search]);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("hifz_progress").select("*")
      .eq("user_id", user.id).order("updated_at", { ascending: false });
    if (data) setEntries(data as unknown as HifzEntry[]);
  };

  const pct = useMemo(() => {
    const range = endVerse - startVerse + 1;
    return Math.min(100, Math.round((range / selectedSurah.verses) * 100));
  }, [startVerse, endVerse, selectedSurah]);

  const addEntry = async () => {
    if (!user || endVerse < startVerse) { toast.error("Verset fin ≥ début"); return; }
    const s = Math.max(1, Number(startVerse) || 1);
    const e = Math.max(s, Number(endVerse) || s);
    const { error } = await supabase.from("hifz_progress").insert({
      user_id: user.id,
      surah_number: selectedSurah.number,
      surah_name: selectedSurah.name,
      start_verse: s,
      end_verse: e,
      ayah_start: s,
      ayah_end: e,
      total_verses: selectedSurah.verses,
      percentage: pct,
    });
    if (error) {
      console.warn("[hifz_progress]", error.message);
      toast.error("Hifz non enregistré", { description: error.message });
      return;
    }
    fire();
    toast.success(`${selectedSurah.name} ajouté !`);
    setShowForm(false);
    load();
  };

  const reviewEntry = async (entry: HifzEntry) => {
    await supabase.from("hifz_progress").update({
      last_reviewed: new Date().toISOString(),
      review_count: entry.review_count + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", entry.id);
    fire();
    toast.success(`Révision de ${entry.surah_name} ✨`);
    load();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("hifz_progress").delete().eq("id", id);
    load();
  };

  const totalPct = useMemo(() => {
    const v = entries.reduce((s, e) => s + (e.end_verse - e.start_verse + 1), 0);
    return Math.round((v / TOTAL_VERSES) * 10000) / 100;
  }, [entries]);

  const daysSince = (d: string) =>
    Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

  const srsEntries = useMemo(() =>
    [...entries]
      .map((e) => ({
        ...e,
        days: daysSince(e.last_reviewed),
        urgency: daysSince(e.last_reviewed) / Math.max(e.review_count, 1),
      }))
      .filter((e) => e.days >= 2)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5),
    [entries]
  );

  return (
    <div className="space-y-5 pb-4 relative overflow-hidden">
      <GoldenParticles trigger={trigger} />

      {/* Progression globale */}
      <div className="glass rounded-2xl p-5 glow-border-gold">
        <div className="flex items-center gap-4">
          <CircularProgress value={totalPct} max={100} size={80} strokeWidth={6}>
            <div className="text-center">
              <p className="text-base font-bold text-accent">{totalPct}%</p>
              <p className="text-[7px] text-muted-foreground">Coran</p>
            </div>
          </CircularProgress>
          <div className="flex-1 space-y-1 text-xs text-muted-foreground">
            <p>{entries.length} sourates mémorisées</p>
            <p>{entries.reduce((s, e) => s + (e.end_verse - e.start_verse + 1), 0)} / {TOTAL_VERSES} versets</p>
            {srsEntries.length > 0 && (
              <p className="text-accent font-bold">⚡ {srsEntries.length} révisions urgentes</p>
            )}
          </div>
        </div>
      </div>

      {/* Boutons actions */}
      <div className="grid grid-cols-3 gap-2">
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { setShowForm(!showForm); setShowLoop(false); }}
          className="py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-xs">
          {showForm ? "✕ Annuler" : "+ Ajouter"}
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { setShowLoop(!showLoop); setShowForm(false); }}
          className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${
            showLoop ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground"
          }`}>
          🔄 Loop
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { setShowForm(false); setShowLoop(false); }}
          className="py-2.5 rounded-xl border border-border text-muted-foreground font-bold text-xs">
          📋 Liste
        </motion.button>
      </div>

      {/* Formulaire ajout */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="glass rounded-2xl p-4 space-y-3 overflow-hidden">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une sourate..."
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="max-h-36 overflow-y-auto space-y-1">
              {filtered.map((s) => (
                <button key={s.number}
                  onClick={() => { setSelected(s); setStartVerse(1); setEndVerse(s.verses); setSearch(""); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
                    selectedSurah.number === s.number ? "bg-primary/20 border border-primary/30" : "hover:bg-secondary/80"
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6">{s.number}</span>
                    <span className="text-foreground">{s.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.arabicName} · {s.verses}v</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "V. début", val: startVerse, min: 1, max: selectedSurah.verses,
                  set: (v: number) => setStartVerse(Math.max(1, v)) },
                { label: "V. fin", val: endVerse, min: startVerse, max: selectedSurah.verses,
                  set: (v: number) => setEndVerse(Math.max(startVerse, Math.min(selectedSurah.verses, v))) },
              ].map(({ label, val, min, max, set }) => (
                <div key={label}>
                  <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
                  <input type="number" min={min} max={max} value={val}
                    onChange={(e) => set(parseInt(e.target.value) || min)}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
                </div>
              ))}
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                animate={{ width: `${pct}%` }} />
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={addEntry}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm">
              Ajouter au Hifz
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loop Player */}
      <AnimatePresence>
        {showLoop && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <HifzLoopPlayer defaultSurah={loopSurah} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Révisions urgentes (SRS) */}
      {!showForm && !showLoop && srsEntries.length > 0 && (
        <div className="glass rounded-2xl p-4 border border-accent/30 space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-accent font-bold">⚡ Révisions urgentes</h3>
          {srsEntries.map((e) => (
            <div key={e.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{e.surah_name}</p>
                <p className="text-[10px] text-muted-foreground">v.{e.start_verse}–{e.end_verse} · {e.days}j</p>
              </div>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setLoopSurah(e.surah_number); setShowLoop(true); setShowForm(false); }}
                  className="px-2 py-1 rounded-lg border border-primary/30 text-[10px] text-primary font-bold">🔄</motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => reviewEntry(e)}
                  className="px-2 py-1 rounded-lg bg-accent/20 border border-accent/30 text-[10px] text-accent font-bold">✓</motion.button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste des entrées */}
      {!showForm && !showLoop && (
        <div className="space-y-3">
          {entries.map((entry) => {
            const needsReview = daysSince(entry.last_reviewed) >= 3;
            return (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-2xl p-4 ${needsReview ? "border border-accent/40" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CircularProgress value={Number(entry.percentage)} max={100} size={44} strokeWidth={3}>
                      <span className="text-[9px] font-bold text-primary">{Math.round(Number(entry.percentage))}</span>
                    </CircularProgress>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{entry.surah_number}. {entry.surah_name}</h3>
                      <p className="text-[10px] text-muted-foreground">v.{entry.start_verse}–{entry.end_verse} · {entry.review_count} rév.</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => { setLoopSurah(entry.surah_number); setShowLoop(true); setShowForm(false); }}
                      className="px-2 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold">🔄</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => reviewEntry(entry)}
                      className="px-2 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-[10px] text-primary font-semibold">✓</motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteEntry(entry.id)}
                      className="px-2 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[10px] text-destructive">✕</motion.button>
                  </div>
                </div>
                {needsReview && (
                  <p className="text-[10px] text-accent font-semibold mt-2">
                    ⚠️ Révision nécessaire ({daysSince(entry.last_reviewed)}j)
                  </p>
                )}
              </motion.div>
            );
          })}
          {entries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-4xl mb-3">📖</p>
              <p className="text-sm font-display">Commencez votre parcours Hifz</p>
              <p className="text-xs mt-1 italic">« Iqra' bismi rabbika »</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
