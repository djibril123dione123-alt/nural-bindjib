// ============================================================
// HifzLoopPlayer.tsx — Module Hifz Loop
// Lecteur avec sélection startAya/endAya, boucle infinie
// Format URL : 001001.mp3 (surah 3 digits + ayah 3 digits)
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SURAHS } from "@/lib/surahData";
import { toast } from "sonner";

// EveryAyah.com format : SSSSAAA (surah padded 3, ayah padded 3)
// Ex: Sourate 2, Ayah 255 → "002255.mp3"
function buildAyahUrl(surah: number, ayah: number, reciter = "Husary_64kbps"): string {
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  return `https://www.everyayah.com/data/${reciter}/${s}${a}.mp3`;
}

const RECITERS = [
  { id: "Husary_64kbps", name: "Al-Husary" },
  { id: "Alafasy_64kbps", name: "Alafasy" },
  { id: "AbdulSamad_64kbps", name: "Abdul Samad" },
  { id: "Minshawi_Murattal_128kbps", name: "Al-Minshawi" },
];

interface HifzLoopPlayerProps {
  defaultSurahNumber?: number;
}

export function HifzLoopPlayer({ defaultSurahNumber = 1 }: HifzLoopPlayerProps) {
  const selectedSurah = SURAHS.find(s => s.number === defaultSurahNumber) ?? SURAHS[0];

  const [surahNum, setSurahNum] = useState(selectedSurah.number);
  const [startAya, setStartAya] = useState(1);
  const [endAya, setEndAya] = useState(Math.min(5, selectedSurah.verses));
  const [currentAya, setCurrentAya] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [repetitions, setRepetitions] = useState(3); // répéter chaque ayah N fois
  const [currentRep, setCurrentRep] = useState(1);
  const [reciter, setReciter] = useState(RECITERS[0].id);
  const [showSettings, setShowSettings] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  const surahData = SURAHS.find(s => s.number === surahNum) ?? SURAHS[0];

  // Clamp endAya quand on change de sourate
  useEffect(() => {
    setStartAya(1);
    setEndAya(Math.min(5, surahData.verses));
    setCurrentAya(1);
    setCurrentRep(1);
    setLoopCount(0);
  }, [surahNum, surahData.verses]);

  const stopPlayback = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsLoading(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const playNextAya = useCallback((aya: number, rep: number) => {
    if (!isPlayingRef.current) return;

    setCurrentAya(aya);
    setCurrentRep(rep);
    setIsLoading(true);

    const url = buildAyahUrl(surahNum, aya, reciter);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("canplaythrough", () => {
      setIsLoading(false);
      if (isPlayingRef.current) {
        audio.play().catch(() => stopPlayback());
      }
    }, { once: true });

    audio.addEventListener("ended", () => {
      if (!isPlayingRef.current) return;

      // Si on doit répéter l'ayah actuelle
      if (rep < repetitions) {
        playNextAya(aya, rep + 1);
        return;
      }

      // Passer à l'ayah suivante
      const nextAya = aya + 1;
      if (nextAya <= endAya) {
        playNextAya(nextAya, 1);
      } else {
        // Fin de la plage → reboucler
        setLoopCount(prev => prev + 1);
        playNextAya(startAya, 1);
      }
    }, { once: true });

    audio.addEventListener("error", () => {
      setIsLoading(false);
      toast.error(`Impossible de charger l'ayah ${aya}`);
      stopPlayback();
    }, { once: true });

    audio.load();
  }, [surahNum, reciter, repetitions, endAya, startAya, stopPlayback]);

  const startPlayback = useCallback(() => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    setLoopCount(0);
    setCurrentRep(1);
    playNextAya(startAya, 1);
  }, [startAya, playNextAya]);

  const handleStop = () => {
    stopPlayback();
    setCurrentAya(startAya);
    setCurrentRep(1);
    setLoopCount(0);
  };

  const progress = ((currentAya - startAya) / Math.max(endAya - startAya, 1)) * 100;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-display font-bold text-foreground">🔄 Hifz Loop</h3>
          <p className="text-[10px] text-muted-foreground">Répétition espacée par ayah</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowSettings(!showSettings)}
          className="text-[10px] px-2 py-1 rounded-lg glass border border-border text-muted-foreground"
        >
          {showSettings ? "✕ Fermer" : "⚙️ Réglages"}
        </motion.button>
      </div>

      {/* Sélection de la sourate */}
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
          Sourate
        </label>
        <select
          value={surahNum}
          onChange={e => setSurahNum(Number(e.target.value))}
          disabled={isPlaying}
          className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        >
          {SURAHS.map(s => (
            <option key={s.number} value={s.number}>
              {String(s.number).padStart(3, "0")} — {s.name} ({s.arabicName}) — {s.verses}v
            </option>
          ))}
        </select>
      </div>

      {/* Plage Ayah */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
            Ayah début
          </label>
          <input
            type="number"
            min={1}
            max={surahData.verses}
            value={startAya}
            onChange={e => {
              const v = Math.max(1, Math.min(surahData.verses, parseInt(e.target.value) || 1));
              setStartAya(v);
              if (v > endAya) setEndAya(v);
            }}
            disabled={isPlaying}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
            Ayah fin
          </label>
          <input
            type="number"
            min={startAya}
            max={surahData.verses}
            value={endAya}
            onChange={e => {
              const v = Math.max(startAya, Math.min(surahData.verses, parseInt(e.target.value) || startAya));
              setEndAya(v);
            }}
            disabled={isPlaying}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Réglages avancés */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Récitateur
              </label>
              <select
                value={reciter}
                onChange={e => setReciter(e.target.value)}
                disabled={isPlaying}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                Répétitions par ayah : {repetitions}x
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={repetitions}
                onChange={e => setRepetitions(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full accent-primary disabled:opacity-50"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground">
                <span>1x</span><span>5x</span><span>10x</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Résumé de la plage */}
      <div className="glass rounded-xl p-3 flex items-center justify-between">
        <div className="text-xs text-foreground">
          <span className="font-bold text-primary">{surahData.name}</span>
          <span className="text-muted-foreground"> · v.{startAya}–{endAya}</span>
          <span className="text-muted-foreground"> · {endAya - startAya + 1} ayahs · {repetitions}x chacune</span>
        </div>
        <span className="text-[9px] text-accent bg-accent/10 px-2 py-0.5 rounded-full">
          {String(surahNum).padStart(3, "0")}{String(startAya).padStart(3, "0")}.mp3
        </span>
      </div>

      {/* Player actif */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl p-4 space-y-3 border border-primary/30"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                <span className="text-foreground font-bold">
                  {isLoading ? "Chargement..." : `Ayah ${currentAya} / rép. ${currentRep}/${repetitions}`}
                </span>
              </div>
              <span className="text-accent font-bold">🔄 {loopCount} boucles</span>
            </div>

            {/* Barre de progression dans la plage */}
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>v.{startAya}</span>
              <span className="text-primary">v.{currentAya}</span>
              <span>v.{endAya}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contrôles */}
      <div className="flex gap-3">
        {!isPlaying ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startPlayback}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-sm"
          >
            ▶ Lancer la Boucle Hifz
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleStop}
            className="flex-1 py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive font-bold text-sm"
          >
            ⏹ Arrêter
          </motion.button>
        )}
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        Audio : everyayah.com · Récitateur : {RECITERS.find(r => r.id === reciter)?.name}
      </p>
    </div>
  );
}
