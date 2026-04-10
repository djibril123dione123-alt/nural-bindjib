import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDuoPresence } from "@/hooks/useDuoPresence";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  /** Schéma distant : souvent `body` (NOT NULL) ; `content` possible selon migration. */
  body?: string | null;
  content?: string | null;
  created_at: string;
}

function messageText(m: Message) {
  return (m.body ?? m.content ?? "").trim();
}

export default function ChatContent() {
  const { user } = useAuth();
  const { partnerUserId } = useDuoPresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase.from("duo_messages").select("*").order("created_at", { ascending: true }).limit(100);
      if (data) setMessages(data as Message[]);
    };
    loadMessages();
    const channel = supabase.channel("duo-chat-mod").on("postgres_changes", { event: "INSERT", schema: "public", table: "duo_messages" }, (payload) => {
      setMessages(prev => [...prev, payload.new as Message]);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || !user) return;
    if (!partnerUserId) {
      toast.error("Partenaire introuvable", {
        description: "Liez d’abord votre alliance (deux comptes dans profiles) pour envoyer un message.",
      });
      return;
    }
    const text = input.trim();
    // Schéma distant : `body` NOT NULL est le plus ancien ; `content` peut être absent avant migration.
    const { error } = await supabase.from("duo_messages").insert({
      sender_id: user.id,
      receiver_id: partnerUserId,
      body: text,
    });
    if (error) {
      console.warn("[duo_messages]", error.message);
      toast.error("Message non envoyé", { description: error.message });
      return;
    }
    setInput("");
  };

  const isMe = (senderId: string) => senderId === user?.id;

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
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`flex ${isMe(msg.sender_id) ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isMe(msg.sender_id) ? "bg-primary/20 border border-primary/30 text-foreground" : "bg-accent/10 border border-accent/20 text-foreground"}`}>
              {messageText(msg)}
            </div>
          </motion.div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Doua, encouragement..."
          className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={send}
          disabled={!partnerUserId}
          className="px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40"
        >
          ↑
        </motion.button>
      </div>
    </div>
  );
}
