// =============================================================================
// src/components/TodoList.tsx
// Sprint 1 — Migré vers database.service (safeWrite)
// Aucun supabase.from().insert/update/delete direct ici.
// =============================================================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GoldenParticles, useParticles } from "@/components/GoldenParticles";
import {
  addTodo as dbAddTodo,
  toggleTodo as dbToggleTodo,
  updateTodoTitle as dbUpdateTodoTitle,
  deleteTodo as dbDeleteTodo,
} from "@/services/database.service";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList({ showPartner = false }: { showPartner?: boolean }) {
  const { user, profile } = useAuth();
  const [todos, setTodos]             = useState<Todo[]>([]);
  const [partnerTodos, setPartnerTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle]       = useState("");
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editTitle, setEditTitle]     = useState("");
  const [activeTab, setActiveTab]     = useState<"mine" | "partner">("mine");
  const { trigger, fire }             = useParticles();

  useEffect(() => {
    if (user) {
      loadTodos();
      if (showPartner) loadPartnerTodos();
    }
  }, [user]);

  // ── Lecture ──────────────────────────────────────────────────────────────
  const loadTodos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_todos")
      .select("id, title, completed")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTodos(data as Todo[]);
  };

  const loadPartnerTodos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_todos")
      .select("id, title, completed")
      .neq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setPartnerTodos(data as Todo[]);
  };

  // ── Écriture via database.service ────────────────────────────────────────

  const addTodo = async () => {
    if (!user || !newTitle.trim()) return;
    const { error } = await dbAddTodo(user.id, newTitle);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    setNewTitle("");
    fire();
    loadTodos();
  };

  const toggleTodo = async (todo: Todo) => {
    const { error } = await dbToggleTodo(todo.id, !todo.completed);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    if (!todo.completed) fire();
    loadTodos();
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    const { error } = await dbUpdateTodoTitle(id, editTitle);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    setEditingId(null);
    loadTodos();
  };

  const deleteTodo = async (id: string) => {
    const { error } = await dbDeleteTodo(id);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    loadTodos();
  };

  const sendNudge = () => {
    toast.success("💌 Relance douce envoyée à ton partenaire !", {
      description: "Continue comme ça, on avance ensemble 🌟",
    });
    if (navigator.vibrate) navigator.vibrate(50);
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  const currentTodos  = activeTab === "mine" ? todos : partnerTodos;
  const myName        = profile?.role === "guide" ? "Djibril" : "Binta";
  const partnerName   = profile?.role === "guide" ? "Binta" : "Djibril";

  return (
    <div className="space-y-4 relative">
      <GoldenParticles trigger={trigger} />

      {/* Tab selector */}
      {showPartner && (
        <div className="flex gap-2 p-1 bg-secondary/30 rounded-xl">
          <button
            onClick={() => setActiveTab("mine")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "mine"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            📋 {myName}
          </button>
          <button
            onClick={() => setActiveTab("partner")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "partner"
                ? "bg-accent text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            💝 {partnerName}
          </button>
        </div>
      )}

      {/* Input ajout — uniquement onglet "mine" */}
      {activeTab === "mine" && (
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo()}
            placeholder="Ajouter une tâche..."
            className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addTodo}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-bold"
          >
            +
          </motion.button>
        </div>
      )}

      {/* Liste */}
      <AnimatePresence mode="popLayout">
        {currentTodos.map(todo => (
          <motion.div
            key={todo.id}
            layout
            initial={{ opacity: 0, x: activeTab === "mine" ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === "mine" ? -30 : 30 }}
            className="glass rounded-xl p-3 flex items-center gap-3"
          >
            {activeTab === "mine" && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => toggleTodo(todo)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  todo.completed
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
                style={todo.completed ? { boxShadow: "0 0 8px rgba(16,185,129,0.4)" } : {}}
              >
                {todo.completed ? "✓" : ""}
              </motion.button>
            )}

            {editingId === todo.id ? (
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => saveEdit(todo.id)}
                onKeyDown={e => e.key === "Enter" && saveEdit(todo.id)}
                autoFocus
                className="flex-1 bg-secondary/50 border border-border rounded-lg px-2 py-1 text-sm text-foreground"
              />
            ) : (
              <span
                onClick={() =>
                  activeTab === "mine"
                    ? (setEditingId(todo.id), setEditTitle(todo.title))
                    : undefined
                }
                className={`flex-1 text-sm ${
                  activeTab === "mine" ? "cursor-pointer" : ""
                } ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
              >
                {todo.title}
              </span>
            )}

            {activeTab === "mine" ? (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => deleteTodo(todo.id)}
                className="text-xs text-destructive/60 hover:text-destructive"
              >
                ✕
              </motion.button>
            ) : (
              !todo.completed && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={sendNudge}
                  className="text-[9px] px-2 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent font-bold"
                >
                  💌 Relance
                </motion.button>
              )
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {currentTodos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          {activeTab === "mine"
            ? "Aucune tâche personnelle"
            : `${partnerName} n'a pas encore de tâches`}
        </p>
      )}
    </div>
  );
}
