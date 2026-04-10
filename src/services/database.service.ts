import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type DbWriteResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

export async function safeWrite<T>(
  operation: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  context: string,
): Promise<T> {
  const { data, error } = await operation;
  if (error) {
    console.error(`[DB:${context}]`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || `Erreur base de données (${context})`);
  }
  return data as T;
}

export async function removeTaskActivity(
  actorId: string,
  pillarOrTaskLabel: string,
  taskId?: string,
  eventType = "task",
) {
  const patterns = [
    `action.ilike.%[${pillarOrTaskLabel}]%`,
    `action.ilike.%${pillarOrTaskLabel}%`,
  ];
  if (taskId) patterns.push(`action.ilike.%(${taskId})%`);

  return safeWrite(
    supabase
      .from("activity_feed")
      .delete()
      .eq("actor_id", actorId)
      .eq("event_type", eventType)
      .or(patterns.join(",")),
    "activity_feed.delete_task_activity",
  );
}

export async function deleteActivityEntry(params: {
  actor_id: string;
  pillar: string;
  date: string; // YYYY-MM-DD
}) {
  const start = `${params.date}T00:00:00`;
  // Spéc: supprimer la ligne "validé [pillar] ..." du jour
  return safeWrite(
    supabase
      .from("activity_feed")
      .delete()
      .eq("actor_id", params.actor_id)
      .eq("event_type", "task")
      .gte("created_at", start)
      .ilike("action", `%validé [%${params.pillar}%]%`),
    "activity_feed.delete_validated_task_entry",
  );
}

export async function completeTaskWithXp(params: {
  task_id: string;
  pillar: string;
  xp_value: number;
  date: string; // YYYY-MM-DD
  completed: boolean;
}) {
  return safeWrite(
    supabase.rpc("complete_task_with_xp", {
      p_task_id: params.task_id,
      p_pillar: params.pillar,
      p_xp_value: params.xp_value,
      p_date: params.date,
      p_completed: params.completed,
    }),
    "rpc.complete_task_with_xp",
  );
}
