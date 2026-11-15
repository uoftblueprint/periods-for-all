// F09: the real AuthService. Reuses the app's single Supabase client
// (lib/supabase.ts) and its existing session persistence/refresh settings.
//
// Do not import this into credentials-free preview routes. The /login preview
// keeps using createDemoAuth until the real path is intentionally selected (F10).

import type { AuthService } from '@/foundation/contracts';
import { supabase } from '@/lib/supabase';
import { createAuthFromClient } from './supabase-auth-adapter';
import type { SignUp } from './signup-contracts';
import { createSignUpFromClient } from './signup-service';

export function createSupabaseAuth(): AuthService {
  return createAuthFromClient(supabase.auth);
}

// S2R-10: real signup, using the same single client.
export function createSupabaseSignUp(): SignUp {
  return createSignUpFromClient(supabase.auth);
}