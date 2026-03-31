import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

const PRIORITY_TAGS = [
  { key: "urgent", label: "🔴 Urgent", color: "bg-destructive/20 text-destructive border-destructive/30" },
  { key: "focus", label: "🟡 Focus", color: "bg-accent/20 text-accent border-accent/30" },
  { key: "care", label: "💚 Care", color: "bg-primary/20 text-primary border-primary/30" },
];

export function TodoList({ showPartner = false }: { showPartner?: boolean }) {
  const { user, profile } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [partnerTodos, setPartnerTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [activeTab, setActiveTab] = useState<"mine" | "partner">("mine");
  const { trigger, fire } = useParticles();

  useEffect(() => {
    if (user) {
      loadTodos();
      if (showPartner) loadPartnerTodos();
    }
  }, [user]);

  const loadTodos = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_todos").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setTodos(data as Todo[]);
  };

  const loadPartnerTodos = async () => {
    if (!user) return;
    // Load todos from other users (partner)
    const { data } = await supabase.from("user_todos").select("*").neq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setPartnerTodos(data as Todo[]);
  };

  const addTodo = async () => {
    if (!user || !newTitle.trim()) return;
    await supabase.from("user_todos").insert({ user_id: user.id, title: newTitle.trim() });
    setNewTitle("");
    fire();
    loadTodos();
  };

  const toggleTodo = async (todo: Todo) => {
    await supabase.from("user_todos").update({ completed: !todo.completed }).eq("id", todo.id);
    if (!todo.completed) fire();
    loadTodos();
  };

  const deleteTodo = async (id: string) => {
    await supabase.from("user_todos").delete().eq("id", id);
    loadTodos();
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    await supabase.from("user_todos").update({ title: editTitle.trim() }).eq("id", id);
    setEditingId(null);
    loadTodos();
  };

  const sendNudge = () => {
    toast.success("💌 Relance douce envoyée à ton partenaire !", { description: "Continue comme ça, on avance ensemble 🌟" });
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const currentTodos = activeTab === "mine" ? todos : partnerTodos;
  const myName = profile?.role === "guide" ? "Djibril" : "Binta";
  const partnerName = profile?.role === "guide" ? "Binta" : "Djibril";

  return (
    <div className="space-y-4 relative">
      <GoldenParticles trigger={trigger} />

      {/* Tab selector */}
      {showPartner && (
        <div className="flex gap-2 p-1 bg-secondary/30 rounded-xl">
          <button onClick={() => setActiveTab("mine")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}>
            📋 {myName}
          </button>
          <button onClick={() => setActiveTab("partner")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "partner" ? "bg-accent text-primary-foreground" : "text-muted-foreground"
            }`}>
            💝 {partnerName}
          </button>
        </div>
      )}

      {/* Add input — only for own tasks */}
      {activeTab === "mine" && (
        <div className="flex gap-2">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo()}
            placeholder="Ajouter une tâche..."
            className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={addTodo}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-bold">+</motion.button>
        </div>
      )}

      {/* Todo items */}
      <AnimatePresence mode="popLayout">
        {currentTodos.map(todo => (
          <motion.div key={todo.id}
            layout
            initial={{ opacity: 0, x: activeTab === "mine" ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === "mine" ? -30 : 30 }}
            className="glass rounded-xl p-3 flex items-center gap-3"
          >
            {activeTab === "mine" && (
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => toggleTodo(todo)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  todo.completed ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"
                }`}
                style={todo.completed ? { boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)" } : {}}>
                {todo.completed ? "✓" : ""}
              </motion.button>
            )}

            {editingId === todo.id ? (
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                onBlur={() => saveEdit(todo.id)} onKeyDown={e => e.key === "Enter" && saveEdit(todo.id)}
                autoFocus className="flex-1 bg-secondary/50 border border-border rounded-lg px-2 py-1 text-sm text-foreground" />
            ) : (
              <span onClick={() => activeTab === "mine" ? (setEditingId(todo.id), setEditTitle(todo.title)) : null}
                className={`flex-1 text-sm ${activeTab === "mine" ? "cursor-pointer" : ""} ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {todo.title}
              </span>
            )}

            {activeTab === "mine" ? (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteTodo(todo.id)}
                className="text-xs text-destructive/60 hover:text-destructive">✕</motion.button>
            ) : (
              !todo.completed && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={sendNudge}
                  className="text-[9px] px-2 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent font-bold">
                  💌 Relance
                </motion.button>
              )
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {currentTodos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          {activeTab === "mine" ? "Aucune tâche personnelle" : `${partnerName} n'a pas encore de tâches`}
        </p>
      )}
    </div>
  );
}
