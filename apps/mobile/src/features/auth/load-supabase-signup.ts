// S2R-10: loads the real Supabase signup only when called, so demo mode never
// loads Supabase (same idea as the lazy import in app/_layout.tsx).
// Kept in its own file so tests can replace it: Jest cannot intercept import().
import type { SignUp } from './signup-contracts';

export async function loadSupabaseSignUp(): Promise<SignUp> {
  const { createSupabaseSignUp } = await import('./supabase-auth');
  return createSupabaseSignUp();
}