import type { Session } from '@supabase/supabase-js';
import type { Client } from '../lib/client';
import { ServiceError, safeError } from './errors';

export function authService(client: Client) {
  return {
    subscribe(callback: (session: Session | null) => void) {
      // Never await another auth method inside the SDK callback: it holds an auth lock.
      return client.auth.onAuthStateChange((_event, session) => callback(session)).data.subscription;
    },
    async verifyUser() {
      const { data, error } = await client.auth.getUser();
      if (error) throw safeError(error);
      if (!data.user) throw new ServiceError('auth', 'Sign in to open your workspace.');
      return data.user;
    },
    async signIn(email: string, password: string) {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        if (error.code === 'invalid_credentials') throw new ServiceError('auth', 'Sign-in failed. Check your email and password.');
        if (error.code === 'email_not_confirmed') throw new ServiceError('auth', 'Confirm your email before signing in.');
        throw safeError(error);
      }
    },
    async signUp(email: string, password: string) {
      if (password.length < 12) throw new ServiceError('validation', 'Use a password with at least 12 characters.');
      const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      if (error) throw safeError(error);
      return { confirmationRequired: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw safeError(error);
    },
    async profile(verifiedUserId: string) {
      // RLS resolves the owner. No caller-supplied user ID is trusted.
      let { data, error } = await client.from('profiles').select('*').single();
      if (error?.code === 'PGRST116') {
        const initialized = await client.from('profiles').upsert({ id: verifiedUserId }, { onConflict: 'user_id', ignoreDuplicates: true });
        if (initialized.error) throw safeError(initialized.error);
        ({ data, error } = await client.from('profiles').select('*').single());
      }
      if (error) throw safeError(error);
      return data;
    },
  };
}
