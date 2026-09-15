type Session = { access_token: string; refresh_token: string; user: { id: string; email: string } };
type Listener = (event: string, session: Session | null) => void;
type Filter = { kind: string; column?: string; value?: unknown; values?: unknown[]; expression?: string };
const STORAGE_KEY = 'skillos.local-e2e.session.v1';

class LocalQuery {
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Record<string, unknown> | Record<string, unknown>[] | undefined;
  private filters: Filter[] = [];
  private orders: { column: string; ascending?: boolean; nullsFirst?: boolean }[] = [];
  private options: Record<string, unknown> = {};
  constructor(private readonly table: string) {}
  select(columns = '*') { this.options.select = columns; return this; }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload: Record<string, unknown>) { this.operation = 'update'; this.payload = payload; return this; }
  delete() { this.operation = 'delete'; return this; }
  upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.operation = 'upsert'; this.payload = payload; this.options = { ...this.options, onConflict: options?.onConflict }; return this; }
  eq(column: string, value: unknown) { this.filters.push({ kind: 'eq', column, value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ kind: 'neq', column, value }); return this; }
  in(column: string, values: unknown[]) { this.filters.push({ kind: 'in', column, values }); return this; }
  or(expression: string) { this.filters.push({ kind: 'or', expression }); return this; }
  textSearch(column: string, value: string) { this.filters.push({ kind: 'textSearch', column, value }); return this; }
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) { this.orders.push({ column, ...options }); return this; }
  range(from: number, to: number) { this.options.range = { from, to }; return this; }
  limit(limit: number) { this.options.limit = limit; return this; }
  gte(column: string, value: unknown) { this.filters.push({ kind: 'gte', column, value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ kind: 'lt', column, value }); return this; }
  single() { this.options.single = true; return this; }
  maybeSingle() { this.options.maybeSingle = true; return this; }
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) {
    const run = this.executeQuery(); return run.then(onfulfilled, onrejected);
  }
  private executeQuery() {
    return this.requestWithBody({ table: this.table, operation: this.operation, body: this.payload, filters: this.filters, orders: this.orders, ...this.options });
  }
  private async requestWithBody(body: Record<string, unknown>) {
    const response = await fetch('/__skillos_e2e/query', { method: 'POST', headers: new Headers({ 'content-type': 'application/json', ...authHeader() }), body: JSON.stringify(body) });
    return await response.json() as { data: unknown; error: unknown };
  }
}
function readSession(): Session | null { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Session | null; } catch { return null; } }
function authHeader(): Record<string, string> { const session = readSession(); return session ? { authorization: `Bearer ${session.access_token}` } : {}; }
export function createLocalE2EClient() {
  const listeners = new Set<Listener>();
  const notify = (event: string) => { const session = readSession(); for (const listener of listeners) listener(event, session); };
  const authenticate = async (path: string, email: string, password: string) => {
    const response = await fetch(`/__skillos_e2e/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const body = await response.json() as { data: { session: Session | null; user: { id: string; email: string } | null }; error: unknown };
    if (body.data?.session) { localStorage.setItem(STORAGE_KEY, JSON.stringify(body.data.session)); notify('SIGNED_IN'); }
    return body;
  };
  const auth = {
    onAuthStateChange(callback: Listener) { listeners.add(callback); queueMicrotask(() => callback('INITIAL_SESSION', readSession())); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
    async getUser() { const response = await fetch('/__skillos_e2e/auth/session', { headers: authHeader() }); const body = await response.json() as { data: { session: Session | null }; error: unknown }; return { data: { user: body.data.session?.user ?? null }, error: body.error }; },
    signInWithPassword({ email, password }: { email: string; password: string }) { return authenticate('sign-in', email, password); },
    signUp({ email, password }: { email: string; password: string }) { return authenticate('sign-up', email, password); },
    async signOut() { await fetch('/__skillos_e2e/auth/sign-out', { method: 'POST', headers: authHeader() }); localStorage.removeItem(STORAGE_KEY); notify('SIGNED_OUT'); return { error: null }; },
  };
  return { auth, from: (table: string) => new LocalQuery(table) } as unknown as { auth: typeof auth; from: (table: string) => LocalQuery };
}
