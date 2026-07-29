import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData, UserRole } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

// Runtime remains null when configuration is missing, while the exported type
// prevents TypeScript from losing the prior null guard inside effect cleanup.
export const supabase = (
  isSupabaseConfigured ? createClient(url!, key!) : null
) as SupabaseClient;

export async function loadSharedData(): Promise<AppData | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("scheduler_state")
    .select("data")
    .eq("id", "default")
    .maybeSingle();

  if (error) throw error;
  return (data?.data as AppData | undefined) ?? null;
}

export async function saveSharedData(data: AppData, session: Session): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("scheduler_state").upsert({
    id: "default",
    data,
    updated_at: new Date().toISOString(),
    updated_by: session.user.id,
  });

  if (error) throw error;
}

export async function loadUserRole(userId: string): Promise<UserRole> {
  if (!isSupabaseConfigured) return "viewer";

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as UserRole | undefined) ?? "viewer";
}
