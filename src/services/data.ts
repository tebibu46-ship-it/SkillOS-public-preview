import type { Client } from '../lib/client';
import { isInitializedClient } from '../lib/client';
import type { Row, TableName } from '../domain/database';
import { ServiceError, safeError } from './errors';
import { actionDueAt, actionStatus, actionTitle, evidenceContent, evidenceNotes, evidenceTitle, evidenceType, evidenceUrl, goalDeadline, goalSkillId, goalStatus, goalTargetMastery, goalTitle, pageBounds, projectDescription, projectStatus, projectTitle, reflectionContent, reflectionDate, reflectionText, resourceProvider, resourceSource, resourceTitle, resourceType, resourceUrl, sessionNotes, skillStatus, type ResourceType, type SkillStatus } from './validation';
import { catalogPageRange, skillFilters, type CatalogSkill, type SkillCatalogFilters } from './skills';
import { calculateGoalProgress, calculateProgressSummary, calculateReviewActivity, currentWeekPeriod, learningHistoryStart, learningHistorySummary, localDayBounds, sessionDurationMinutes, type LearningHistoryPeriod, type ReviewPeriod } from './progress';
import { resolveRoadmap } from './roadmap';
import { calculateSkillMastery } from './mastery';
import { selectSkillGap } from './gaps';
import { dailySessionSummary, selectDailyActions } from './daily';
import { loadLearningContext } from './learning-context';
import { generateAdaptiveLearningPath, type AdaptiveAssessment, type AdaptivePathStep } from './adaptive-path';
import { deriveProjectProofs, type ProjectProof } from './project-proof';
import { createExperimentAttempt, deriveExperimentOutcomeSnapshot, experimentTemplates, normalizeExperimentTemplateDefinition, recordExperimentResult, selectLearningExperiment, transitionExperimentAttempt, type ExperimentAttempt, type ExperimentAttemptOutcome, type ExperimentLifecycle, type ExperimentResult, type ExperimentOutcomeSnapshot, type LearningExperiment } from './experiments';
import { deriveCapabilitySnapshot, type CapabilityRecord } from './capability';
import { verifyExperimentEvidence, type EvidenceVerificationSnapshot, type VerificationState } from './verification';
import { assessmentContractSnapshot, assessManualAttempt, durableAssessmentStatus, latestAssessment, type AssessmentPrompt, type AssessmentStatus, type DurableAssessment } from './assessment';
import { experimentDefinitionMatches, hydratePersistedExperimentDefinition, isPersistedAssessmentRow, isPersistedExperimentAttemptRow, unavailableExperimentHistory, type CompleteExperimentHistory, type ReconciliationHistory, type ReconciliationInput, type ReconciliationSnapshot, type ReconciliationState } from './reconciliation';
import type { NextBestAction, PersonalLearningModel, Source } from './learner';

export { hydratePersistedExperimentDefinition, isPersistedAssessmentRow, isPersistedExperimentAttemptRow } from './reconciliation';

const runtimeAttempt = (row: Row<'learning_experiment_attempts'>): ExperimentAttempt => ({ id: row.id, experimentId: row.experiment_id, experimentDefinitionVersion: row.experiment_definition_version, actionId: row.action_id, status: row.status, result: row.result, startedAt: row.started_at, completedAt: row.completed_at, evaluatedAt: row.evaluated_at, assessmentId: row.assessment_id, evidenceIds: [], goalId: row.goal_id, projectId: row.project_id, sessionId: row.session_id, createdAt: row.created_at, idempotencyKey: row.idempotency_key, provenance: row.provenance as never });
const completeHistories = new WeakSet<object>();
const historyPageSize = 500;
const historyPageLimit = 100;
const runtimeAssessment = (row: Row<'learning_assessments'>): DurableAssessment => ({ id: row.id, attemptId: row.attempt_id, contractSnapshot: row.contract_snapshot as never, response: row.response, evaluator: row.evaluator, status: row.status, feedback: row.feedback, evaluatedAt: row.evaluated_at, provenance: row.provenance, idempotencyKey: row.idempotency_key, createdAt: row.created_at, updatedAt: row.updated_at });
const readCompletePages = async <T extends { id: string }>(readPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>, label: string, validateRow: (row: unknown) => row is T): Promise<T[]> => {
  const rows: T[] = [], seen = new Set<string>();
  for (let page = 0; page < historyPageLimit; page += 1) {
    const result = await readPage(page * historyPageSize, page * historyPageSize + historyPageSize - 1);
    if (result.error) throw safeError(result.error);
    if (!Array.isArray(result.data)) throw new ServiceError('database', `${label} history was not returned.`);
    const pageIds = new Set<string>();
    for (const row of result.data) {
      if (!validateRow(row) || pageIds.has(row.id) || seen.has(row.id)) throw new ServiceError('database', `${label} history pagination was malformed or repeated.`);
      pageIds.add(row.id); seen.add(row.id); rows.push(row);
    }
    if (result.data.length < historyPageSize) return rows;
  }
  throw new ServiceError('database', `${label} history exceeds the supported snapshot size.`);
};
const deepFreeze = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (!value || typeof value !== 'object') return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const child of Object.values(object as Record<string, unknown>)) deepFreeze(child, seen);
  return Object.freeze(value);
};
const deepClone = <T>(value: T, seen = new Map<object, unknown>()): T => {
  if (!value || typeof value !== 'object') return value;
  const object = value as object;
  const existing = seen.get(object);
  if (existing) return existing as T;
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(object, clone);
    for (const item of value) clone.push(deepClone(item, seen));
    return clone as T;
  }
  const clone: Record<string, unknown> = {};
  seen.set(object, clone);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) clone[key] = deepClone(item, seen);
  return clone as T;
};
const createCompleteHistory = (attempts: readonly ExperimentAttempt[], assessments: readonly DurableAssessment[]): CompleteExperimentHistory => {
  const frozenAttempts = Object.freeze(attempts.map(attempt => deepFreeze(deepClone({ ...attempt, evidenceIds: [...(attempt.evidenceIds || [])] })) as unknown as ExperimentAttempt));
  const frozenAssessments = Object.freeze(assessments.map(assessment => deepFreeze(deepClone({ ...assessment })) as unknown as DurableAssessment));
  const history = Object.freeze({ attempts: frozenAttempts, assessments: frozenAssessments, historyComplete: true as const });
  completeHistories.add(history);
  return history;
};
const isTrustedCompleteHistory = (history: object): history is CompleteExperimentHistory => completeHistories.has(history);

/** Internal production-only loader. It is intentionally absent from the public service exports. */
const loadCompleteExperimentHistory = async (client: Client, model: PersonalLearningModel, experiment: LearningExperiment) => {
  const definitionResult = await client.from('learning_experiments').select('*').eq('id', experiment.id).maybeSingle();
  if (definitionResult.error) throw safeError(definitionResult.error);
  const persistedExperiment = hydratePersistedExperimentDefinition(definitionResult.data, experiment);
  const ownerId = (definitionResult.data as Row<'learning_experiments'>).user_id;
  const attemptsRows = await readCompletePages<Row<'learning_experiment_attempts'>>(
    (from, to) => client.from('learning_experiment_attempts').select('*').eq('experiment_id', persistedExperiment.id).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to) as unknown as Promise<{ data: Row<'learning_experiment_attempts'>[] | null; error: unknown }>,
    'Experiment attempt', (row): row is Row<'learning_experiment_attempts'> => isPersistedExperimentAttemptRow(row) && row.user_id === ownerId && row.experiment_id === persistedExperiment.id && row.experiment_definition_version === persistedExperiment.definitionVersion,
  );
  const attempts = attemptsRows.map(row => ({ ...runtimeAttempt(row), evidenceIds: (model.snapshot.evidence || []).filter(evidence => evidence.attempt_id === row.id).map(evidence => evidence.id).sort() }));
  const attemptIds = attempts.map(attempt => attempt.id);
  const assessmentsRows = attemptIds.length ? await readCompletePages<Row<'learning_assessments'>>(
    (from, to) => client.from('learning_assessments').select('*').in('attempt_id', attemptIds).order('evaluated_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to) as unknown as Promise<{ data: Row<'learning_assessments'>[] | null; error: unknown }>,
    'Assessment', (row): row is Row<'learning_assessments'> => isPersistedAssessmentRow(row) && row.user_id === ownerId && attemptIds.includes(row.attempt_id),
  ) : [];
  const assessments = assessmentsRows.map(runtimeAssessment);
  const verifications = new Map(attempts.map(attempt => [attempt.id, verifyExperimentEvidence(model, persistedExperiment, { attemptId: attempt.id, evidenceIds: attempt.evidenceIds })]));
  const history = createCompleteHistory(attempts, assessments);
  return { experiment: persistedExperiment, attempts: history.attempts, assessments: history.assessments, verifications, history };
};


const activeStatuses = new Set<ExperimentLifecycle>(['PROPOSED', 'READY', 'IN_PROGRESS']);
const activeRank: Record<ExperimentLifecycle, number> = { IN_PROGRESS: 0, READY: 1, PROPOSED: 2, COMPLETED: 3, ABANDONED: 4 };
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const compareNullableAsc = (left: string | null | undefined, right: string | null | undefined) => {
  const a = left || null, b = right || null;
  if (a && b) return compare(a, b);
  if (a) return -1;
  if (b) return 1;
  return 0;
};
const compareNullableDesc = (left: string | null | undefined, right: string | null | undefined) => {
  const a = left || null, b = right || null;
  if (a && b) return compare(b, a);
  if (a) return -1;
  if (b) return 1;
  return 0;
};
const source = (table: Source['table'], id: string): Source => ({ table, id });

const effectiveEvent = (attempt: ExperimentAttempt) => attempt.evaluatedAt || attempt.completedAt || attempt.startedAt || attempt.createdAt || '';

const activeCompare = (left: ExperimentAttempt, right: ExperimentAttempt) =>
  activeRank[left.status] - activeRank[right.status]
  || compareNullableAsc(left.startedAt, right.startedAt)
  || compareNullableAsc(left.createdAt, right.createdAt)
  || compare(left.id, right.id);

const completedCompare = (left: ExperimentAttempt, right: ExperimentAttempt) =>
  compare(effectiveEvent(right), effectiveEvent(left))
  || compareNullableDesc(left.evaluatedAt, right.evaluatedAt)
  || compareNullableDesc(left.completedAt, right.completedAt)
  || compareNullableDesc(left.startedAt, right.startedAt)
  || compareNullableDesc(left.createdAt, right.createdAt)
  || compare(right.id, left.id);

const assessmentCompare = (left: DurableAssessment, right: DurableAssessment) =>
  compareNullableDesc(left.evaluatedAt, right.evaluatedAt)
  || compareNullableDesc(left.createdAt, right.createdAt)
  || compare(right.id, left.id);

const outcomeFor = (experiment: LearningExperiment, attempt: ExperimentAttempt, verification: EvidenceVerificationSnapshot | null): ExperimentAttemptOutcome => {
  const evidenceIds = [...new Set(attempt.evidenceIds || [])].sort(compare);
  const provenance: Source[] = [
    source('skills', experiment.skillId),
    ...(experiment.goalId ? [source('goals', experiment.goalId)] : []),
    ...(attempt.actionId ? [source('actions', attempt.actionId)] : []),
    ...evidenceIds.map(id => source('evidence', id)),
  ];
  return {
    attemptId: attempt.id,
    lifecycle: attempt.status,
    result: attempt.result,
    verification,
    evidenceScope: { attemptId: attempt.id, evidenceIds, source: 'explicit_attempt_link' },
    linkedRecords: {
      actionId: attempt.actionId,
      sessionId: attempt.sessionId || null,
      projectId: attempt.projectId || null,
      goalId: attempt.goalId || experiment.goalId || null,
      assessmentId: attempt.assessmentId || null,
    },
    provenance: [...new Map(provenance.map(item => [`${item.table}:${item.id}`, item])).values()].sort((a, b) => compare(a.table, b.table) || compare(a.id, b.id)),
  };
};

const appendReason = (action: NextBestAction, state: ReconciliationState, explanation: string, sources: Source[], type: NextBestAction['type'] | null = null, entityId?: string | null): NextBestAction => ({
  ...action,
  ...(type ? { type } : {}),
  ...(entityId !== undefined ? { entityId } : {}),
  reasons: [...action.reasons, { type: 'reconciliation_state', explanation: `${state}: ${explanation}`, sources }],
});

const actionFor = (input: ReconciliationInput, state: ReconciliationState, active: ExperimentAttemptOutcome | null, current: ExperimentAttemptOutcome | null, sources: Source[]): NextBestAction => {
  const action = input.nextAction;
  if (state === 'ATTEMPT_INCOMPLETE') {
    const sessionId = active?.linkedRecords.sessionId || null;
    return appendReason(action, state, sessionId ? 'Continue the selected active attempt.' : 'The selected active attempt has no persisted session yet; continuation remains required.', sources, 'continue_session', sessionId);
  }
  if (state === 'NEEDS_PRACTICE') return appendReason(action, state, 'The selected attempt needs focused practice.', sources, 'start_session', null);
  if (state === 'NEEDS_EVIDENCE') return appendReason(action, state, 'Add evidence that satisfies the missing experiment requirements.', sources, 'add_evidence', current?.linkedRecords.actionId || action.entityId);
  if (state === 'NEEDS_VERIFICATION' || state === 'VERIFICATION_REJECTED' || state === 'HISTORY_UNAVAILABLE' || state === 'ABANDONED_NO_OUTCOME' || state === 'EXPERIMENT_COMPLETED_NO_OUTCOME') return appendReason(action, state, 'Review the recorded learning context before taking the next step.', sources, 'inspect_context', null);
  return appendReason(action, state, state === 'CURRENT_REQUIREMENT_SATISFIED' ? 'The current experiment requirement is satisfied by scoped verification.' : 'No experiment attempt is available yet.', sources);
};

const sourceIdsFor = (history: readonly ExperimentAttemptOutcome[], capability: CapabilityRecord | null, path: AdaptivePathStep | null): Source[] => {
  const values = [
    ...history.flatMap(item => item.provenance),
    ...(capability?.traces.flatMap(trace => trace.sources).filter(item => item.table !== 'assessment').map(item => ({ table: item.table as Source['table'], id: item.id })) || []),
    ...(path?.capabilitySources.filter(item => item.table !== 'assessment').map(item => ({ table: item.table as Source['table'], id: item.id })) || []),
  ];
  return [...new Map(values.map(item => [`${item.table}:${item.id}`, item])).values()].sort((a, b) => compare(a.table, b.table) || compare(a.id, b.id));
};

export function reconcileLearningExperiment(input: ReconciliationInput): ReconciliationSnapshot {
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error('A valid observation time is required.');
  const experimentId = input.experiment?.id || 'none';
  const capabilityState = input.capabilityState;
  const adaptivePathState = input.adaptivePathState;
  if (!input.experiment) {
    const state: ReconciliationState = 'NO_ATTEMPT';
    return { observedAt: input.observedAt, experimentId, attemptHistory: [], activeAttempt: null, currentAttemptId: null, currentAttemptOutcome: 'NONE', assessmentHistory: [], capabilityState, adaptivePathState, reconciliationState: state, nextAction: actionFor(input, state, null, null, []), sourceIds: sourceIdsFor([], capabilityState, adaptivePathState) };
  }

  if (input.history.historyComplete !== true || !isTrustedCompleteHistory(input.history)) {
    const state: ReconciliationState = 'HISTORY_UNAVAILABLE';
    const sources = [source('skills', input.experiment.skillId), ...(input.experiment.goalId ? [source('goals', input.experiment.goalId)] : [])];
    return { observedAt: input.observedAt, experimentId, attemptHistory: [], activeAttempt: null, currentAttemptId: null, currentAttemptOutcome: 'NONE', assessmentHistory: [], capabilityState, adaptivePathState, reconciliationState: state, nextAction: actionFor(input, state, null, null, sources), sourceIds: sources.sort((a, b) => compare(a.table, b.table) || compare(a.id, b.id)) };
  }

  const attempts = [...input.history.attempts].filter(attempt => attempt.experimentId === input.experiment!.id);
  const attemptIds = new Set(attempts.map(attempt => attempt.id));
  for (const [attemptId, verification] of input.verifications || []) {
    if (!attemptIds.has(attemptId) || verification && (verification.attemptId !== attemptId || verification.experimentId !== input.experiment.id || verification.skillId !== input.experiment.skillId)) {
      const state: ReconciliationState = 'HISTORY_UNAVAILABLE';
      const sources = [source('skills', input.experiment.skillId), ...(input.experiment.goalId ? [source('goals', input.experiment.goalId)] : [])];
      return { observedAt: input.observedAt, experimentId, attemptHistory: [], activeAttempt: null, currentAttemptId: null, currentAttemptOutcome: 'NONE', assessmentHistory: [], capabilityState, adaptivePathState, reconciliationState: state, nextAction: actionFor(input, state, null, null, sources), sourceIds: sources.sort((a, b) => compare(a.table, b.table) || compare(a.id, b.id)) };
    }
  }
  const history = attempts.sort((a, b) => completedCompare(a, b)).map(attempt => outcomeFor(input.experiment!, attempt, input.verifications?.get(attempt.id) || null));
  const activeAttempt = attempts.filter(attempt => activeStatuses.has(attempt.status)).sort(activeCompare)[0];
  const active = activeAttempt ? outcomeFor(input.experiment, activeAttempt, input.verifications?.get(activeAttempt.id) || null) : null;
  const completedAttempt = attempts.filter(attempt => attempt.status === 'COMPLETED').sort(completedCompare)[0];
  const current = completedAttempt ? outcomeFor(input.experiment, completedAttempt, input.verifications?.get(completedAttempt.id) || null) : null;
  const assessments = [...input.history.assessments].filter(assessment => attempts.some(attempt => attempt.id === assessment.attemptId)).sort(assessmentCompare);
  const sources = sourceIdsFor(history, capabilityState, adaptivePathState);

  let state: ReconciliationState;
  if (active) state = 'ATTEMPT_INCOMPLETE';
  else if (current) {
    if (current.result === 'NOT_EVALUATED') state = 'EXPERIMENT_COMPLETED_NO_OUTCOME';
    else if (current.result === 'FAILED' || current.result === 'PARTIAL') state = 'NEEDS_PRACTICE';
    else {
      const verification: VerificationState | null = current.verification?.state || null;
      state = verification === 'SUFFICIENT' ? 'CURRENT_REQUIREMENT_SATISFIED'
        : verification === 'MISSING' || verification === 'INSUFFICIENT' || verification === null ? 'NEEDS_EVIDENCE'
          : verification === 'REJECTED' ? 'VERIFICATION_REJECTED' : 'NEEDS_VERIFICATION';
    }
  } else if (attempts.some(attempt => attempt.status === 'ABANDONED')) state = 'ABANDONED_NO_OUTCOME';
  else state = 'NO_ATTEMPT';

  const selected = active || current;
  const currentAttemptOutcome = active ? 'NONE' : current?.result || 'NONE';
  return {
    observedAt: input.observedAt,
    experimentId,
    attemptHistory: history,
    activeAttempt: active,
    currentAttemptId: selected?.attemptId || null,
    currentAttemptOutcome,
    assessmentHistory: assessments,
    capabilityState,
    adaptivePathState,
    reconciliationState: state,
    nextAction: actionFor(input, state, active, current, sources),
    sourceIds: sources,
  };
}






// A single query boundary for all screens. Ownership is enforced by PostgreSQL RLS.
export function dataServices(client: Client) {
  const canLoadTrustedHistory = isInitializedClient(client);
  return {
    async personalLearningModel() {
      const model = await loadLearningContext(client);
      let path = generateAdaptiveLearningPath(model);
      let experimentSelection = selectLearningExperiment(model, path);
      let verifiedModel = model;
      let evidenceVerification: EvidenceVerificationSnapshot | null = null;
      let experimentOutcome: ExperimentOutcomeSnapshot | null = null;
      let reconciliation: ReconciliationSnapshot;
      let currentAssessment: DurableAssessment | null = null;
      let assessmentHistory: DurableAssessment[] = [];
      let history: ReconciliationHistory = unavailableExperimentHistory();
      let persistedExperiment: LearningExperiment | null = null;
      let loadedExperimentId: string | null = null;
      let attempts: ExperimentAttempt[] = [];
      let assessments: DurableAssessment[] = [];
      let verifications = new Map<string, EvidenceVerificationSnapshot | null>();
      for (let pass = 0; pass < 2; pass += 1) {
        const currentExperiment = experimentSelection.experiment;
        evidenceVerification = null;
        experimentOutcome = null;
        currentAssessment = null;
        assessmentHistory = [];
        if (currentExperiment && canLoadTrustedHistory) {
          try {
            ({ experiment: persistedExperiment, verifications, history } = await loadCompleteExperimentHistory(client, model, currentExperiment));
            attempts = [...history.attempts];
            assessments = [...history.assessments];
            loadedExperimentId = currentExperiment.id;
            evidenceVerification = verifyExperimentEvidence(model, persistedExperiment);
            experimentOutcome = deriveExperimentOutcomeSnapshot(persistedExperiment, attempts, verifications);
            const assessmentByAttempt = new Map<string, DurableAssessment[]>();
            for (const assessment of assessments) assessmentByAttempt.set(assessment.attemptId, [...(assessmentByAttempt.get(assessment.attemptId) || []), assessment]);
            currentAssessment = experimentOutcome.current ? latestAssessment(assessmentByAttempt.get(experimentOutcome.current.attemptId) || []) : null;
            assessmentHistory = currentAssessment ? assessmentByAttempt.get(currentAssessment.attemptId) || [] : [];
            const verificationForModel = experimentOutcome.current?.verification || evidenceVerification;
            verifiedModel = { ...model, capabilities: verificationForModel ? deriveCapabilitySnapshot(model, [], verificationForModel) : model.capabilities };
          } catch {
            history = unavailableExperimentHistory();
            persistedExperiment = null;
            loadedExperimentId = currentExperiment.id;
            attempts = [];
            assessments = [];
            verifications = new Map();
            evidenceVerification = null;
            experimentOutcome = null;
            currentAssessment = null;
            assessmentHistory = [];
          }
        }
        path = generateAdaptiveLearningPath(verifiedModel);
        const nextSelection = selectLearningExperiment(verifiedModel, path);
        if (nextSelection.experiment?.id === experimentSelection.experiment?.id || pass === 1) { experimentSelection = nextSelection; break; }
        experimentSelection = nextSelection;
      }
      if (experimentSelection.experiment && loadedExperimentId !== experimentSelection.experiment.id && canLoadTrustedHistory) {
        try {
          ({ experiment: persistedExperiment, verifications, history } = await loadCompleteExperimentHistory(client, model, experimentSelection.experiment));
          attempts = [...history.attempts];
          assessments = [...history.assessments];
          evidenceVerification = verifyExperimentEvidence(model, persistedExperiment);
          experimentOutcome = deriveExperimentOutcomeSnapshot(persistedExperiment, attempts, verifications);
          const assessmentByAttempt = new Map<string, DurableAssessment[]>();
          for (const assessment of assessments) assessmentByAttempt.set(assessment.attemptId, [...(assessmentByAttempt.get(assessment.attemptId) || []), assessment]);
          currentAssessment = experimentOutcome.current ? latestAssessment(assessmentByAttempt.get(experimentOutcome.current.attemptId) || []) : null;
          assessmentHistory = currentAssessment ? assessmentByAttempt.get(currentAssessment.attemptId) || [] : [];
        } catch {
          history = unavailableExperimentHistory();
          persistedExperiment = null;
          attempts = [];
          assessments = [];
          verifications = new Map();
          evidenceVerification = null;
          experimentOutcome = null;
          currentAssessment = null;
          assessmentHistory = [];
        }
      } else if (!experimentSelection.experiment) {
        attempts = [];
        assessments = [];
        verifications = new Map();
        evidenceVerification = null;
        experimentOutcome = null;
        currentAssessment = null;
        assessmentHistory = [];
        history = { attempts: [], assessments: [], historyComplete: false };
        persistedExperiment = null;
      }
      const verificationForModel = experimentOutcome?.current?.verification || evidenceVerification;
      const verificationReason = verificationForModel && verificationForModel.state !== 'SUFFICIENT' ? [{ type: verificationForModel.state === 'MANUAL_VERIFICATION_REQUIRED' ? 'manual_verification_required' : verificationForModel.state === 'UNAVAILABLE' ? 'evidence_unavailable' : verificationForModel.state === 'MISSING' ? 'evidence_missing' : 'evidence_incomplete', explanation: verificationForModel.reasons[0] || 'The selected experiment evidence is not yet sufficient.', sources: experimentSelection.provenance?.sources || [] }] : [];
      const nextAction = experimentSelection.status === 'SELECTED' && experimentSelection.experiment && verifiedModel.nextAction.skillId === experimentSelection.experiment.skillId
        ? { ...verifiedModel.nextAction, reasons: [...verifiedModel.nextAction.reasons, { type: 'experiment_available', explanation: experimentSelection.reason, sources: experimentSelection.provenance?.sources || [] }, ...verificationReason] }
        : verifiedModel.nextAction;
      const reconciliationExperiment = persistedExperiment || experimentSelection.experiment;
      reconciliation = reconcileLearningExperiment({ observedAt: model.asOf, experiment: reconciliationExperiment, history, verifications, capabilityState: verifiedModel.capabilities?.skills.find(skill => skill.skillId === reconciliationExperiment?.skillId) || null, adaptivePathState: path.currentStep, nextAction });
      return { ...verifiedModel, nextAction: reconciliation.nextAction, adaptivePath: path, experimentSelection, evidenceVerification: verificationForModel, experimentOutcome, reconciliation, assessmentContext: { current: currentAssessment, history: assessmentHistory } };
    },
    /** Resolve a historical definition using the attempt's persisted identity and version. */
    async experimentDefinitionForAttempt(attemptId: string) {
      const attempt = await client.from('learning_experiment_attempts').select('experiment_id,experiment_definition_version,user_id').eq('id', attemptId).single();
      if (attempt.error) throw safeError(attempt.error);
      const version = attempt.data.experiment_definition_version;
      if (!Number.isInteger(version) || version < 1) throw new ServiceError('validation', 'The attempt definition version is invalid.');
      const definition = await client.from('learning_experiments').select('*').eq('id', attempt.data.experiment_id).eq('definition_version', version).single();
      if (definition.error) throw safeError(definition.error);
      if (definition.data.user_id !== attempt.data.user_id) throw new ServiceError('validation', 'The attempt and experiment owners do not match.');
      return definition.data;
    },
    async createExperimentAttempt(experiment: LearningExperiment, input: { idempotencyKey: string; attemptId?: string; actionId?: string | null; goalId?: string | null; projectId?: string | null; sessionId?: string | null; provenance?: Record<string, unknown> }) {
      const key = input.idempotencyKey.trim();
      if (!key) throw new ServiceError('validation', 'An idempotency key is required.');
      const requestedGoalId = input.goalId ?? experiment.goalId;
      const requestedProjectId = input.projectId ?? experiment.projectId;
      const existingDefinition = await client.from('learning_experiments').select('*').eq('id', experiment.id).maybeSingle();
      if (existingDefinition.error) throw safeError(existingDefinition.error);
      if (existingDefinition.data && !experimentDefinitionMatches(existingDefinition.data, experiment, requestedGoalId, requestedProjectId)) throw new ServiceError('validation', 'The persisted experiment definition does not match the requested attempt.');
      const existing = await client.from('learning_experiment_attempts').select('*').eq('idempotency_key', key).maybeSingle();
      if (existing.error) throw safeError(existing.error);
      if (existing.data) {
        if (existing.data.experiment_id !== experiment.id) throw new ServiceError('validation', 'This idempotency key is already bound to another experiment.');
        return existing.data;
      }
      const experimentRow = { id: experiment.id, skill_id: experiment.skillId, goal_id: requestedGoalId, project_id: requestedProjectId, template_key: experiment.templateKey, title: experiment.title, objective: experiment.objective, definition_version: experiment.definitionVersion, steps: JSON.stringify(experiment.steps), acceptance_criteria: JSON.stringify(experiment.acceptanceCriteria), constraints: JSON.stringify(experiment.constraints), success_conditions: JSON.stringify(experiment.successConditions), evidence_requirements: JSON.stringify(experiment.evidenceRequirements), estimated_minutes: experiment.estimatedMinutes, evaluation_mode: experiment.evaluationMode };
      let persistedDefinition = existingDefinition.data;
      if (!persistedDefinition) {
        const definition = await client.from('learning_experiments').insert(experimentRow).select('*').single();
        if (definition.error?.code === '23505') {
          const retry = await client.from('learning_experiments').select('*').eq('id', experiment.id).single();
          if (!retry.error && experimentDefinitionMatches(retry.data, experiment, requestedGoalId, requestedProjectId)) persistedDefinition = retry.data;
          else throw new ServiceError('validation', 'The persisted experiment definition does not match the requested attempt.');
        } else {
          if (definition.error) throw safeError(definition.error);
          persistedDefinition = definition.data;
        }
      }
      const initial = createExperimentAttempt(experiment, { attemptId: input.attemptId || crypto.randomUUID(), actionId: input.actionId, idempotencyKey: key });
      const row = { id: initial.id, experiment_id: persistedDefinition.id, experiment_definition_version: persistedDefinition.definition_version, action_id: initial.actionId, goal_id: persistedDefinition.goal_id, project_id: persistedDefinition.project_id, session_id: input.sessionId || null, idempotency_key: key, provenance: input.provenance || { experimentId: persistedDefinition.id, templateKey: persistedDefinition.template_key, definitionVersion: persistedDefinition.definition_version } };
      const created = await client.from('learning_experiment_attempts').insert(row).select('*').single();
      if (created.error?.code === '23505') {
        const retry = await client.from('learning_experiment_attempts').select('*').eq('idempotency_key', key).single();
        if (!retry.error) return retry.data;
      }
      if (created.error) throw safeError(created.error);
      return created.data;
    },
    async transitionExperimentAttempt(id: string, status: ExperimentLifecycle, now = new Date().toISOString()) {
      const existing = await client.from('learning_experiment_attempts').select('*').eq('id', id).single();
      if (existing.error) throw safeError(existing.error);
      const next = transitionExperimentAttempt(runtimeAttempt(existing.data), status, now);
      const values = { status: next.status, started_at: next.startedAt, completed_at: next.status === 'COMPLETED' ? next.completedAt : null, abandoned_at: next.status === 'ABANDONED' ? next.completedAt : null };
      const updated = await client.from('learning_experiment_attempts').update(values).eq('id', id).select('*').single();
      if (updated.error) throw safeError(updated.error);
      return updated.data;
    },
    async recordExperimentResult(id: string, result: ExperimentResult, input: { now?: string; assessmentId?: string | null; evidenceIds?: readonly string[] } = {}) {
      const existing = await client.from('learning_experiment_attempts').select('*').eq('id', id).single();
      if (existing.error) throw safeError(existing.error);
      const attempt = runtimeAttempt(existing.data);
      const requestedAssessmentId = input.assessmentId ?? attempt.assessmentId;
      if (requestedAssessmentId) {
        const assessment = await client.from('learning_assessments').select('id,attempt_id').eq('id', requestedAssessmentId).single();
        if (assessment.error) throw new ServiceError('validation', 'The assessment reference is unavailable or belongs to another attempt.');
        if (assessment.data.attempt_id !== id) throw new ServiceError('validation', 'The assessment reference does not belong to this attempt.');
      }
      // Evidence IDs are compatibility metadata for the pure outcome helper;
      // durable verification resolves scope from evidence.attempt_id.
      const next = recordExperimentResult(attempt, result, { now: input.now || new Date().toISOString(), assessmentId: requestedAssessmentId, evidenceIds: input.evidenceIds });
      if (next === attempt) return existing.data;
      const updated = await client.from('learning_experiment_attempts').update({ result: next.result, evaluated_at: next.evaluatedAt, assessment_id: next.assessmentId }).eq('id', id).select('*').single();
      if (updated.error) throw safeError(updated.error);
      return updated.data;
    },
    async recordAssessment(attemptId: string, prompt: AssessmentPrompt, input: { response?: string | null; status?: Exclude<AssessmentStatus, 'not_attempted'>; feedback?: string | null; idempotencyKey: string; now?: string; provenance?: Record<string, unknown> }) {
      const key = input.idempotencyKey.trim();
      if (!key) throw new ServiceError('validation', 'An idempotency key is required.');
      const existing = await client.from('learning_assessments').select('*').eq('idempotency_key', key).maybeSingle();
      if (existing.error) throw safeError(existing.error);
      if (existing.data) {
        if (existing.data.attempt_id !== attemptId) throw new ServiceError('validation', 'This idempotency key is already bound to another attempt.');
        return existing.data;
      }
      const attempt = await client.from('learning_experiment_attempts').select('*').eq('id', attemptId).single();
      if (attempt.error) throw safeError(attempt.error);
      if (attempt.data.status !== 'COMPLETED') throw new ServiceError('validation', 'An assessment can only be recorded after the attempt is complete.');
      const experiment = await client.from('learning_experiments').select('*').eq('id', attempt.data.experiment_id).single();
      if (experiment.error) throw safeError(experiment.error);
      const contract = assessmentContractSnapshot(prompt);
      const reviewedTemplate = experimentTemplates.find(template => template.key === experiment.data.template_key && template.skillId === experiment.data.skill_id && template.definitionVersion === experiment.data.definition_version);
      const definition = reviewedTemplate ? normalizeExperimentTemplateDefinition(reviewedTemplate) : null;
      if (!reviewedTemplate || !definition || experiment.data.definition_version !== definition.definitionVersion || experiment.data.title !== reviewedTemplate.title || experiment.data.objective !== reviewedTemplate.objective || JSON.stringify(experiment.data.success_conditions) !== JSON.stringify(definition.successConditions) || JSON.stringify(experiment.data.steps) !== JSON.stringify(definition.steps) || JSON.stringify(experiment.data.acceptance_criteria) !== JSON.stringify(definition.acceptanceCriteria) || JSON.stringify(experiment.data.evidence_requirements) !== JSON.stringify(definition.evidenceRequirements) || JSON.stringify(experiment.data.constraints) !== JSON.stringify(definition.constraints)) {
        throw new ServiceError('validation', 'The attempt experiment is not backed by the current reviewed template.');
      }
      const expectedEvidenceTypes = [...new Set(reviewedTemplate.evidenceRequirements.map(item => item.type))].sort();
      if (contract.skillId !== experiment.data.skill_id || contract.prompt !== reviewedTemplate.objective || contract.expectedOutcome !== reviewedTemplate.successConditions.join(' ') || JSON.stringify(contract.evidenceTypes) !== JSON.stringify(expectedEvidenceTypes) || !contract.id.trim()) throw new ServiceError('validation', 'The assessment contract does not match the reviewed experiment contract.');
      if (!input.response?.trim()) throw new ServiceError('validation', 'An assessment response is required.');
      const result = assessManualAttempt(prompt, { assessmentId: contract.id, response: input.response || null, evaluator: 'manual', status: input.status, feedback: input.feedback || null });
      const row = { id: crypto.randomUUID(), attempt_id: attemptId, contract_snapshot: contract, response: result.response, evaluator: 'manual' as const, status: durableAssessmentStatus(result.status as Exclude<AssessmentStatus, 'not_attempted'>), feedback: result.feedback || null, evaluated_at: result.status === 'attempted' ? null : input.now || new Date().toISOString(), provenance: input.provenance || { attemptId, assessmentId: contract.id }, idempotency_key: key };
      const created = await client.from('learning_assessments').insert(row).select('*').single();
      if (created.error?.code === '23505') {
        const retry = await client.from('learning_assessments').select('*').eq('idempotency_key', key).single();
        if (!retry.error) return retry.data;
      }
      if (created.error) throw safeError(created.error);
      return created.data;
    },
    async assessmentHistory(attemptId: string) {
      const result = await client.from('learning_assessments').select('*').eq('attempt_id', attemptId).order('evaluated_at', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false });
      if (result.error) throw safeError(result.error);
      return result.data;
    },
    async list<T extends TableName>(table: T, page = 0) {
      const { from, to, size } = pageBounds(page);
      const { data, error } = await client.from(table).select('*')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to + 1);
      if (error) throw safeError(error);
      // Supabase cannot resolve a generic dynamic table select to its mapped row type.
      const rows = data as unknown as Row<T>[];
      return { rows: rows.slice(0, size), hasMore: rows.length > size };
    },
    async createGoal(title: string, requestId: string, input: { targetSkillId?: string | null; targetMastery?: number | string | null; deadline?: string | null; status?: 'active' | 'paused' | 'completed' | 'archived' } = {}) {
      const clean = goalTitle(title);
      const values = { id: requestId, title: clean, target_skill_id: goalSkillId(input.targetSkillId), target_mastery: goalTargetMastery(input.targetMastery), deadline: goalDeadline(input.deadline), status: input.status ? goalStatus(input.status) : 'active' as const };
      const { data, error } = await client.from('goals').insert(values).select('*').single();
      if (error?.code === '23505') {
        // A lost response can be safely retried with the same request ID.
        const previous = await client.from('goals').select('*').eq('id', requestId).single();
        if (!previous.error && previous.data?.title === clean) return previous.data;
      }
      if (error) throw safeError(error);
      return data;
    },
    async updateGoal(id: string, title: string, input: { targetSkillId?: string | null; targetMastery?: number | string | null; deadline?: string | null; status?: 'active' | 'paused' | 'completed' | 'archived' } = {}) {
      const { data, error } = await client.from('goals').update({ title: goalTitle(title), target_skill_id: goalSkillId(input.targetSkillId), target_mastery: goalTargetMastery(input.targetMastery), deadline: goalDeadline(input.deadline), ...(input.status ? { status: goalStatus(input.status) } : {}) }).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async deleteGoal(id: string) {
      const { data, error } = await client.from('goals').delete().eq('id', id).select('id');
      if (error) throw safeError(error);
      if (!data?.length) throw new ServiceError('permission', 'This goal is unavailable or has already been deleted.');
    },
    async goals(page = 0) {
      const result = await this.list('goals', page);
      const skillIds = result.rows.map(row => row.target_skill_id).filter((id): id is string => !!id);
      const catalog = skillIds.length ? await client.from('skills').select('id,name,slug,category,difficulty,description').in('id', skillIds) : { data: [], error: null };
      if (catalog.error) throw safeError(catalog.error);
      const goalIds = result.rows.map(row => row.id);
      const actionResult = goalIds.length ? await client.from('actions').select('id,goal_id,status').in('goal_id', goalIds) : { data: [], error: null };
      if (actionResult.error) throw safeError(actionResult.error);
      const actionIds = actionResult.data.map(action => action.id);
      const evidenceResult = actionIds.length ? await client.from('evidence').select('id,action_id').in('action_id', actionIds) : { data: [], error: null };
      if (evidenceResult.error) throw safeError(evidenceResult.error);
      return { ...result, rows: result.rows.map(row => ({
        ...row,
        targetSkill: catalog.data.find(skill => skill.id === row.target_skill_id) ?? null,
        progress: calculateGoalProgress(row.id, actionResult.data, evidenceResult.data),
      })) };
    },
    async goalActions(goalId: string) {
      const { data, error } = await client.from('actions').select('*').eq('goal_id', goalId).order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (error) throw safeError(error);
      return data;
    },
    async goalActivity(goalId: string) {
      const actions = await this.goalActions(goalId);
      const evidenceResults = await Promise.all(actions.map(action => this.actionEvidence(action.id)));
      const evidenceByAction = new Map<string, Row<'evidence'>[]>();
      actions.forEach((action, index) => evidenceByAction.set(action.id, evidenceResults[index]));
      const evidence = evidenceResults.flat();
      return { actions, evidenceByAction, progress: calculateGoalProgress(goalId, actions, evidence) };
    },
    async progressSummary() {
      const goals = await client.from('goals').select('id,status').order('created_at', { ascending: false });
      if (goals.error) throw safeError(goals.error);
      const actions = await client.from('actions').select('id,goal_id,status');
      if (actions.error) throw safeError(actions.error);
      const actionIds = actions.data.map(action => action.id);
      const evidence = actionIds.length ? await client.from('evidence').select('id,action_id').in('action_id', actionIds) : { data: [], error: null };
      if (evidence.error) throw safeError(evidence.error);
      return calculateProgressSummary(goals.data, actions.data, evidence.data);
    },
    async reviewActivity(period: ReviewPeriod = currentWeekPeriod()) {
      const goals = await client.from('goals').select('id,status');
      if (goals.error) throw safeError(goals.error);
      const actions = await client.from('actions').select('id,title,goal_id,status,created_at,completed_at');
      if (actions.error) throw safeError(actions.error);
      const evidence = await client.from('evidence').select('id,title,type,action_id,created_at');
      if (evidence.error) throw safeError(evidence.error);
      const activity = calculateReviewActivity(period, goals.data, actions.data, evidence.data);
      const isInPeriod = (value: string | null) => { const day = value?.slice(0, 10); return !!day && day >= period.start && day <= period.end; };
      const periodActionIds = new Set(actions.data.filter(action => action.goal_id != null && (isInPeriod(action.created_at) || isInPeriod(action.completed_at))).map(action => action.id));
      return { ...activity, completedActions: actions.data.filter(action => periodActionIds.has(action.id) && action.status === 'completed'), evidenceItems: evidence.data.filter(item => item.action_id != null && periodActionIds.has(item.action_id) && item.created_at?.slice(0, 10) >= period.start && item.created_at?.slice(0, 10) <= period.end) };
    },
    async goalReviewActivity(goalId: string, period: ReviewPeriod = currentWeekPeriod()) {
      const goal = await client.from('goals').select('id,status').eq('id', goalId).single();
      if (goal.error) throw safeError(goal.error);
      const actions = await this.goalActions(goalId);
      const evidenceResults = await Promise.all(actions.map(action => this.actionEvidence(action.id)));
      const evidence = evidenceResults.flat();
      const activity = calculateReviewActivity(period, [goal.data], actions, evidence);
      const isInPeriod = (value: string | null) => { const day = value?.slice(0, 10); return !!day && day >= period.start && day <= period.end; };
      const periodActionIds = new Set(actions.filter(action => isInPeriod(action.created_at) || isInPeriod(action.completed_at)).map(action => action.id));
      return { ...activity, completedActions: actions.filter(action => periodActionIds.has(action.id) && action.status === 'completed'), evidenceItems: evidence.filter(item => item.action_id != null && periodActionIds.has(item.action_id) && isInPeriod(item.created_at)) };
    },
    async projectWorkspace() {
      const [projects, projectSkills, evidence, evidenceSkills, skills] = await Promise.all([
        client.from('projects').select('id,title,description,goal_id,status,mvp,success_metric,estimated_minutes,created_at,updated_at').order('created_at', { ascending: false }).order('id', { ascending: false }),
        client.from('project_skills').select('id,project_id,skill_id,created_at,updated_at'),
        client.from('evidence').select('id,title,type,url,notes,project_id,created_at,updated_at'),
        client.from('evidence_skills').select('id,evidence_id,skill_id'),
        client.from('skills').select('id,name'),
      ]);
      for (const result of [projects, projectSkills, evidence, evidenceSkills, skills]) if (result.error) throw safeError(result.error);
      const rows = projects.data || [];
      const projectEvidence = (evidence.data || []).filter(item => item.project_id);
      const proofs = deriveProjectProofs({ projects: rows.map(item => ({ id: item.id })), projectSkills: projectSkills.data || [], evidence: projectEvidence, evidenceSkills: evidenceSkills.data || [] });
      const skillNames = new Map((skills.data || []).map(skill => [skill.id, skill.name]));
      return rows.map(project => ({ ...project, artifacts: projectEvidence.filter(item => item.project_id === project.id), proofs: proofs.filter(proof => proof.projectId === project.id).map(proof => ({ ...proof, projectTitle: project.title, skillName: skillNames.get(proof.skillId) || proof.skillId })) }));
    },
    async projectProofs(projectId?: string | null) {
      const workspace = await this.projectWorkspace();
      return workspace.flatMap(project => project.proofs).filter(proof => !projectId || proof.projectId === projectId) as (ProjectProof & { projectTitle: string; skillName: string })[];
    },
    async createProject(title: string, requestId: string, input: { description?: string | null; goalId?: string | null; status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived' } = {}) {
      const { data, error } = await client.from('projects').insert({ id: requestId, title: projectTitle(title), description: projectDescription(input.description), goal_id: input.goalId ? goalSkillId(input.goalId) : null, status: projectStatus(input.status || 'planned') }).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async addProjectArtifact(projectId: string, input: { title: string; type: string; url?: string | null; notes?: string | null; id?: string }) {
      const title = evidenceTitle(input.title); const type = evidenceType(input.type); const url = evidenceUrl(input.url); const notes = evidenceNotes(input.notes); evidenceContent(url, notes);
      const { data, error } = await client.from('evidence').insert({ ...(input.id ? { id: input.id } : {}), title, type, url, notes, project_id: projectId }).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async createProjectProof(projectId: string, skillId: string, input: { artifactTitle: string; artifactType: string; reference?: string | null; claim: string }, ids: { evidenceId?: string; projectSkillId?: string; evidenceSkillId?: string } = {}) {
      const evidence = await this.addProjectArtifact(projectId, { id: ids.evidenceId, title: input.artifactTitle, type: input.artifactType, url: input.reference, notes: input.claim });
      const projectSkill = await client.from('project_skills').upsert({ ...(ids.projectSkillId ? { id: ids.projectSkillId } : {}), project_id: projectId, skill_id: skillId }, { onConflict: 'user_id,project_id,skill_id' }).select('*').single();
      if (projectSkill.error) { await client.from('evidence').delete().eq('id', evidence.id); throw safeError(projectSkill.error); }
      const link = await client.from('evidence_skills').insert({ ...(ids.evidenceSkillId ? { id: ids.evidenceSkillId } : {}), evidence_id: evidence.id, skill_id: skillId }).select('*').single();
      if (link.error) { await client.from('evidence').delete().eq('id', evidence.id); throw safeError(link.error); }
      return this.projectProofs(projectId);
    },
    async reflections() {
      const { data, error } = await client.from('reflections').select('*').order('period_start', { ascending: false }).order('updated_at', { ascending: false });
      if (error) throw safeError(error);
      return data;
    },
    async createReflection(input: { goalId?: string | null; periodStart: string; periodEnd: string; accomplishment?: string | null; learning?: string | null; blocker?: string | null; nextStep?: string | null }) {
      const periodStart = reflectionDate(input.periodStart, 'review start date'); const periodEnd = reflectionDate(input.periodEnd, 'review end date');
      if (periodEnd < periodStart) throw new ServiceError('validation', 'Review end date must be on or after the start date.');
      const fields = [reflectionText(input.accomplishment), reflectionText(input.learning), reflectionText(input.blocker), reflectionText(input.nextStep)]; reflectionContent(fields);
      const { data, error } = await client.from('reflections').insert({ goal_id: input.goalId || null, period_start: periodStart, period_end: periodEnd, accomplishment: fields[0], learning: fields[1], blocker: fields[2], next_step: fields[3] }).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async updateReflection(id: string, input: { goalId?: string | null; periodStart: string; periodEnd: string; accomplishment?: string | null; learning?: string | null; blocker?: string | null; nextStep?: string | null }) {
      const periodStart = reflectionDate(input.periodStart, 'review start date'); const periodEnd = reflectionDate(input.periodEnd, 'review end date');
      if (periodEnd < periodStart) throw new ServiceError('validation', 'Review end date must be on or after the start date.');
      const fields = [reflectionText(input.accomplishment), reflectionText(input.learning), reflectionText(input.blocker), reflectionText(input.nextStep)]; reflectionContent(fields);
      const { data, error } = await client.from('reflections').update({ goal_id: input.goalId || null, period_start: periodStart, period_end: periodEnd, accomplishment: fields[0], learning: fields[1], blocker: fields[2], next_step: fields[3] }).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async deleteReflection(id: string) {
      const { data, error } = await client.from('reflections').delete().eq('id', id).select('id');
      if (error) throw safeError(error);
      if (!data?.length) throw new ServiceError('permission', 'This reflection is unavailable or has already been deleted.');
    },
    async createAction(goalId: string | null, input: { title: string; reason?: string | null; type?: 'learn' | 'practice' | 'build' | 'research' | 'apply' | 'prepare' | 'create' | 'review' | 'network' | 'evidence'; status?: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled'; dueAt?: string | null; userSkillId?: string | null }) {
      const status = actionStatus(input.status || 'todo');
      const values = { goal_id: goalId, user_skill_id: input.userSkillId || null, title: actionTitle(input.title), type: input.type || 'build', reason: input.reason?.trim() || null, status, due_at: actionDueAt(input.dueAt), completed_at: status === 'completed' ? new Date().toISOString() : null };
      const { data, error } = await client.from('actions').insert(values).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async updateAction(id: string, input: { title: string; reason?: string | null; status: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled'; dueAt?: string | null }) {
      const status = actionStatus(input.status);
      const { data, error } = await client.from('actions').update({ title: actionTitle(input.title), reason: input.reason?.trim() || null, status, due_at: actionDueAt(input.dueAt), completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async deleteAction(id: string) {
      const { data, error } = await client.from('actions').delete().eq('id', id).select('id');
      if (error) throw safeError(error);
      if (!data?.length) throw new ServiceError('permission', 'This action is unavailable or has already been deleted.');
    },
    async skillResources(skillId: string, type?: ResourceType) {
      const links = await client.from('resource_skills').select('resource_id').eq('skill_id', skillId);
      if (links.error) throw safeError(links.error);
      const ids = links.data.map(link => link.resource_id);
      if (!ids.length) return [];
      let query = client.from('resources').select('*').in('id', ids).order('created_at', { ascending: false });
      if (type) query = query.eq('type', resourceType(type));
      const { data, error } = await query;
      if (error) throw safeError(error);
      return data;
    },
    async resourceSessions(resourceIds: string[], limit = 10) {
      if (!resourceIds.length) return [];
      const { data, error } = await client.from('learning_sessions').select('*').in('resource_id', resourceIds).order('started_at', { ascending: false }).limit(limit);
      if (error) throw safeError(error);
      return data;
    },
    async createResource(skillId: string, input: { title: string; url: string; type: string; source?: string | null; provider?: string | null }) {
      const values = { title: resourceTitle(input.title), url: resourceUrl(input.url), type: resourceType(input.type), source: resourceSource(input.source) || 'Added by you', provider: resourceProvider(input.provider) || 'External' };
      const created = await client.from('resources').insert(values).select('*').single();
      if (created.error) throw safeError(created.error);
      const link = await client.from('resource_skills').insert({ resource_id: created.data.id, skill_id: skillId }).select('*').single();
      if (link.error) { await client.from('resources').delete().eq('id', created.data.id); throw safeError(link.error); }
      return created.data;
    },
    async updateResource(id: string, input: { title: string; url: string; type: string; source?: string | null; provider?: string | null }) {
      const values = { title: resourceTitle(input.title), url: resourceUrl(input.url), type: resourceType(input.type), source: resourceSource(input.source) || 'Added by you', provider: resourceProvider(input.provider) || 'External' };
      const { data, error } = await client.from('resources').update(values).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async deleteResource(id: string) {
      const link = await client.from('resource_skills').delete().eq('resource_id', id).select('id');
      if (link.error) throw safeError(link.error);
      const { data, error } = await client.from('resources').delete().eq('id', id).select('id');
      if (error) throw safeError(error);
      if (!data?.length) throw new ServiceError('permission', 'This resource is unavailable or has already been deleted.');
    },
    async actionEvidence(actionId: string) {
      const { data, error } = await client.from('evidence').select('*').eq('action_id', actionId).order('created_at', { ascending: false });
      if (error) throw safeError(error);
      return data;
    },
    async createEvidence(actionId: string, input: { title: string; type: string; url?: string | null; notes?: string | null; skillId?: string | null; attemptId?: string | null }) {
      const url = evidenceUrl(input.url); const notes = evidenceNotes(input.notes); evidenceContent(url, notes);
      const { data, error } = await client.from('evidence').insert({ action_id: actionId, attempt_id: input.attemptId || null, title: evidenceTitle(input.title), type: evidenceType(input.type), url, notes }).select('*').single();
      if (error) throw safeError(error);
      if (input.skillId) {
        const link = await client.from('evidence_skills').insert({ evidence_id: data.id, skill_id: input.skillId }).select('*').single();
        if (link.error) throw safeError(link.error);
      }
      return data;
    },
    async updateEvidence(id: string, input: { title: string; type: string; url?: string | null; notes?: string | null; skillId?: string | null }) {
      const url = evidenceUrl(input.url); const notes = evidenceNotes(input.notes); evidenceContent(url, notes);
      const { data, error } = await client.from('evidence').update({ title: evidenceTitle(input.title), type: evidenceType(input.type), url, notes }).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      if (input.skillId) {
        const link = await client.from('evidence_skills').insert({ evidence_id: id, skill_id: input.skillId }).select('*').single();
        if (link.error) throw safeError(link.error);
      }
      return data;
    },
    async deleteEvidence(id: string) {
      const { data, error } = await client.from('evidence').delete().eq('id', id).select('id');
      if (error) throw safeError(error);
      if (!data?.length) throw new ServiceError('permission', 'This evidence is unavailable or has already been deleted.');
    },
    async skills(page = 0) {
      const { from, to, size } = pageBounds(page);
      const result = await client.from('user_skills').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to + 1);
      if (result.error) throw safeError(result.error);
      const rows = result.data.slice(0, size);
      if (!rows.length) return { rows: [], hasMore: false };
      const catalog = await client.from('skills').select('id,name,slug,category,difficulty,description').in('id', rows.map(s => s.skill_id));
      if (catalog.error) throw safeError(catalog.error);
      return { rows: rows.map(skill => ({ ...skill, name: catalog.data.find(c => c.id === skill.skill_id)?.name ?? 'Skill unavailable' })), hasMore: result.data.length > size };
    },
    async catalogSkills(filters: { query?: string; category?: string; difficulty?: string } = {}) {
      const clean = skillFilters(filters);
      const page = await this.catalogSkillsPage({ ...clean, page: 0, pageSize: 100 });
      return page.rows;
    },
    async catalogSkillsAll(filters: { query?: string; category?: string; difficulty?: string } = {}) {
      const clean = skillFilters(filters);
      const rows: CatalogSkill[] = [];
      let page = 0;
      do {
        const result = await this.catalogSkillsPage({ ...clean, page, pageSize: 100 });
        rows.push(...result.rows);
        page += 1;
        if (!result.hasMore) break;
      } while (page < 100);
      return rows;
    },
    async discoveryContext() {
      const [skills, relationships, tracked] = await Promise.all([
        this.catalogSkillsAll(),
        client.from('skill_relationships').select('skill_id,prerequisite_id,relationship_type,review_status').eq('relationship_type', 'prerequisite').eq('review_status', 'reviewed'),
        client.from('user_skills').select('skill_id,status'),
      ]);
      if (relationships.error) throw safeError(relationships.error);
      if (tracked.error) throw safeError(tracked.error);
      return { skills, relationships: relationships.data, tracked: tracked.data };
    },
    async nextBestSkill() {
      const model = await this.personalLearningModel();
      const choice = model.nextBestSkill;
      if (!choice) return { recommendation: null, missing: model.blockers.map(b => b.explanation) };
      const skill = (await this.catalogSkillsAll()).find(s => s.id === choice.skillId);
      if (!skill) return { recommendation: null, missing: ['The selected skill is no longer available.'] };
      return { recommendation: { skill, reason: choice.reasons.map(r => r.explanation).join(' ') }, missing: [] as string[] };
    },
    async catalogSkillsPage(filters: SkillCatalogFilters = {}) {
      const clean = catalogPageRange(filters);
      const { from, to } = clean;
      const select = 'id,name,slug,category,subcategory,difficulty,description,estimated_minutes,tags,source_name,source_url,external_id,assessment_type,mastery_criteria,parent_skill_id,review_status,reviewed_at,imported_at,normalized_name,catalog_classification';
      let query = client.from('skills').select(select);
      if (clean.query) {
        query = query.textSearch('search_vector', clean.query, { type: 'websearch', config: 'simple' });
      }
      if (clean.category) query = query.eq('category', clean.category);
      if (clean.subcategory) query = query.eq('subcategory', clean.subcategory);
      if (clean.difficulty) query = query.eq('difficulty', clean.difficulty);
      if (clean.sort === 'name_desc') query = query.order('name', { ascending: false }).order('id', { ascending: false });
      else if (clean.sort === 'newest') query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
      else query = query.order('name').order('id');
      const { data, error } = await query.range(from, to);
      if (error) throw safeError(error);
      const rows = data || [];
      return { rows: rows.slice(0, clean.pageSize), hasMore: rows.length > clean.pageSize, page: clean.page, pageSize: clean.pageSize };
    },
    async skillRelationships(skillId: string) {
      const relationships = await client.from('skill_relationships')
        .select('id,skill_id,prerequisite_id,relationship_type,source_name,source_url,external_id,review_status,review_reason,reviewed_at').or(`skill_id.eq.${skillId},prerequisite_id.eq.${skillId}`);
      if (relationships.error) throw safeError(relationships.error);
      const ids = [...new Set(relationships.data.flatMap(row => [row.skill_id, row.prerequisite_id]))];
      if (!ids.length) return [];
      const skills = await client.from('skills').select('id,name,slug,difficulty,category').in('id', ids);
      if (skills.error) throw safeError(skills.error);
      return relationships.data.map(row => ({
        ...row,
        skill: skills.data.find(skill => skill.id === row.skill_id),
        prerequisite: skills.data.find(skill => skill.id === row.prerequisite_id),
      }));
    },
    async skillMastery(skillId: string, trackingId?: string | null) {
      const [tracked, goals, sessions, actions, evidence] = await Promise.all([
        trackingId ? client.from('user_skills').select('status').eq('id', trackingId).single() : { data: null, error: null },
        this.goals(),
        client.from('learning_sessions').select('id').eq('skill_id', skillId).eq('status', 'completed'),
        client.from('actions').select('id,title,status,user_skill_id,goal_id').order('created_at', { ascending: false }),
        client.from('evidence').select('id,action_id'),
      ]);
      if (tracked.error) throw safeError(tracked.error);
      if (sessions.error) throw safeError(sessions.error);
      if (actions.error) throw safeError(actions.error);
      if (evidence.error) throw safeError(evidence.error);
      const targetGoalIds = new Set(goals.rows.filter(goal => goal.target_skill_id === skillId).map(goal => goal.id));
      const skillActions = actions.data.filter(action => action.user_skill_id === trackingId || (action.goal_id != null && targetGoalIds.has(action.goal_id)));
      const completedActionIds = new Set(skillActions.filter(action => action.status === 'completed').map(action => action.id));
      const evidenceActions = new Set(evidence.data.filter(item => item.action_id != null && completedActionIds.has(item.action_id)).map(item => item.action_id));
      const activeGoal = goals.rows.find(goal => goal.status === 'active' && goal.target_skill_id === skillId);
      const roadmap = activeGoal?.target_skill_id ? await this.roadmap(activeGoal.target_skill_id) : null;
      const current = roadmap?.progress.current ? { id: roadmap.progress.current.id, name: roadmap.progress.current.name } : null;
      const unfinished = skillActions.find(action => action.status !== 'completed' && action.status !== 'cancelled');
      return calculateSkillMastery({ status: tracked.data?.status || null, completedSessions: sessions.data.length, completedActions: completedActionIds.size, evidenceActions: evidenceActions.size, roadmapCurrent: current, skillId, unfinishedAction: unfinished?.title || null });
    },
    async skillGap() {
      const [goals, tracked, actions] = await Promise.all([this.goals(), this.skills(), this.list('actions')]);
      const activeGoals = goals.rows.filter(goal => goal.status === 'active' && goal.target_skill_id && goal.targetSkill);
      const roadmaps = await Promise.all(activeGoals.map(goal => this.roadmap(goal.target_skill_id!)));
      const skillById = new Map(tracked.rows.map(row => [row.skill_id, { id: row.skill_id, name: row.name }]));
      const skillIds = new Set<string>([...activeGoals.map(goal => goal.target_skill_id!), ...roadmaps.flatMap(roadmap => roadmap.steps.map(step => step.id)), ...tracked.rows.map(row => row.skill_id)]);
      const trackingBySkill = new Map(tracked.rows.map(row => [row.skill_id, row.id]));
      const masteries = await Promise.all([...skillIds].map(skillId => this.skillMastery(skillId, trackingBySkill.get(skillId))));
      const masteryBySkill = new Map([...skillIds].map((skillId, index) => [skillId, masteries[index]]));
      const actionFor = (skillId: string, goalId?: string) => {
        const action = actions.rows.find(row => row.status !== 'completed' && row.status !== 'cancelled' && (row.user_skill_id === trackingBySkill.get(skillId) || (goalId && row.goal_id === goalId)));
        return action ? { id: action.id, title: action.title } : undefined;
      };
      const candidates: import('./gaps').GapCandidate[] = activeGoals.flatMap((goal, goalIndex) => {
        const roadmap = roadmaps[goalIndex];
        const current = roadmap.progress.current;
        const goalContext = { id: goal.id, title: goal.title, targetSkillId: goal.target_skill_id! };
        const targetSkill = goal.targetSkill!;
        const candidateFor = (skill: { id: string; name: string }, roadmapCurrent: { id: string; name: string } | null, complete: boolean) => {
          const mastery = masteryBySkill.get(skill.id);
          if (!mastery) return null;
          return { skill, mastery, meaningfulActivity: mastery.components.sessions + mastery.components.actions + mastery.components.evidence > 0, roadmap: { targetSkillId: goal.target_skill_id!, current: roadmapCurrent, complete }, goal: goalContext, action: actionFor(skill.id, skill.id === targetSkill.id ? goal.id : undefined) };
        };
        if (current && current.id !== targetSkill.id) return [candidateFor(current, { id: current.id, name: current.name }, false)].filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate);
        return [candidateFor(targetSkill, current ? { id: current.id, name: current.name } : null, roadmap.progress.complete)].filter((candidate): candidate is NonNullable<typeof candidate> => !!candidate);
      });
      for (const row of tracked.rows) {
        if (candidates.some(candidate => candidate.skill.id === row.skill_id)) continue;
        const mastery = masteryBySkill.get(row.skill_id);
        if (!mastery) continue;
        candidates.push({ skill: skillById.get(row.skill_id)!, mastery, meaningfulActivity: mastery.components.sessions + mastery.components.actions + mastery.components.evidence > 0, action: actionFor(row.skill_id) });
      }
      return selectSkillGap(candidates);
    },
    async roadmap(targetSkillId: string) {
      const [catalog, relationships, tracked, goals] = await Promise.all([
        this.catalogSkillsAll(),
        client.from('skill_relationships').select('skill_id,prerequisite_id,relationship_type').eq('relationship_type', 'prerequisite'),
        this.skills(),
        this.goals(),
      ]);
      if (relationships.error) throw safeError(relationships.error);
      const states = new Map(tracked.rows.map(row => [row.skill_id, { status: row.status }]));
      const roadmap = resolveRoadmap(targetSkillId, catalog, relationships.data, states);
      const targetGoals = goals.rows.filter(goal => goal.target_skill_id === targetSkillId);
      const currentSkillId = roadmap.progress.current?.id;
      const currentGoals = currentSkillId ? goals.rows.filter(goal => goal.target_skill_id === currentSkillId) : [];
      const model = await this.personalLearningModel();
      const adaptivePath = generateAdaptiveLearningPath(model, targetSkillId);
      const experimentSelection = selectLearningExperiment(model, adaptivePath);
      return { ...roadmap, adaptivePath, experimentSelection, evidenceVerification: model.evidenceVerification || null, experimentOutcome: model.experimentOutcome || null, goals: targetGoals, currentGoals };
    },
    async adaptiveLearningPath(targetSkillId?: string | null, assessments: readonly AdaptiveAssessment[] = []) {
      const model = await loadLearningContext(client);
      return generateAdaptiveLearningPath(model, targetSkillId, assessments);
    },
    async learningHistory(filters: { skillId?: string; period?: LearningHistoryPeriod; now?: Date } = {}) {
      let query = client.from('learning_sessions').select('*').eq('status', 'completed').order('started_at', { ascending: false });
      const start = learningHistoryStart(filters.period || 'all', filters.now);
      if (start) query = query.gte('started_at', start);
      if (filters.skillId) query = query.eq('skill_id', filters.skillId);
      const sessions = await query;
      if (sessions.error) throw safeError(sessions.error);
      const rows = sessions.data;
      const skillIds = [...new Set(rows.map(row => row.skill_id))];
      const resourceIds = [...new Set(rows.map(row => row.resource_id).filter((id): id is string => !!id))];
      const goalIds = [...new Set(rows.map(row => row.goal_id).filter((id): id is string => !!id))];
      const actionIds = [...new Set(rows.map(row => row.action_id).filter((id): id is string => !!id))];
      const [skills, resources, goals, actions] = await Promise.all([
        skillIds.length ? client.from('skills').select('id,name').in('id', skillIds) : { data: [], error: null },
        resourceIds.length ? client.from('resources').select('id,title').in('id', resourceIds) : { data: [], error: null },
        goalIds.length ? client.from('goals').select('id,title').in('id', goalIds) : { data: [], error: null },
        actionIds.length ? client.from('actions').select('id,title').in('id', actionIds) : { data: [], error: null },
      ]);
      for (const result of [skills, resources, goals, actions]) if (result.error) throw safeError(result.error);
      const skillById = new Map((skills.data || []).map(skill => [skill.id, skill]));
      const resourceById = new Map((resources.data || []).map(resource => [resource.id, resource]));
      const goalById = new Map((goals.data || []).map(goal => [goal.id, goal]));
      const actionById = new Map((actions.data || []).map(action => [action.id, action]));
      return { rows: rows.map(session => ({ ...session, skill: skillById.get(session.skill_id) || null, resource: session.resource_id ? resourceById.get(session.resource_id) || null : null, goal: session.goal_id ? goalById.get(session.goal_id) || null : null, action: session.action_id ? actionById.get(session.action_id) || null : null })), summary: learningHistorySummary(rows) };
    },
    async dailyLearningPlan(now = new Date(), learningModel?: Awaited<ReturnType<typeof loadLearningContext>>) {
      const day = localDayBounds(now);
      const goals = await this.goals();
      const model = learningModel || await this.personalLearningModel();
      const choice = model.nextAction;
      const gap = null;
      const focusGoal = goals.rows.find(goal => goal.id === choice.goalId) || null;
      const roadmap = focusGoal?.target_skill_id ? await this.roadmap(focusGoal.target_skill_id) : null;
      const selectedSkill = model.snapshot.skills?.find(skill => skill.id === choice.skillId);
      const focus = choice.status === 'ready' && selectedSkill ? { id: selectedSkill.id, name: selectedSkill.name, step: roadmap?.steps.find(s => s.id === selectedSkill.id)?.step || 0, isTarget: selectedSkill.id === focusGoal?.target_skill_id, status: model.skillStates.find(s => s.skillId === selectedSkill.id)?.trackedStatus || 'not_started', reason: choice.reasons[0]?.explanation || '' } : null;
      const tracked = await this.skills();
      const trackedFocus = focus ? tracked.rows.find(row => row.skill_id === focus.id) : null;
      const actionsResult = await client.from('actions').select('*').order('priority', { ascending: true }).order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (actionsResult.error) throw safeError(actionsResult.error);
      const focusGoalIds = new Set([...(focusGoal ? [focusGoal.id] : []), ...((roadmap?.currentGoals || []).map(goal => goal.id))]);
      const actions = selectDailyActions(actionsResult.data.filter(action => (!action.due_at || (action.due_at >= day.start && action.due_at < day.end)) && ((action.goal_id != null && focusGoalIds.has(action.goal_id)) || (trackedFocus && action.user_skill_id === trackedFocus.id))));
      const sessionsResult = await client.from('learning_sessions').select('*').gte('started_at', day.start).lt('started_at', day.end).order('started_at', { ascending: false });
      if (sessionsResult.error) throw safeError(sessionsResult.error);
      const evidence = actions.length ? await client.from('evidence').select('id,action_id').in('action_id', actions.map(action => action.id)) : { data: [], error: null };
      if (evidence.error) throw safeError(evidence.error);
      const resources = focus ? await this.skillResources(focus.id) : [];
      const sessionSummary = dailySessionSummary(sessionsResult.data);
      return { day, gap, focus, focusGoal, trackedFocusId: trackedFocus?.id || null, roadmap, actions, sessions: sessionsResult.data, resources, entry: { trackedSkills: tracked.rows.length, activeGoals: goals.rows.filter(goal => goal.status === 'active').length, meaningfulRoadmap: !!roadmap?.steps.length, planItems: actions.length, sessions: sessionsResult.data.length }, summary: { planItems: actions.length, completedPlanItems: actions.filter(action => action.status === 'completed').length, sessions: sessionSummary.completedSessions, completedSessions: sessionSummary.completedSessions, learningMinutes: sessionSummary.learningMinutes, actions: actions.length, completedActions: actions.filter(action => action.status === 'completed').length, evidence: evidence.data.length } };
    },
    async startSession(skillId: string, goalId?: string | null, actionId?: string | null, resourceId?: string | null) {
      if (resourceId) {
        const link = await client.from('resource_skills').select('resource_id').eq('resource_id', resourceId).eq('skill_id', skillId).single();
        if (link.error) throw new ServiceError('validation', 'This resource is not associated with the selected skill.');
      }
      const { data, error } = await client.from('learning_sessions').insert({ skill_id: skillId, goal_id: goalId || null, action_id: actionId || null, resource_id: resourceId || null }).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async finishSession(id: string, notes?: string | null) {
      const completedAt = new Date().toISOString();
      const existing = await client.from('learning_sessions').select('started_at').eq('id', id).single();
      if (existing.error) throw safeError(existing.error);
      const { data, error } = await client.from('learning_sessions').update({ status: 'completed', completed_at: completedAt, duration_minutes: sessionDurationMinutes(existing.data.started_at, completedAt), notes: sessionNotes(notes) }).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async trackSkill(skillId: string, target: number | null = null) {
      const { data, error } = await client.from('user_skills').insert({ skill_id: skillId, target_mastery: target }).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
    async untrackSkill(id: string) {
      const { error } = await client.from('user_skills').delete().eq('id', id);
      if (error) throw safeError(error);
    },
    async updateSkillState(id: string, status: SkillStatus, target: number | null) {
      const { data, error } = await client.from('user_skills').update({ status: skillStatus(status), target_mastery: target }).eq('id', id).select('*').single();
      if (error) throw safeError(error);
      return data;
    },
  };
}
