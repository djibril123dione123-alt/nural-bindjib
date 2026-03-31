import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    if (user) loadTodos();
  }, [user]);

  const loadTodos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_todos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setTodos(data as Todo[]);
  };

  const addTodo = async () => {
    if (!user || !newTitle.trim()) return;
    await supabase.from("user_todos").insert({ user_id: user.id, title: newTitle.trim() });
    setNewTitle("");
    loadTodos();
  };

  const toggleTodo = async (todo: Todo) => {
    await supabase.from("user_todos").update({ completed: !todo.completed }).eq("id", todo.id);
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          placeholder="Ajouter une tâche..."
          className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={addTodo}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
        >
          +
        </motion.button>
      </div>

      <AnimatePresence>
        {todos.map(todo => (
          <motion.div
            key={todo.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2"
          >
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => toggleTodo(todo)}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-all ${
                todo.completed
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {todo.completed ? "✓" : ""}
            </motion.button>

            {editingId === todo.id ? (
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => saveEdit(todo.id)}
                onKeyDown={e => e.key === "Enter" && saveEdit(todo.id)}
                autoFocus
                className="flex-1 bg-secondary/50 border border-border rounded px-2 py-1 text-sm text-foreground"
              />
            ) : (
              <span
                onClick={() => { setEditingId(todo.id); setEditTitle(todo.title); }}
                className={`flex-1 text-sm cursor-pointer ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
              >
                {todo.title}
              </span>
            )}

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => deleteTodo(todo.id)}
              className="text-xs text-destructive/60 hover:text-destructive"
            >
              ✕
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>

      {todos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Aucune tâche personnelle</p>
      )}
    </div>
  );
}
