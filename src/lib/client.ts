import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../domain/database';
import { isPublicPreview, parsePublicConfig, validatePreviewEnvironment } from './config';
import { createLocalE2EClient } from './local-e2e-client';

// Runtime identity for the application's own data client. This is deliberately
// kept in a WeakSet so a structural fake cannot opt into trusted history loading.
const initializedClients = new WeakSet<object>();

type QueryBuilder = Record<string, unknown>;
type QueryMethod = (...args: unknown[]) => unknown;

const queryMethodNames = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'or', 'textSearch', 'order', 'range', 'limit', 'gte', 'lt', 'single', 'maybeSingle', 'then'] as const;

function findMethod(value: object, name: string): QueryMethod | null {
  let current: object | null = value;
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name);
    if (descriptor && typeof descriptor.value === 'function') return descriptor.value as QueryMethod;
    current = Object.getPrototypeOf(current) as object | null;
  }
  return null;
}

function createImmutableDataSource(rawClient: SupabaseClient<Database>): SupabaseClient<Database> {
  const rawFrom = rawClient.from.bind(rawClient) as unknown as (table: string) => QueryBuilder;
  // Capture the query-builder implementations before the client is exposed.
  // Supabase returns different builder classes for reads and writes, so probe
  // each operation without executing any request and retain only method refs.
  const samples: QueryBuilder[] = [];
  const probe = (operation: string, payload?: unknown) => {
    try {
      const builder = rawFrom(`__skillos_capability_probe_${operation}`);
      const method = findMethod(builder, operation);
      if (method) samples.push((method.call(builder, ...(payload === undefined ? [] : [payload])) as QueryBuilder) || builder);
      else samples.push(builder);
    } catch {
      // A probe is local and best-effort; the read builder still supplies the
      // methods required by the trusted loader.
    }
  };
  const readProbe = rawFrom('__skillos_capability_probe_select');
  samples.push(readProbe);
  probe('select', '*');
  probe('insert', {});
  probe('update', {});
  probe('delete');
  probe('upsert', {});
  const methodSets = new Map<object, Map<string, QueryMethod>>();
  for (const sample of samples) {
    const prototype = Object.getPrototypeOf(sample) as object | null;
    if (!prototype) continue;
    const methods = methodSets.get(prototype) || new Map<string, QueryMethod>();
    for (const name of queryMethodNames) {
      const method = findMethod(sample, name);
      if (method && !methods.has(name)) methods.set(name, method);
    }
    methodSets.set(prototype, methods);
  }
  const resolveMethods = (builder: QueryBuilder): ReadonlyMap<string, QueryMethod> => {
    let prototype = Object.getPrototypeOf(builder) as object | null;
    while (prototype) {
      const methods = methodSets.get(prototype);
      if (methods) return methods;
      prototype = Object.getPrototypeOf(prototype) as object | null;
    }
    return new Map();
  };

  const wrapBuilder = (builder: QueryBuilder): QueryBuilder => {
    const facade: QueryBuilder = {};
    const methods = resolveMethods(builder);
    const wrapResult = (result: unknown) => result && typeof result === 'object' && methods.has('then')
      ? wrapBuilder(result as QueryBuilder)
      : result;
    for (const [name, method] of methods) {
      if (name === 'then') {
        facade.then = (onfulfilled?: unknown, onrejected?: unknown) => method.call(builder, onfulfilled, onrejected);
      } else {
        facade[name] = (...args: unknown[]) => {
          const result = method.apply(builder, args);
          return result === builder ? facade : wrapResult(result);
        };
      }
    }
    return Object.freeze(facade);
  };

  const from = (table: string) => wrapBuilder(rawFrom(table));
  return Object.freeze({ auth: rawClient.auth, from }) as unknown as SupabaseClient<Database>;
}

export function isInitializedClient(client: object): boolean {
  return initializedClients.has(client);
}

const registerInitializedClient = <T extends object>(client: T): T => {
  initializedClients.add(client);
  return client;
};

export function initializeClient(): SupabaseClient<Database> | null {
  const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? (typeof process !== 'undefined' ? process.env : {});
  if (isPublicPreview(runtimeEnv)) {
    validatePreviewEnvironment(runtimeEnv);
    return null;
  }
  // Explicit development-only escape hatch for the no-Docker PGlite browser harness.
  if (runtimeEnv.VITE_SKILLOS_LOCAL_E2E === 'true') {
    if (!runtimeEnv.DEV || typeof location === 'undefined' || location.hostname !== '127.0.0.1') throw new Error('Local E2E requires a loopback development runtime.');
    const rawClient = createLocalE2EClient() as unknown as SupabaseClient<Database>;
    return registerInitializedClient(createImmutableDataSource(rawClient));
  }
  const config = parsePublicConfig(runtimeEnv.VITE_SUPABASE_URL, runtimeEnv.VITE_SUPABASE_PUBLISHABLE_KEY);
  if (!config) return null;
  const rawClient = createClient<Database>(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
      }),
    },
  });
  return registerInitializedClient(createImmutableDataSource(rawClient));
}
export type Client = NonNullable<ReturnType<typeof initializeClient>>;
