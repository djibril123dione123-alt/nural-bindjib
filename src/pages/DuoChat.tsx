import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const DuoChat = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("duo_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as Message[]);
    };
    loadMessages();

    const channel = supabase
      .channel("duo-chat")
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

  const send = async () => {
    if (!input.trim() || !user) return;
    await supabase.from("duo_messages").insert({
      sender_id: user.id,
      content: input.trim(),
    });
    setInput("");
  };

  const isMe = (senderId: string) => senderId === user?.id;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1 mb-4"
        >
          <h1 className="text-2xl font-display font-bold text-foreground">
            💬 Duo Chat
          </h1>
          <p className="text-xs text-muted-foreground">
            Douas & encouragements — Loin du bruit
          </p>
        </motion.div>

        {/* Messages */}
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
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                isMe(msg.sender_id)
                  ? "bg-primary/20 border border-primary/30 text-foreground"
                  : "bg-accent/10 border border-accent/20 text-foreground"
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Doua, encouragement..."
            className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={send}
            className="px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
          >
            ↑
          </motion.button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default DuoChat;
