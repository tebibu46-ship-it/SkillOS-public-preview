export type PublicConfig = { url: string; key: string };

export type RuntimeEnvironment = Record<string, string | undefined>;

export function isPublicPreview(env: RuntimeEnvironment): boolean {
  return env.VITE_SKILLOS_PUBLIC_PREVIEW === 'true';
}

export function validatePreviewEnvironment(env: RuntimeEnvironment): boolean {
  const preview = isPublicPreview(env);
  if (!preview) return false;
  if (env.VITE_SKILLOS_LOCAL_E2E === 'true') throw new Error('Public preview cannot be combined with local E2E mode.');
  if (env.VITE_SUPABASE_URL?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) throw new Error('Public preview cannot contain Supabase configuration.');
  return true;
}

export function parsePublicConfig(url: string | undefined, key: string | undefined): PublicConfig | null {
  if (!url?.trim() && !key?.trim()) return null;
  if (!url?.trim() || !key?.trim()) throw new Error('Both public Supabase settings are required.');
  const parsed = new URL(url.trim());
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new Error('Use the Supabase project origin without a path or credentials.');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))) {
    throw new Error('Supabase requires HTTPS outside localhost.');
  }
  const publicKey = key.trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey)) {
    try {
      const parts = publicKey.split('.');
      if (parts.length !== 3) throw new Error();
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error();
    } catch {
      throw new Error('Only a publishable key or legacy anon key is allowed in the browser.');
    }
  }
  return { url: parsed.origin, key: publicKey };
}
