// =============================================================================
// src/hooks/useAuth.tsx
// Sprint 1 — Bug critique corrigé :
//   - fetchProfile utilise désormais .eq("id", userId) (PK = auth.uid())
//   - Plus aucune référence à l'ancienne colonne user_id dans la logique auth
//   - Ajout de total_xp, level et timezone dans le type Profile
//   - signUp crée le profil manuellement si le trigger DB est absent
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// ─── Type Profile aligné sur le schéma post-migrations ───────────────────────
// La PK est désormais `id` (= auth.uid()). La colonne `user_id` est obsolète.
// `timezone` est ajouté pour le Pilier 1.2 (Global Citizen).

export interface Profile {
  id: string;               // PK = auth.uid() — SOURCE DE VÉRITÉ
  display_name: string;
  role: "guide" | "guardian";
  avatar_emoji: string;
  total_xp: number;
  level: number;
  timezone: string;         // ex: "Africa/Dakar" | "America/Toronto" | "Europe/Paris"
  aura_color?: string;
  invite_code?: string;
  partner_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refetchProfile: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role: string,
  ) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Constante : profil vide par défaut ──────────────────────────────────────
const DEFAULT_TIMEZONE = "Africa/Dakar";

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Charge le profil par PK `id` = auth.uid() ────────────────────────────
  // IMPORTANT : on ne filtre PLUS sur `user_id`. La colonne `id` est la PK
  // liée à auth.users.id depuis la migration premium_consolidation.
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, role, avatar_emoji, total_xp, level, timezone, aura_color, invite_code, partner_id",
      )
      .eq("id", userId)          // ← CORRECTIF CRITIQUE : PK = id, pas user_id
      .maybeSingle();            // maybeSingle évite le 406 si la ligne n'existe pas encore

    if (error) {
      console.error("[AuthProvider] fetchProfile error:", error.message);
      return;
    }

    if (data) {
      setProfile({
        ...data,
        total_xp: data.total_xp ?? 0,
        level: data.level ?? 1,
        timezone: data.timezone ?? DEFAULT_TIMEZONE,
      } as Profile);
    } else {
      // Profil absent → peut arriver si le trigger handle_new_user a échoué
      console.warn("[AuthProvider] Profil introuvable pour id:", userId);
    }
  }, []);

  const refetchProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id);
  }, [user?.id, fetchProfile]);

  // ── Abonnement à l'état d'auth ─────────────────────────────────────────────
  useEffect(() => {
    // Chargement initial synchrone
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listener pour les changements d'état (login / logout / refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          // Petit délai pour laisser le trigger handle_new_user s'exécuter
          // en cas d'inscription fraîche
          setTimeout(() => fetchProfile(s.user.id), 400);
        } else {
          setProfile(null);
        }

        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Realtime : mise à jour du profil en temps réel ────────────────────────
  // Utile pour voir le total_xp / level changer sans reload
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-rt-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,  // filtre sur la PK correcte
        },
        (payload) => {
          const updated = payload.new as Partial<Profile>;
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  total_xp: updated.total_xp ?? prev.total_xp,
                  level: updated.level ?? prev.level,
                  display_name: updated.display_name ?? prev.display_name,
                  avatar_emoji: updated.avatar_emoji ?? prev.avatar_emoji,
                  timezone: updated.timezone ?? prev.timezone,
                  aura_color: updated.aura_color ?? prev.aura_color,
                  partner_id: updated.partner_id ?? prev.partner_id,
                }
              : prev,
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── signUp ────────────────────────────────────────────────────────────────
  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    role: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, role },
        emailRedirectTo: window.location.origin,
      },
    });

    // Si l'inscription réussit et que le trigger n'a pas créé le profil
    // (visible en dev avec email confirm désactivé), on le crée manuellement
    if (!error && data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: data.user.id,       // PK = auth.uid()
            display_name: displayName,
            role,
            avatar_emoji: role === "guardian" ? "🛡️" : "🧭",
            total_xp: 0,
            level: 1,
            timezone: DEFAULT_TIMEZONE,
          },
          { onConflict: "id" },
        );

      if (profileError) {
        // Non fatal : le trigger peut avoir déjà créé le profil
        console.warn("[signUp] upsert profil:", profileError.message);
      }
    }

    return { error };
  };

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        refetchProfile,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook consommateur ────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
