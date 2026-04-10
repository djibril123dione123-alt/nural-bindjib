// =============================================================================
// src/components/modules/ChatContent.tsx
// Sprint 1 — Migré vers database.service.sendMessage (safeWrite)
// =============================================================================

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { sendMessage } from "@/services/database.service";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  body?: string;          // colonne legacy — affichage fallback
  created_at: string;
}

export default function ChatContent() {
  const { user } = useAuth();
  const { partnerUserId } = useDuoPresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Chargement initial ──────────────────────────────────────────────────
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("duo_messages")
        .select("id, sender_id, content, body, created_at")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as Message[]);
    };
    loadMessages();

    // Realtime — nouvelles lignes
    const channel = supabase
      .channel("duo-chat-content")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "duo_messages",
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Envoi via database.service ──────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;

    setSending(true);
    const { error } = await sendMessage(user.id, text, partnerUserId ?? null);
    setSending(false);

    if (error) {
      toast.error("Erreur d'envoi", { description: error.message });
      return;
    }

    setInput("");
  };

  const isMe = (senderId: string) => senderId === user?.id;

  // Affiche content en priorité, body en fallback (compat legacy)
  const displayText = (msg: Message) => msg.content || msg.body || "";

  return (
    <div className="flex flex-col" style={{ minHeight: "60vh" }}>
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-20">
            <p>🕊️ Espace sacré de l'Alliance</p>
            <p className="text-xs mt-1">Envoyez le premier mot doux...</p>
          </div>
        )}
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${isMe(msg.sender_id) ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                isMe(msg.sender_id)
                  ? "bg-primary/20 border border-primary/30 text-foreground"
                  : "bg-accent/10 border border-accent/20 text-foreground"
              }`}
            >
              {displayText(msg)}
            </div>
          </motion.div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Doua, encouragement..."
          disabled={sending}
          className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={send}
          disabled={sending || !input.trim()}
          className="px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40"
        >
          {sending ? "⏳" : "↑"}
        </motion.button>
      </div>
    </div>
  );
}
