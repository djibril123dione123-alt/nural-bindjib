import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const WRITING_PROMPTS = [
  "Quelle victoire d'aujourd'hui t'a rendu(e) fier(e) ?",
  "Quel verset a apaisé ton cœur aujourd'hui ?",
  "Pour quoi es-tu reconnaissant(e) en ce moment ?",
  "Quel défi as-tu surmonté récemment ?",
  "Qu'est-ce que tu voudrais améliorer demain ?",
  "Décris un moment de Sakinah que tu as vécu.",
  "Qu'est-ce qui te rapproche d'Allah aujourd'hui ?",
];

const MOOD_LABELS = ["😞", "😔", "😐", "🙂", "😊"];

interface JournalEntry {
  id: string; content: string; mood_score: number; visibility: string; prompt_used: string | null; created_at: string;
}

async function saveJournalEntryCompat(payload: {
  user_id: string;
  content: string;
  mood_score: number;
  visibility: "private" | "shared";
  prompt_used: string | null;
}) {
  const attempts = [
    () => supabase.from("journal_entries").insert(payload),
    () => supabase.from("journal_entries").insert({
      user_id: payload.user_id,
      content: payload.content,
      mood_score: payload.mood_score,
      visibility: payload.visibility,
    }),
    () => supabase.from("journal_entries").insert({
      user_id: payload.user_id,
      content: payload.content,
    }),
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    const { error } = await attempt();
    if (!error) return null;
    lastError = error;
  }
  return lastError;
}

export default function JournalContent() {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(3);
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => { randomizePrompt(); loadEntries(); }, [user]);

  const randomizePrompt = () => setCurrentPrompt(WRITING_PROMPTS[Math.floor(Math.random() * WRITING_PROMPTS.length)]);

  const loadEntries = async () => {
    if (!user) return;
    const { data } = await supabase.from("journal_entries").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setEntries(data as unknown as JournalEntry[]);
  };

  const saveEntry = async () => {
    if (!user || !content.trim()) { toast.error("Écris quelque chose"); return; }
    const body = content.trim();
    const error = await saveJournalEntryCompat({
      user_id: user.id,
      content: body,
      mood_score: mood,
      visibility,
      prompt_used: currentPrompt || null,
    });
    if (error) {
      toast.error("Journal non enregistré", { description: error.message });
      return;
    }
    toast.success("Entrée sauvegardée 🌙");
    if (mood <= 2 && profile) {
      const partnerName = profile.role === "guide" ? "Binta" : "Djibril";
      toast.info(`${partnerName}, ${profile.display_name} a besoin d'un mot doux 💛`, { duration: 6000 });
    }
    setContent("");
    setMood(3);
    setShowEditor(false);
    randomizePrompt();
    loadEntries();
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 text-center space-y-3 glow-border-gold">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prompt du moment</p>
        <p className="text-sm font-display italic text-accent">{currentPrompt}</p>
        <button onClick={randomizePrompt} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">↻ Nouveau prompt</button>
      </motion.div>

      {!showEditor && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowEditor(true)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold text-sm">✍️ Écrire</motion.button>
      )}

      <AnimatePresence>
        {showEditor && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass rounded-xl p-5 space-y-4 overflow-hidden">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Comment te sens-tu ?</p>
              <div className="flex items-center justify-between gap-2">
                {MOOD_LABELS.map((emoji, i) => (
                  <motion.button key={i} whileTap={{ scale: 0.9 }} onClick={() => setMood(i + 1)}
                    className={`text-2xl p-2 rounded-xl transition-all ${mood === i + 1 ? "bg-primary/20 border-2 border-primary scale-110" : "opacity-40 hover:opacity-70"}`}>{emoji}</motion.button>
                ))}
              </div>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={currentPrompt} rows={6}
              className="w-full bg-secondary/30 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setVisibility("private")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${visibility === "private" ? "bg-primary/20 border border-primary text-primary" : "bg-secondary/50 border border-border text-muted-foreground"}`}>🔒 Privé</motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setVisibility("shared")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${visibility === "shared" ? "bg-accent/20 border border-accent text-accent" : "bg-secondary/50 border border-border text-muted-foreground"}`}>🔓 Partagé</motion.button>
            </div>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveEntry} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm">Sauvegarder</motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowEditor(false)} className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm">Annuler</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Entrées récentes</h2>
        {entries.map(entry => (
          <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{MOOD_LABELS[(entry.mood_score || 3) - 1]}</span>
                <span className="text-[10px] text-muted-foreground">{formatDate(entry.created_at)}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{entry.visibility === "shared" ? "🔓" : "🔒"}</span>
            </div>
            {entry.prompt_used && <p className="text-[10px] italic text-accent/60">{entry.prompt_used}</p>}
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{entry.content}</p>
          </motion.div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-3xl mb-2">🌙</p>
            <p className="text-sm">Votre journal est vide</p>
          </div>
        )}
      </div>
    </div>
  );
}
