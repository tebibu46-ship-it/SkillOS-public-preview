import type { Row } from './database';

// Contracts only. Phase 1 does not ship a scoring or recommendation implementation.
export type EngineName = 'opportunityScoring' | 'actionScoring' | 'recommendations'
  | 'mastery' | 'portfolioReadiness' | 'momentum' | 'blockers' | 'stall'
  | 'roadmap' | 'trendAnalysis';
export type SupportedRecord = { table: string; id: string };
export type EngineResult<T> =
  | { state: 'insufficient_data'; missing: string[] }
  | { state: 'available'; value: T; reasons: string[]; evidence: SupportedRecord[]; confidence: number };
export interface EngineContext {
  goals: readonly Row<'goals'>[];
  skills: readonly Row<'user_skills'>[];
  actions: readonly Row<'actions'>[];
  projects: readonly Row<'projects'>[];
  evidence: readonly Row<'evidence'>[];
  opportunities: readonly Row<'opportunities'>[];
  masteryEvents: readonly Row<'mastery_events'>[];
  trendSnapshots: readonly Row<'trend_snapshots'>[];
  asOf: string;
}
export interface EngineOutputs {
  opportunityScoring: { opportunityId: string; score: number }[];
  actionScoring: { actionId: string; score: number }[];
  recommendations: { actionId: string; estimatedMinutes: number | null };
  mastery: { userSkillId: string; mastery: number; basis: 'self_assessment' | 'assessment' };
  portfolioReadiness: { state: 'ready' | 'nearly_ready' | 'build_first'; missing: string[] };
  momentum: { score: number; direction: 'rising' | 'stable' | 'declining' };
  blockers: { record: SupportedRecord; reason: string; severity: 'high' | 'medium' | 'low' }[];
  stall: { state: 'active' | 'slowing' | 'stalled'; record: SupportedRecord };
  roadmap: { skillIds: string[] };
  trendAnalysis: { trendId: string; direction: 'emerging' | 'rising' | 'stable' | 'declining' }[];
}
export type EngineRegistry = { [K in EngineName]: (context: EngineContext) => EngineResult<EngineOutputs[K]> };
