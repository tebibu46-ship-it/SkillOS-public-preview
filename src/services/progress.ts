export type ProgressGoal = { id: string; status?: string | null };
export type ProgressAction = { id: string; goal_id?: string | null; status?: string | null };
export type ProgressEvidence = { id: string; action_id?: string | null };
export type ReviewAction = ProgressAction & { created_at?: string | null; completed_at?: string | null };
export type ReviewEvidence = ProgressEvidence & { created_at?: string | null };

export type GoalProgress = {
  goalId: string;
  actionCount: number;
  completedActionCount: number;
  incompleteActionCount: number;
  actionsWithEvidenceCount: number;
  evidenceCount: number;
  completionRatio: number | null;
};

export type ProgressSummary = {
  goalCount: number;
  activeGoalCount: number;
  completedGoalCount: number;
  actionCount: number;
  completedActionCount: number;
  incompleteActionCount: number;
  actionsWithEvidenceCount: number;
  evidenceCount: number;
};

export type ReviewPeriod = { start: string; end: string; label: string };
export type ReviewActivity = {
  period: ReviewPeriod;
  goalCount: number;
  activeGoalCount: number;
  completedGoalCount: number;
  actionCount: number;
  completedActionCount: number;
  evidenceCount: number;
  actionsWithEvidenceCount: number;
  completionRatio: number | null;
};

export type LocalDayBounds = { date: string; start: string; end: string };
export type LearningHistoryPeriod = 'all' | '7d' | '30d';
export type LearningHistorySummary = { totalSessions: number; totalMinutes: number };

export function learningHistorySummary(sessions: Array<{ duration_minutes?: number | null }>): LearningHistorySummary {
  return { totalSessions: sessions.length, totalMinutes: sessions.reduce((total, session) => total + (session.duration_minutes || 0), 0) };
}

export function learningHistoryStart(period: LearningHistoryPeriod, now = new Date()): string | null {
  if (period === 'all') return null;
  const start = new Date(now);
  start.setDate(start.getDate() - (period === '7d' ? 6 : 29));
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function localDayBounds(now = new Date()): LocalDayBounds {
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const date = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  return { date, start: startDate.toISOString(), end: endDate.toISOString() };
}

export function isWithinLocalDay(value: string | null | undefined, day: LocalDayBounds): boolean {
  return !!value && value >= day.start && value < day.end;
}

export function sessionDurationMinutes(startedAt: string, completedAt: string): number {
  const elapsed = Date.parse(completedAt) - Date.parse(startedAt);
  return Math.max(0, Math.floor(elapsed / 60000));
}

function dayAfter(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function withinPeriod(value: string | null | undefined, period: ReviewPeriod): boolean {
  if (!value) return false;
  return value >= `${period.start}T00:00:00` && value < `${dayAfter(period.end)}T00:00:00`;
}

export function currentWeekPeriod(now = new Date()): ReviewPeriod {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  const end = date.toISOString().slice(0, 10);
  return { start, end, label: `${start} — ${end}` };
}

export function calculateReviewActivity(period: ReviewPeriod, goals: ProgressGoal[], actions: ReviewAction[], evidence: ReviewEvidence[]): ReviewActivity {
  const goalIds = new Set(goals.map(goal => goal.id));
  const periodActions = actions.filter(action => action.goal_id != null && goalIds.has(action.goal_id) && (withinPeriod(action.created_at, period) || withinPeriod(action.completed_at, period)));
  const actionIds = new Set(periodActions.map(action => action.id));
  const periodEvidence = evidence.filter(item => item.action_id != null && actionIds.has(item.action_id) && withinPeriod(item.created_at, period));
  const completedActionCount = periodActions.filter(action => action.status === 'completed' && withinPeriod(action.completed_at, period)).length;
  return {
    period,
    goalCount: goals.length,
    activeGoalCount: goals.filter(goal => goal.status === 'active').length,
    completedGoalCount: goals.filter(goal => goal.status === 'completed').length,
    actionCount: periodActions.length,
    completedActionCount,
    evidenceCount: periodEvidence.length,
    actionsWithEvidenceCount: new Set(periodEvidence.map(item => item.action_id)).size,
    completionRatio: periodActions.length ? completedActionCount / periodActions.length : null,
  };
}

export function calculateGoalProgress(goalId: string, actions: ProgressAction[], evidence: ProgressEvidence[]): GoalProgress {
  const goalActions = actions.filter(action => action.goal_id === goalId);
  const actionIds = new Set(goalActions.map(action => action.id));
  const goalEvidence = evidence.filter(item => item.action_id != null && actionIds.has(item.action_id));
  const evidenceActionIds = new Set(goalEvidence.map(item => item.action_id));
  const completedActionCount = goalActions.filter(action => action.status === 'completed').length;
  return {
    goalId,
    actionCount: goalActions.length,
    completedActionCount,
    incompleteActionCount: goalActions.length - completedActionCount,
    actionsWithEvidenceCount: evidenceActionIds.size,
    evidenceCount: goalEvidence.length,
    completionRatio: goalActions.length ? completedActionCount / goalActions.length : null,
  };
}

export function calculateProgressSummary(goals: ProgressGoal[], actions: ProgressAction[], evidence: ProgressEvidence[]): ProgressSummary {
  const goalIds = new Set(goals.map(goal => goal.id));
  const scopedActions = actions.filter(action => action.goal_id != null && goalIds.has(action.goal_id));
  const scopedActionIds = new Set(scopedActions.map(action => action.id));
  const scopedEvidence = evidence.filter(item => item.action_id != null && scopedActionIds.has(item.action_id));
  const completedActionCount = scopedActions.filter(action => action.status === 'completed').length;
  return {
    goalCount: goals.length,
    activeGoalCount: goals.filter(goal => goal.status === 'active').length,
    completedGoalCount: goals.filter(goal => goal.status === 'completed').length,
    actionCount: scopedActions.length,
    completedActionCount,
    incompleteActionCount: scopedActions.length - completedActionCount,
    actionsWithEvidenceCount: new Set(scopedEvidence.map(item => item.action_id)).size,
    evidenceCount: scopedEvidence.length,
  };
}
