import { defineConfig, loadEnv } from 'vite';
import { parsePublicConfig, validatePreviewEnvironment } from './src/lib/config.ts';

const VERCEL_SYSTEM_PUBLIC_ENV = new Set([
  'VITE_VERCEL_ENV',
  'VITE_VERCEL_TARGET_ENV',
  'VITE_VERCEL_URL',
  'VITE_VERCEL_BRANCH_URL',
  'VITE_VERCEL_PROJECT_PRODUCTION_URL',
  'VITE_VERCEL_HASH_SALT',
  'VITE_VERCEL_DEPLOYMENT_ID',
  'VITE_VERCEL_PROJECT_ID',
  'VITE_VERCEL_REGION',
  'VITE_VERCEL_SKEW_PROTECTION_ENABLED',
  'VITE_VERCEL_GIT_PROVIDER',
  'VITE_VERCEL_GIT_REPO_SLUG',
  'VITE_VERCEL_GIT_REPO_OWNER',
  'VITE_VERCEL_GIT_REPO_ID',
  'VITE_VERCEL_GIT_COMMIT_REF',
  'VITE_VERCEL_GIT_COMMIT_SHA',
  'VITE_VERCEL_GIT_COMMIT_MESSAGE',
  'VITE_VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
  'VITE_VERCEL_GIT_COMMIT_AUTHOR_NAME',
  'VITE_VERCEL_GIT_PREVIOUS_SHA',
  'VITE_VERCEL_GIT_PULL_REQUEST_ID',
]);

export default defineConfig(({ mode, command }) => {
  // The local harness must not inspect dotenv files; its explicit process flag is sufficient.
  const loadedEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const localE2e = process.env.VITE_SKILLOS_LOCAL_E2E === 'true';
  if (localE2e && command === 'build') throw new Error('Local E2E is development-only and cannot be built for deployment.');
  const env = localE2e ? { VITE_SKILLOS_LOCAL_E2E: 'true' } : loadedEnv;
  const configuredPreview = validatePreviewEnvironment({ ...loadedEnv, ...process.env });
  const vercelPreview = (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'preview') || loadedEnv.VITE_VERCEL_ENV === 'preview';
  // The public-preview repository is intentionally a standalone, read-only
  // deployment. Vercel may build its default branch as Production and omit the
  // explicit VITE_SKILLOS_PUBLIC_PREVIEW setting, so identify this repository
  // at build time and inject the same flag used by local preview builds.
  const publicPreviewRepository = process.env.VERCEL === '1'
    && process.env.VERCEL_GIT_REPO_OWNER?.toLowerCase() === 'tebibu46-ship-it'
    && process.env.VERCEL_GIT_REPO_SLUG?.toLowerCase() === 'skillos-public-preview';
  const publicPreview = configuredPreview || vercelPreview || publicPreviewRepository;
  if (publicPreview && localE2e) throw new Error('Public preview cannot be combined with local E2E mode.');
  for (const name of Object.keys(env)) {
    const approved = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SKILLOS_LOCAL_E2E', 'VITE_SKILLOS_PUBLIC_PREVIEW'].includes(name);
    // Vercel owns this reserved framework-metadata namespace; arbitrary VITE_* names remain rejected.
    const vercelMetadata = VERCEL_SYSTEM_PUBLIC_ENV.has(name) || name.startsWith('VITE_VERCEL_');
    if (!approved && !vercelMetadata) {
      throw new Error('Unexpected public environment variable. Only approved SkillOS configuration is allowed.');
    }
  }
  if (!localE2e && !publicPreview) parsePublicConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return {
  build: { sourcemap: false },
  envPrefix: publicPreview ? ['VITE_SKILLOS_'] : 'VITE_',
  define: (vercelPreview || publicPreviewRepository) && !configuredPreview
    ? { 'import.meta.env.VITE_SKILLOS_PUBLIC_PREVIEW': JSON.stringify('true') }
    : undefined,
  server: {
    host: '127.0.0.1', port: 5174, strictPort: true,
    proxy: localE2e ? { '/__skillos_e2e': { target: 'http://127.0.0.1:54331', changeOrigin: false } } : undefined,
  },
  };
});
