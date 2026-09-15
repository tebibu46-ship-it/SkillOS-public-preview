import type { Row } from '../domain/database';
import { ServiceError } from './errors';
import type { AdaptivePathStep } from './adaptive-path';
import type { CapabilityRecord } from './capability';
import type { DurableAssessment } from './assessment';
import type { EvidenceVerificationSnapshot } from './verification';
import { validateExperimentDefinition, type ExperimentAttempt, type ExperimentAttemptOutcome, type ExperimentResult, type LearningExperiment } from './experiments';
import type { NextBestAction, Source } from './learner';

export type ReconciliationState =
  | 'NO_ATTEMPT'
  | 'HISTORY_UNAVAILABLE'
  | 'ATTEMPT_INCOMPLETE'
  | 'ABANDONED_NO_OUTCOME'
  | 'EXPERIMENT_COMPLETED_NO_OUTCOME'
  | 'NEEDS_PRACTICE'
  | 'CURRENT_REQUIREMENT_SATISFIED'
  | 'NEEDS_EVIDENCE'
  | 'NEEDS_VERIFICATION'
  | 'VERIFICATION_REJECTED';

export type ReconciliationSnapshot = {
  observedAt: string;
  experimentId: string;
  attemptHistory: ExperimentAttemptOutcome[];
  activeAttempt: ExperimentAttemptOutcome | null;
  currentAttemptId: string | null;
  currentAttemptOutcome: ExperimentResult | 'NONE';
  assessmentHistory: DurableAssessment[];
  capabilityState: CapabilityRecord | null;
  adaptivePathState: AdaptivePathStep | null;
  reconciliationState: ReconciliationState;
  nextAction: NextBestAction;
  sourceIds: Source[];
};

export type CompleteExperimentHistory = {
  readonly attempts: readonly ExperimentAttempt[];
  readonly assessments: readonly DurableAssessment[];
  readonly historyComplete: true;
};

export type ReconciliationHistory = CompleteExperimentHistory | {
  readonly attempts: readonly [];
  readonly assessments: readonly [];
  readonly historyComplete: false;
};

export function unavailableExperimentHistory(): ReconciliationHistory {
  return Object.freeze({ attempts: Object.freeze([]) as readonly [], assessments: Object.freeze([]) as readonly [], historyComplete: false });
}
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
};
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value: unknown, maxLength?: number): value is string => typeof value === 'string' && value.trim().length > 0 && (maxLength === undefined || value.length <= maxLength);
const isNullableBoundedString = (value: unknown, maxLength: number): value is string | null => value === null || typeof value === 'string' && value.length <= maxLength;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const isNullableUuid = (value: unknown): value is string | null => value === null || isUuid(value);
const isTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isNullableTimestamp = (value: unknown): value is string | null => value === null || isTimestamp(value);
const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value);
const attemptStatuses = new Set(['PROPOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']);
const attemptResults = new Set(['NOT_EVALUATED', 'PASSED', 'PARTIAL', 'FAILED']);
const assessmentStatuses = new Set(['ATTEMPTED', 'PARTIAL', 'PASSED', 'INSUFFICIENT_EVIDENCE']);

export function isPersistedExperimentAttemptRow(value: unknown): value is Row<'learning_experiment_attempts'> {
  if (!isObject(value) || !isUuid(value.id) || !isUuid(value.user_id) || !isNonEmptyString(value.experiment_id) || (value.experiment_definition_version !== undefined && (!Number.isInteger(value.experiment_definition_version) || Number(value.experiment_definition_version) < 1)) || !isNonEmptyString(value.idempotency_key, 200)) return false;
  if (!['goal_id', 'project_id', 'action_id', 'session_id', 'assessment_id'].every(key => isNullableUuid(value[key]))) return false;
  if (!attemptStatuses.has(String(value.status)) || !attemptResults.has(String(value.result))) return false;
  if (!isNullableTimestamp(value.started_at) || !isNullableTimestamp(value.completed_at) || !isNullableTimestamp(value.abandoned_at) || !isNullableTimestamp(value.evaluated_at) || !isTimestamp(value.created_at) || !isTimestamp(value.updated_at) || !isRecord(value.provenance)) return false;
  if (value.status === 'IN_PROGRESS' && value.started_at === null) return false;
  if (value.status === 'COMPLETED' && (value.started_at === null || value.completed_at === null)) return false;
  if (value.status === 'ABANDONED' && value.abandoned_at === null) return false;
  if (value.result !== 'NOT_EVALUATED' && value.evaluated_at === null) return false;
  if (value.status !== 'COMPLETED' && value.result !== 'NOT_EVALUATED') return false;
  return true;
}
export function isPersistedAssessmentRow(value: unknown): value is Row<'learning_assessments'> {
  if (!isObject(value) || !isUuid(value.id) || !isUuid(value.user_id) || !isUuid(value.attempt_id) || !isRecord(value.contract_snapshot) || !isNonEmptyString(value.idempotency_key, 200)) return false;
  if (!isNullableBoundedString(value.response, 4000) || value.evaluator !== 'manual' || !assessmentStatuses.has(String(value.status)) || !isNullableBoundedString(value.feedback, 4000) || !isNullableTimestamp(value.evaluated_at) || !isRecord(value.provenance) || !isTimestamp(value.created_at) || !isTimestamp(value.updated_at)) return false;
  if (value.status !== 'ATTEMPTED' && value.evaluated_at === null) return false;
  if (value.response === null && value.status !== 'ATTEMPTED') return false;
  return true;
}
const persistedDefinitionParts = (value: Record<string, unknown>) => ({ definitionVersion: value.definition_version, steps: value.steps, acceptanceCriteria: value.acceptance_criteria, evidenceRequirements: value.evidence_requirements, constraints: value.constraints, successConditions: value.success_conditions });
const isPersistedExperimentDefinitionRow = (value: unknown): value is Row<'learning_experiments'> => isObject(value) && Object.prototype.hasOwnProperty.call(value, 'definition_version') && Object.prototype.hasOwnProperty.call(value, 'steps') && Object.prototype.hasOwnProperty.call(value, 'acceptance_criteria') && Object.prototype.hasOwnProperty.call(value, 'evidence_requirements') && Object.prototype.hasOwnProperty.call(value, 'constraints') && isNonEmptyString(value.id) && isUuid(value.user_id) && isUuid(value.skill_id) && isNullableUuid(value.goal_id) && isNullableUuid(value.project_id) && isNonEmptyString(value.template_key, 160) && isNonEmptyString(value.title, 240) && isNonEmptyString(value.objective, 4000) && validateExperimentDefinition(persistedDefinitionParts(value)) && (value.estimated_minutes === null || typeof value.estimated_minutes === 'number' && Number.isFinite(value.estimated_minutes) && value.estimated_minutes >= 0) && (value.evaluation_mode === 'deterministic' || value.evaluation_mode === 'manual') && isTimestamp(value.created_at) && isTimestamp(value.updated_at);
export const experimentDefinitionMatches = (row: Row<'learning_experiments'>, experiment: LearningExperiment, goalId: string | null, projectId: string | null) => { const persisted = persistedDefinitionParts(row as unknown as Record<string, unknown>); return row.id === experiment.id && row.skill_id === experiment.skillId && row.goal_id === goalId && row.project_id === projectId && row.template_key === experiment.templateKey && persisted.definitionVersion === experiment.definitionVersion && row.title === experiment.title && row.objective === experiment.objective && canonicalJson(persisted.successConditions) === canonicalJson(experiment.successConditions) && canonicalJson(persisted.steps) === canonicalJson(experiment.steps) && canonicalJson(persisted.acceptanceCriteria) === canonicalJson(experiment.acceptanceCriteria) && canonicalJson(persisted.evidenceRequirements) === canonicalJson(experiment.evidenceRequirements) && canonicalJson(persisted.constraints) === canonicalJson(experiment.constraints) && row.estimated_minutes === experiment.estimatedMinutes && row.evaluation_mode === experiment.evaluationMode; };
export function hydratePersistedExperimentDefinition(row: unknown, runtime: LearningExperiment): LearningExperiment {
  if (!isPersistedExperimentDefinitionRow(row) || !experimentDefinitionMatches(row, runtime, runtime.goalId, runtime.projectId)) throw new ServiceError('validation', 'The persisted experiment definition does not match the selected experiment contract.');
  const parts = persistedDefinitionParts(row as unknown as Record<string, unknown>);
  return { ...runtime, id: row.id, skillId: row.skill_id, goalId: row.goal_id, projectId: row.project_id, templateKey: row.template_key, definitionVersion: parts.definitionVersion as number, title: row.title, objective: row.objective, steps: (parts.steps as LearningExperiment['steps']).map(item => ({ ...item })), acceptanceCriteria: (parts.acceptanceCriteria as LearningExperiment['acceptanceCriteria']).map(item => ({ ...item })), constraints: (parts.constraints as LearningExperiment['constraints']).map(item => ({ ...item })), successConditions: [...(parts.successConditions as string[])], evidenceRequirements: (parts.evidenceRequirements as LearningExperiment['evidenceRequirements']).map(item => ({ ...item, criterionIds: [...item.criterionIds] })), estimatedMinutes: row.estimated_minutes, evaluationMode: row.evaluation_mode, createdAt: row.created_at };
}

export type ReconciliationInput = {
  observedAt: string;
  experiment: LearningExperiment | null;
  history: ReconciliationHistory;
  verifications?: ReadonlyMap<string, EvidenceVerificationSnapshot | null>;
  capabilityState: CapabilityRecord | null;
  adaptivePathState: AdaptivePathStep | null;
  nextAction: NextBestAction;
};

// The pure projection is implemented beside the private trust registry so it
// can validate exact history identity without exposing that registry.
export { reconcileLearningExperiment } from './data';
