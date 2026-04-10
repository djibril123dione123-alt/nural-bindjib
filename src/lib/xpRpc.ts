import { supabase } from "@/integrations/supabase/client";

type XpResult = {
  new_xp: number;
  new_level?: number;
  leveled_up?: boolean;
};

function toRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  if (typeof data === "object" && data !== null) return data as Record<string, unknown>;
  return null;
}

function isMissingRpc(err: any) {
  const msg = String(err?.message ?? "");
  const code = String(err?.code ?? "");
  return code === "PGRST202" || msg.includes("Could not find the function");
}

export async function applyXpDelta(userId: string, delta: number, source: string): Promise<XpResult> {
  const safeDelta = Number(delta);
  if (!Number.isFinite(safeDelta)) {
    throw new Error("XP invalide (undefined/NaN).");
  }

  const amount = Math.abs(Math.trunc(safeDelta));
  const rpcName = safeDelta >= 0 ? "add_xp" : "remove_xp";

  const { data, error } = await supabase.rpc(rpcName, {
    p_user_id: userId,
    p_amount: amount,
    p_source: source,
  });

  if (!error) {
    const row = toRow(data);
    const newXp = Number(row?.new_xp);
    if (!Number.isFinite(newXp)) throw new Error(`${rpcName}: réponse invalide`);
    const newLevel = Number(row?.new_level);
    return {
      new_xp: newXp,
      new_level: Number.isFinite(newLevel) ? newLevel : undefined,
      leveled_up: row?.leveled_up === true,
    };
  }

  // Fallback si RPC absente du cache PostgREST.
  if (!isMissingRpc(error)) throw new Error(error.message);

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("total_xp, level")
    .eq("id", userId)
    .single();
  if (profErr) throw new Error(`fallback profiles: ${profErr.message}`);

  const oldXp = Number(profile?.total_xp ?? 0);
  const nextXp = Math.max(0, oldXp + Math.trunc(safeDelta));

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ total_xp: nextXp })
    .eq("id", userId);
  if (upErr) throw new Error(`fallback update_xp: ${upErr.message}`);

  await supabase.from("xp_history").insert({
    user_id: userId,
    amount: Math.trunc(safeDelta),
    source,
  });

  return {
    new_xp: nextXp,
    new_level: Number(profile?.level ?? 1),
    leveled_up: false,
  };
}
