// =============================================================================
// src/services/database.service.ts
// Couche unique d'écriture Supabase — Alliance Sanctuary Sprint 1
//
// RÈGLES :
//   1. Toute écriture en DB DOIT passer par ce fichier.
//   2. safeWrite<T> est le seul point d'entrée autorisé.
//   3. Jamais de supabase.from(...).insert/update/upsert/delete en dehors d'ici.
//   4. Chaque méthode métier appelle safeWrite et lève une erreur lisible.
// =============================================================================

import { supabase } from "@/integrations/supabase/client";

// ─── Types internes ──────────────────────────────────────────────────────────

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

/**
 * Fonction centrale d'écriture. Wrape toute opération Supabase et normalise
 * l'erreur en DatabaseError pour que l'UI ne reçoive jamais un objet PostgREST
 * brut et ne puisse pas mentir à l'utilisateur.
 *
 * @param context  Nom lisible de l'opération (ex: "saveJournalEntry")
 * @param operation Promesse Supabase à exécuter
 */
export async function safeWrite<T>(
  context: string,
  operation: Promise<{ data: T | null; error: any }>,
): Promise<WriteResult<T>> {
  try {
    const { data, error } = await operation;

    if (error) {
      const dbError = new DatabaseError(
        context,
        error.code ?? null,
        error.message ?? "Erreur inconnue",
      );
      console.error(`[safeWrite] ${context}:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return { data: null, error: dbError };
    }

    return { data, error: null };
  } catch (thrown: unknown) {
    const msg = thrown instanceof Error ? thrown.message : String(thrown);
    const dbError = new DatabaseError(context, null, msg);
    console.error(`[safeWrite] Exception dans ${context}:`, thrown);
    return { data: null, error: dbError };
  }
}

// =============================================================================
// MÉTHODES MÉTIER
// Chaque méthode :
//   - reçoit des paramètres typés
//   - construit le payload exact attendu par Supabase
//   - délègue à safeWrite
//   - retourne WriteResult<T> — jamais de throw silencieux
// =============================================================================

// ─── Journal ─────────────────────────────────────────────────────────────────

export interface JournalEntryPayload {
  user_id: string;
  content: string;
  mood_score: number;
  visibility: "private" | "shared";
  prompt_used: string | null;
}

export async function saveJournalEntry(
  payload: JournalEntryPayload,
): Promise<WriteResult<{ id: string }>> {
  return safeWrite(
    "saveJournalEntry",
    supabase
      .from("journal_entries")
      .insert(payload)
      .select("id")
      .single(),
  );
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface MessagePayload {
  sender_id: string;
  receiver_id: string | null;
  content: string;
  body: string; // colonne legacy — synchronisée avec content via trigger DB
}

export async function sendMessage(
  senderId: string,
  content: string,
  receiverId: string | null = null,
): Promise<WriteResult<{ id: string }>> {
  const payload: MessagePayload = {
    sender_id: senderId,
    receiver_id: receiverId,
    content,
    body: content, // trigger DB maintient la synchro ; on envoie les deux
  };
  return safeWrite(
    "sendMessage",
    supabase.from("duo_messages").insert(payload).select("id").single(),
  );
}

// ─── Missions Alter Ego ───────────────────────────────────────────────────────

export interface MissionPayload {
  from_user_id: string;
  to_user_id: string;
  title: string;
  description: string;
  xp: number;
}

export async function createMission(
  payload: MissionPayload,
): Promise<WriteResult<{ id: string }>> {
  return safeWrite(
    "createMission",
    supabase.from("alter_ego_missions").insert(payload).select("id").single(),
  );
}

export async function completeMission(
  missionId: string,
  actorId: string,
  missionTitle: string,
  xp: number,
): Promise<WriteResult<null>> {
  // 1. Marquer la mission comme complétée
  const missionResult = await safeWrite<null>(
    "completeMission:update",
    supabase
      .from("alter_ego_missions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", missionId) as any,
  );
  if (missionResult.error) return missionResult;

  // 2. Insérer dans l'activity feed (non bloquant si échoue)
  await safeWrite(
    "completeMission:activity",
    supabase.from("activity_feed").insert({
      actor_id: actorId,
      user_id: actorId,
      event_type: "mission",
      event_label: "Mission",
      action: `a terminé la mission "${missionTitle}"`,
      xp_earned: xp,
    }),
  );

  return { data: null, error: null };
}

// ─── Todos ───────────────────────────────────────────────────────────────────

export async function addTodo(
  userId: string,
  title: string,
): Promise<WriteResult<{ id: string }>> {
  return safeWrite(
    "addTodo",
    supabase
      .from("user_todos")
      .insert({ user_id: userId, title: title.trim(), completed: false })
      .select("id")
      .single(),
  );
}

export async function toggleTodo(
  todoId: string,
  completed: boolean,
): Promise<WriteResult<null>> {
  return safeWrite<null>(
    "toggleTodo",
    supabase
      .from("user_todos")
      .update({ completed, updated_at: new Date().toISOString() })
      .eq("id", todoId) as any,
  );
}

export async function updateTodoTitle(
  todoId: string,
  title: string,
): Promise<WriteResult<null>> {
  return safeWrite<null>(
    "updateTodoTitle",
    supabase
      .from("user_todos")
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq("id", todoId) as any,
  );
}

export async function deleteTodo(todoId: string): Promise<WriteResult<null>> {
  return safeWrite<null>(
    "deleteTodo",
    supabase.from("user_todos").delete().eq("id", todoId) as any,
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

export interface ActivityPayload {
  actor_id: string;
  user_id: string;
  event_type: string;
  event_label: string;
  action: string;
  xp_earned?: number;
}

export async function insertActivity(
  payload: ActivityPayload,
): Promise<WriteResult<{ id: string }>> {
  return safeWrite(
    "insertActivity",
    supabase
      .from("activity_feed")
      .insert({ xp_earned: 0, ...payload })
      .select("id")
      .single(),
  );
}

export async function deleteTaskActivity(
  actorId: string,
  pillar: string,
  taskId?: string,
): Promise<WriteResult<null>> {
  let query = supabase
    .from("activity_feed")
    .delete()
    .eq("actor_id", actorId)
    .eq("event_type", "task");

  // Filtre sur la date du jour (UTC) pour ne pas supprimer l'historique
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  query = query.gte("created_at", todayStart.toISOString());

  // Filtre par taskId en priorité, sinon par pilier
  if (taskId) {
    query = query.ilike("action", `%(${taskId})%`);
  } else {
    query = query.ilike("action", `%[${pillar}]%`);
  }

  return safeWrite<null>("deleteTaskActivity", query as any);
}

// ─── Sanctuary Settings (heures de prière) ───────────────────────────────────

export async function savePrayerTime(
  userId: string,
  prayerKey: string,
  newTime: string,
): Promise<WriteResult<null>> {
  // Tentative 1 : upsert par user_id + prayer_name
  const result = await safeWrite<null>(
    "savePrayerTime:upsert",
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
        { onConflict: "user_id,prayer_name" },
      ) as any,
  );

  if (!result.error) return result;

  // Tentative 2 : fallback legacy (prayer_name seul, schéma sans user_id)
  console.warn("[savePrayerTime] Fallback vers onConflict:prayer_name");
  return safeWrite<null>(
    "savePrayerTime:fallback",
    supabase
      .from("sanctuary_settings")
      .upsert(
        {
          prayer_name: prayerKey,
          custom_time: newTime,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "prayer_name" },
      ) as any,
  );
}

// ─── Encouragement (Miroir) ───────────────────────────────────────────────────

export async function sendEncouragement(
  userId: string,
  role: string,
): Promise<WriteResult<null>> {
  const message =
    role === "guide"
      ? "Djibril pense à toi et t'encourage pour ton Master ! 🤍"
      : "Binta pense à toi et t'encourage ! 🤍";

  return safeWrite<null>(
    "sendEncouragement",
    supabase.from("activity_feed").insert({
      actor_id: userId,
      user_id: userId,
      event_type: "social",
      event_label: "Encouragement",
      action: `💌 ${message}`,
      xp_earned: 0,
    }) as any,
  );
}
