export type DailyActionCandidate = { id: string; status: string; priority?: number | null; due_at?: string | null; created_at?: string | null };
export type DailySessionCandidate = { status: string; duration_minutes?: number | null };

export function selectDailyActions<T extends DailyActionCandidate>(actions: readonly T[], limit = 3): T[] {
  const bounded = Math.max(1, Math.min(3, Math.trunc(limit)));
  return [...actions]
    .filter((action, index, rows) => rows.findIndex(candidate => candidate.id === action.id) === index)
    .sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER) || (a.due_at ? 0 : 1) - (b.due_at ? 0 : 1) || (a.due_at || '').localeCompare(b.due_at || '') || (b.created_at || '').localeCompare(a.created_at || '') || a.id.localeCompare(b.id))
    .slice(0, bounded);
}

export function dailySessionSummary(sessions: readonly DailySessionCandidate[]) {
  const completed = sessions.filter(session => session.status === 'completed');
  return { completedSessions: completed.length, learningMinutes: completed.reduce((total, session) => total + Math.max(0, session.duration_minutes || 0), 0) };
}
