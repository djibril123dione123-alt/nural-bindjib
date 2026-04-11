import { supabase } from "@/integrations/supabase/client";

// ─── Types & Erreurs ──────────────────────────────────────────────────────────

export interface WriteResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export class DatabaseError extends Error {
  constructor(
    public readonly context: string,
    public readonly supabaseCode: string | null,
    message: string,
  ) {
    super(`[${context}] ${message}`);
    this.name = "DatabaseError";
  }
}

// ─── Kernel ─────────────────────────────────────────────────────────────────

export async function safeWrite<T>(
  context: string,
  operation: Promise<{ data: T | null; error: any }>,
): Promise<WriteResult<T>> {
  try {
    const { data, error } = await operation;
    if (error) {
      const dbError = new DatabaseError(context, error.code ?? null, error.message ?? "Erreur inconnue");
      console.error(`[safeWrite] ${context}:`, error);
      return { data: null, error: dbError };
    }
    return { data, error: null };
  } catch (thrown: unknown) {
    const msg = thrown instanceof Error ? thrown.message : String(thrown);
    return { data: null, error: new DatabaseError(context, null, msg) };
  }
}

// ─── Todos (Répare TodoList.tsx) ───────────────────────────────────────────

export async function addTodo(userId: string, title: string): Promise<WriteResult<{ id: string }>> {
  return safeWrite(
    "addTodo",
    supabase.from("user_todos").insert({ user_id: userId, title: title.trim(), completed: false }).select("id").single()
  );
}

export async function toggleTodo(todoId: string, completed: boolean): Promise<WriteResult<null>> {
  return safeWrite(
    "toggleTodo",
    supabase.from("user_todos").update({ completed, updated_at: new Date().toISOString() }).eq("id", todoId) as any
  );
}

// ─── Missions & Lab (Répare AlterEgoLabContent.tsx) ─────────────────────────

/**
 * Répare l'erreur : "createMission" is not exported
 */
export async function createMission(userId: string, title: string, rewardXp: number): Promise<WriteResult<any>> {
  return safeWrite(
    "createMission",
    supabase
      .from("user_missions")
      .insert({
        user_id: userId,
        title: title.trim(),
        reward_xp: rewardXp,
        status: "active",
        created_at: new Date().toISOString()
      })
      .select("id")
      .single()
  );
}

/**
 * Répare l'erreur : "completeMission" is not exported
 */
export async function completeMission(missionId: string, userId: string, xpGain: number): Promise<WriteResult<null>> {
  return safeWrite(
    "completeMission",
    supabase.rpc("complete_user_mission", {
      p_mission_id: missionId,
      p_user_id: userId,
      p_xp_gain: xpGain
    }) as any
  );
}
// ─── Activité (Check final pour l'import manquant dans Index.tsx) ───────────

export async function insertActivity(payload: any) {
  return safeWrite(
    "insertActivity",
    supabase
      .from("activity_feed")
      .insert({ 
        xp_earned: 0, 
        ...payload,
        created_at: new Date().toISOString() 
      })
      .select("id")
      .single()
  );
}
/**
 * LA FONCTION MANQUANTE : updateTodoTitle
 */
export async function updateTodoTitle(todoId: string, title: string): Promise<WriteResult<null>> {
  return safeWrite(
    "updateTodoTitle",
    supabase.from("user_todos").update({ title: title.trim(), updated_at: new Date().toISOString() }).eq("id", todoId) as any
  );
}

export async function deleteTodo(todoId: string): Promise<WriteResult<null>> {
  return safeWrite(
    "deleteTodo",
    supabase.from("user_todos").delete().eq("id", todoId) as any
  );
}

// ─── Moteur de Quêtes & XP (useQuestEngine.ts) ──────────────────────────────

export async function completeTaskWithXp(params: {
  task_id: string;
  pillar: string;
  xp_value: number;
  date: string;
  completed: boolean;
}): Promise<WriteResult<any>> {
  return safeWrite(
    "completeTaskWithXp",
    supabase.rpc("complete_task_with_xp", {
      p_task_id: params.task_id,
      p_pillar: params.pillar,
      p_xp_value: params.xp_value,
      p_date: params.date,
      p_completed: params.completed,
    })
  );
}

export async function deleteActivityEntry(params: {
  actor_id: string;
  pillar: string;
  date: string;
}): Promise<WriteResult<null>> {
  const start = `${params.date}T00:00:00`;
  return safeWrite(
    "deleteActivityEntry",
    supabase
      .from("activity_feed")
      .delete()
      .eq("actor_id", params.actor_id)
      .eq("event_type", "task")
      .gte("created_at", start)
      .ilike("action", `%validé [%${params.pillar}%]%`) as any
  );
}

export async function removeTaskActivity(
  actorId: string,
  pillarOrTaskLabel: string,
  taskId?: string,
  eventType = "task"
): Promise<WriteResult<null>> {
  const patterns = [`action.ilike.%[${pillarOrTaskLabel}]%`, `action.ilike.%${pillarOrTaskLabel}%` ];
  if (taskId) patterns.push(`action.ilike.%(${taskId})%`);

  return safeWrite(
    "removeTaskActivity",
    supabase
      .from("activity_feed")
      .delete()
      .eq("actor_id", actorId)
      .eq("event_type", eventType)
      .or(patterns.join(",")) as any
  );
}

// ─── Sanctuary Time (useSanctuaryTime.ts) ───────────────────────────────────

export async function savePrayerTime(
  userId: string,
  prayerKey: string,
  newTime: string,
): Promise<WriteResult<null>> {
  return safeWrite(
    "savePrayerTime",
    supabase
      .from("sanctuary_settings")
      .upsert(
        {
          user_id: userId,
          prayer_name: prayerKey,
          custom_time: newTime,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,prayer_name" }
      ) as any
  );
}

// ─── Journal & Miroir ───────────────────────────────────────────────────────

export async function saveJournalEntry(payload: any) {
  return safeWrite("saveJournalEntry", supabase.from("journal_entries").insert(payload).select("id").single());
}

export async function sendMessage(senderId: string, content: string, receiverId: string | null = null) {
  return safeWrite("sendMessage", supabase.from("duo_messages").insert({
    sender_id: senderId, receiver_id: receiverId, content, body: content
  }).select("id").single());
}

export async function sendEncouragement(userId: string, role: string): Promise<WriteResult<null>> {
  const msg = role === "guide" ? "Djibril t'encourage ! 🤍" : "Binta t'encourage ! 🤍";
  return safeWrite("sendEncouragement", supabase.from("activity_feed").insert({
    actor_id: userId, user_id: userId, event_type: "social", event_label: "Encouragement", action: `💌 ${msg}`
  }) as any);
}

export async function insertActivity(payload: any) {
  return safeWrite("insertActivity", supabase.from("activity_feed").insert({ xp_earned: 0, ...payload }).select("id").single());
}
