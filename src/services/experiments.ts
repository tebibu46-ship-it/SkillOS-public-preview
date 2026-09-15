import type { AdaptiveLearningPath, AdaptivePathStep } from './adaptive-path';
import type { PersonalLearningModel, Source } from './learner';
import type { EvidenceVerificationSnapshot } from './verification';

export type ExperimentLifecycle = 'PROPOSED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type ExperimentResult = 'NOT_EVALUATED' | 'PASSED' | 'PARTIAL' | 'FAILED';
export type ExperimentEvaluationMode = 'deterministic' | 'manual';
export type EvidenceType = 'repository' | 'deployment' | 'screenshot' | 'demo' | 'certificate' | 'writing' | 'exercise' | 'artifact';
export type ExperimentStep = { id: string; order: number; title: string; instruction: string; required: boolean };
export type AcceptanceCriterion = { id: string; order: number; statement: string; required: boolean };
export type EvidenceRequirement = {
  id: string;
  type: EvidenceType;
  description: string;
  required: boolean;
  criterionIds: string[];
};
export type ExperimentConstraint = { id: string; order: number; statement: string };
export type ExperimentTemplate = {
  key: string;
  skillId: string;
  prerequisiteSkillId?: string | null;
  title: string;
  objective: string;
  definitionVersion: number;
  steps: readonly ExperimentStep[];
  acceptanceCriteria: readonly AcceptanceCriterion[];
  evidenceRequirements: readonly EvidenceRequirement[];
  constraints: readonly ExperimentConstraint[];
  /** Compatibility projection for legacy callers. */
  successConditions: readonly string[];
  estimatedMinutes: number | null;
  evaluationMode: ExperimentEvaluationMode;
  sourceName: string;
};
export type LearningExperiment = {
  id: string;
  skillId: string;
  prerequisiteSkillId: string | null;
  goalId: string | null;
  projectId: string | null;
  templateKey: string;
  definitionVersion: number;
  title: string;
  objective: string;
  steps: ExperimentStep[];
  acceptanceCriteria: AcceptanceCriterion[];
  constraints: ExperimentConstraint[];
  successConditions: string[];
  evidenceRequirements: EvidenceRequirement[];
  estimatedMinutes: number | null;
  evaluationMode: ExperimentEvaluationMode;
  status: Extract<ExperimentLifecycle, 'PROPOSED' | 'READY'>;
  source: { kind: 'template'; key: string; name: string };
  createdAt: string;
};
export type ExperimentAttempt = {
  id: string;
  experimentId: string;
  experimentDefinitionVersion?: number;
  actionId: string | null;
  status: ExperimentLifecycle;
  result: ExperimentResult;
  startedAt: string | null;
  completedAt: string | null;
  evaluatedAt: string | null;
  assessmentId: string | null;
  evidenceIds: string[];
  goalId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
  createdAt?: string | null;
  idempotencyKey?: string;
  provenance?: ExperimentProvenance;
};
export type AttemptEvidenceScope = { attemptId: string; evidenceIds: string[]; source: 'explicit_attempt_link' };
export type ExperimentAttemptOutcome = {
  attemptId: string;
  lifecycle: ExperimentLifecycle;
  result: ExperimentResult;
  verification: EvidenceVerificationSnapshot | null;
  evidenceScope: AttemptEvidenceScope;
  linkedRecords: { actionId: string | null; sessionId: string | null; projectId: string | null; goalId: string | null; assessmentId: string | null };
  provenance: Source[];
};
export type ExperimentOutcomeSnapshot = {
  experimentId: string;
  current: ExperimentAttemptOutcome | null;
  history: ExperimentAttemptOutcome[];
  conflicts: { results: ExperimentResult[]; attemptIds: string[] }[];
  nextUnmetRequirement: string | null;
  reason: string;
};
export type ExperimentProvenance = {
  skillId: string;
  adaptiveStep: { skillId: string; position: number; status: AdaptivePathStep['status'] };
  capabilityState: string;
  blocker: string | null;
  templateKey: string | null;
  goalId: string | null;
  projectId: string | null;
  actionId: string | null;
  attemptId: string | null;
  evidenceIds: string[];
  sources: Source[];
};
export type ExperimentSelection = {
  status: 'SELECTED' | 'NO_TEMPLATE_AVAILABLE' | 'INELIGIBLE' | 'UNAVAILABLE';
  experiment: LearningExperiment | null;
  reason: string;
  provenance: ExperimentProvenance | null;
};

/** Resolve a historical definition by both immutable identity components. */
export function resolveExperimentDefinitionForAttempt(attempt: Pick<ExperimentAttempt, 'experimentId' | 'experimentDefinitionVersion'>, definitions: readonly LearningExperiment[]): LearningExperiment | null {
  if (!Number.isInteger(attempt.experimentDefinitionVersion) || (attempt.experimentDefinitionVersion as number) < 1) return null;
  const matches = definitions.filter(definition => definition.id === attempt.experimentId && definition.definitionVersion === attempt.experimentDefinitionVersion);
  return matches.length === 1 ? matches[0] : null;
}

export const C36_FILE_PROCESSING_SKILL_ID = '00000000-0000-4000-8000-00000000c362';

const evidenceTypes = new Set<EvidenceType>(['repository', 'deployment', 'screenshot', 'demo', 'certificate', 'writing', 'exercise', 'artifact']);
const limits = { steps: 50, criteria: 50, evidence: 50, constraints: 20, id: 80, text: 4000 } as const;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const bounded = (value: unknown, max: number = limits.text): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const validateOrdered = (items: readonly unknown[], max: number, keys: readonly string[], check: (item: Record<string, unknown>) => boolean) => {
  if (!Array.isArray(items) || items.length > max) return false;
  const ids = new Set<string>();
  return items.every((item, index) => isRecord(item) && exactKeys(item, keys) && typeof item.id === 'string' && bounded(item.id, limits.id) && !ids.has(item.id) && ids.add(item.id) && item.order === index + 1 && check(item));
};

/** Validate and canonicalize a persisted/template definition without adding any semantic fields. */
export function validateExperimentDefinition(input: unknown): input is Pick<LearningExperiment, 'definitionVersion' | 'steps' | 'acceptanceCriteria' | 'evidenceRequirements' | 'constraints' | 'successConditions'> {
  if (!isRecord(input) || !Number.isInteger(input.definitionVersion) || (input.definitionVersion as number) < 1) return false;
  const steps = input.steps, criteria = input.acceptanceCriteria, evidence = input.evidenceRequirements, constraints = input.constraints;
  if (!validateOrdered(steps as unknown[], limits.steps, ['id', 'order', 'title', 'instruction', 'required'], item => bounded(item.title, 240) && bounded(item.instruction) && typeof item.required === 'boolean')) return false;
  if (!validateOrdered(criteria as unknown[], limits.criteria, ['id', 'order', 'statement', 'required'], item => bounded(item.statement) && typeof item.required === 'boolean')) return false;
  if (!validateOrdered(constraints as unknown[], limits.constraints, ['id', 'order', 'statement'], item => bounded(item.statement))) return false;
  if (!Array.isArray(evidence) || evidence.length > limits.evidence) return false;
  const criterionIds = new Set((criteria as unknown[]).filter(isRecord).map(item => item.id));
  const evidenceIds = new Set<string>();
  if (!(evidence as unknown[]).every(item => isRecord(item) && exactKeys(item, ['id', 'type', 'description', 'required', 'criterionIds']) && typeof item.id === 'string' && bounded(item.id, limits.id) && !evidenceIds.has(item.id) && evidenceIds.add(item.id) && evidenceTypes.has(item.type as EvidenceType) && bounded(item.description) && typeof item.required === 'boolean' && Array.isArray(item.criterionIds) && item.criterionIds.every(id => typeof id === 'string' && criterionIds.has(id)) && new Set(item.criterionIds).size === item.criterionIds.length)) return false;
  if (!Array.isArray(input.successConditions) || input.successConditions.length !== (criteria as unknown[]).length || !(input.successConditions as unknown[]).every((item, index) => item === (criteria as any[])[index].statement)) return false;
  return true;
}

export const normalizeExperimentTemplateDefinition = (template: ExperimentTemplate): Pick<LearningExperiment, 'definitionVersion' | 'steps' | 'acceptanceCriteria' | 'evidenceRequirements' | 'constraints' | 'successConditions'> => {
  const version = template.definitionVersion;
  if (!Number.isInteger(version) || version < 1) throw new Error('Experiment definition version must be a positive integer.');
  const criteria = template.acceptanceCriteria?.length ? template.acceptanceCriteria.map(item => ({ ...item })) : (template.successConditions || []).map((statement, index) => ({ id: `criterion-${index + 1}`, order: index + 1, statement, required: true }));
  const steps = template.steps?.length ? template.steps.map(item => ({ ...item })) : version === 1 && bounded(template.objective) ? [{ id: 'step-1', order: 1, title: 'Complete the experiment', instruction: template.objective, required: true }] : [];
  const evidence = (template.evidenceRequirements || []).map((item, index) => ({ id: item.id || `evidence-${index + 1}`, type: item.type, description: item.description, required: item.required, criterionIds: [...(item.criterionIds || [])] }));
  const result = { definitionVersion: version, steps, acceptanceCriteria: criteria, evidenceRequirements: evidence, constraints: (template.constraints || []).map(item => ({ ...item })), successConditions: criteria.map(item => item.statement) };
  if (!validateExperimentDefinition(result)) throw new Error('Invalid experiment definition.');
  return result;
};

/** Product-authored templates. Unknown skills fail closed. */
export const experimentTemplates: readonly ExperimentTemplate[] = [
  {
    key: 'python-file-processing-csv-cli-v1',
    skillId: C36_FILE_PROCESSING_SKILL_ID,
    prerequisiteSkillId: '00000000-0000-4000-8000-00000000c361',
    title: 'Build a CSV Filtering CLI',
    objective: 'Demonstrate the ability to read structured file data, filter records, and produce a correct output file.',
    definitionVersion: 1,
    steps: [],
    acceptanceCriteria: [
      { id: 'criterion-1', order: 1, statement: 'Read CSV input.', required: true },
      { id: 'criterion-2', order: 2, statement: 'Apply a defined filtering condition.', required: true },
      { id: 'criterion-3', order: 3, statement: 'Write valid CSV output.', required: true },
      { id: 'criterion-4', order: 4, statement: 'Correctly pass three deterministic test cases.', required: true },
    ],
    successConditions: [
      'Read CSV input.',
      'Apply a defined filtering condition.',
      'Write valid CSV output.',
      'Correctly pass three deterministic test cases.',
    ],
    evidenceRequirements: [
      { id: 'evidence-1', type: 'repository', description: 'Repository or source code for the CLI.', required: true, criterionIds: [] },
      { id: 'evidence-2', type: 'artifact', description: 'A representative output CSV produced by the CLI.', required: true, criterionIds: [] },
    ],
    constraints: [],
    estimatedMinutes: 45,
    evaluationMode: 'manual',
    sourceName: 'C3.6 reviewed local template',
  },
];

const eligibleStatuses = new Set<AdaptivePathStep['status']>(['READY', 'NEEDS_DEMONSTRATION', 'NEEDS_EVIDENCE']);
const source = (table: Source['table'], id: string): Source => ({ table, id });
const stableTemplates = (templates: readonly ExperimentTemplate[]) => [...templates].filter(item => { try { normalizeExperimentTemplateDefinition(item); return true; } catch { return false; } }).sort((a, b) => a.skillId.localeCompare(b.skillId) || a.key.localeCompare(b.key) || b.definitionVersion - a.definitionVersion || JSON.stringify(normalizeExperimentTemplateDefinition(a)).localeCompare(JSON.stringify(normalizeExperimentTemplateDefinition(b))));

function provenance(step: AdaptivePathStep, model: PersonalLearningModel, template: ExperimentTemplate | null, goalId: string | null): ExperimentProvenance {
  const capability = model.capabilities?.skills.find(item => item.skillId === step.skillId);
  const sources = [
    source('skills', step.skillId),
    ...(model.snapshot.skill_relationships || []).filter(edge => edge.skill_id === step.skillId && edge.relationship_type === 'prerequisite' && edge.review_status === 'reviewed').map(edge => source('skill_relationships', edge.id)),
    ...step.capabilitySources.filter(item => item.table !== 'assessment').map(item => ({ table: item.table as Source['table'], id: item.id })),
    ...(goalId ? [source('goals', goalId)] : []),
  ];
  return {
    skillId: step.skillId,
    adaptiveStep: { skillId: step.skillId, position: step.position, status: step.status },
    capabilityState: capability?.state || step.capabilityState,
    blocker: step.status === 'BLOCKED' ? step.reason : null,
    templateKey: template?.key || null,
    goalId,
    projectId: null,
    actionId: null,
    attemptId: null,
    evidenceIds: [],
    sources: [...new Map(sources.map(item => [`${item.table}:${item.id}`, item])).values()].sort((a, b) => a.table.localeCompare(b.table) || a.id.localeCompare(b.id)),
  };
}

function buildExperiment(template: ExperimentTemplate, step: AdaptivePathStep, goalId: string | null, now: string): LearningExperiment {
  const definition = normalizeExperimentTemplateDefinition(template);
  const id = definition.definitionVersion === 1 ? `experiment:${template.skillId}:${template.key}:${goalId || 'none'}:none` : `experiment:${template.skillId}:${template.key}:v${definition.definitionVersion}:${goalId || 'none'}:none`;
  return {
    id,
    skillId: template.skillId,
    prerequisiteSkillId: template.prerequisiteSkillId || step.prerequisiteSkillIds[0] || null,
    goalId,
    projectId: null,
    templateKey: template.key,
    definitionVersion: definition.definitionVersion,
    title: template.title,
    objective: template.objective,
    steps: definition.steps.map(item => ({ ...item })),
    acceptanceCriteria: definition.acceptanceCriteria.map(item => ({ ...item })),
    constraints: definition.constraints.map(item => ({ ...item })),
    successConditions: [...definition.successConditions],
    evidenceRequirements: definition.evidenceRequirements.map(item => ({ ...item, criterionIds: [...item.criterionIds] })),
    estimatedMinutes: template.estimatedMinutes,
    evaluationMode: template.evaluationMode,
    status: step.status === 'READY' ? 'READY' : 'PROPOSED',
    source: { kind: 'template', key: template.key, name: template.sourceName },
    createdAt: now,
  };
}

/** Select one reviewed, bounded experiment for the path's current eligible step. */
export function selectLearningExperiment(model: PersonalLearningModel, path: AdaptiveLearningPath | null | undefined, templates: readonly ExperimentTemplate[] = experimentTemplates, now = model.asOf): ExperimentSelection {
  if (!path || !path.currentStep) return { status: 'UNAVAILABLE', experiment: null, reason: 'An adaptive path is unavailable, so no experiment can be selected.', provenance: null };
  const step = path.currentStep;
  const baseProvenance = provenance(step, model, null, path.goalId);
  if (!eligibleStatuses.has(step.status)) return { status: 'INELIGIBLE', experiment: null, reason: `No experiment is available while ${step.skillName} is ${step.status.replaceAll('_', ' ').toLowerCase()}.`, provenance: baseProvenance };
  const template = stableTemplates(templates).find(item => item.skillId === step.skillId) || null;
  if (!template) return { status: 'NO_TEMPLATE_AVAILABLE', experiment: null, reason: `No reviewed experiment template is available for ${step.skillName}.`, provenance: baseProvenance };
  const experiment = buildExperiment(template, step, path.goalId || model.activeGoals[0]?.id || null, now);
  return { status: 'SELECTED', experiment, reason: `${step.skillName} is the next eligible learning step and has a reviewed experiment template.`, provenance: provenance(step, model, template, experiment.goalId) };
}

const transitions: Record<ExperimentLifecycle, readonly ExperimentLifecycle[]> = {
  PROPOSED: ['READY', 'ABANDONED'],
  READY: ['IN_PROGRESS', 'ABANDONED'],
  IN_PROGRESS: ['COMPLETED', 'ABANDONED'],
  COMPLETED: [],
  ABANDONED: [],
};

export function createExperimentAttempt(experiment: LearningExperiment, input: { attemptId: string; actionId?: string | null; idempotencyKey?: string; now?: string }): ExperimentAttempt {
  if (!input.attemptId.trim()) throw new Error('An explicit attempt ID is required.');
  return { id: input.attemptId, experimentId: experiment.id, experimentDefinitionVersion: experiment.definitionVersion, actionId: input.actionId || null, status: 'PROPOSED', result: 'NOT_EVALUATED', startedAt: null, completedAt: null, evaluatedAt: null, assessmentId: null, evidenceIds: [], idempotencyKey: input.idempotencyKey };
}

/** Derive a bounded, categorical outcome view. Historical attempts remain intact; the
 * current attempt is the most recently evaluated one, then most recently created. */
export function deriveExperimentOutcomeSnapshot(experiment: LearningExperiment, attempts: readonly ExperimentAttempt[], verifications: ReadonlyMap<string, EvidenceVerificationSnapshot | null> = new Map()): ExperimentOutcomeSnapshot {
  const orderedAttempts = [...attempts].filter(attempt => attempt.experimentId === experiment.id).sort((a, b) => (b.evaluatedAt || b.completedAt || b.startedAt || '').localeCompare(a.evaluatedAt || a.completedAt || a.startedAt || '') || b.id.localeCompare(a.id));
  const history = orderedAttempts.map(attempt => {
    const verification = verifications.get(attempt.id) || null;
    const provenance: Source[] = [source('skills', experiment.skillId), ...(experiment.goalId ? [source('goals', experiment.goalId)] : []), ...(attempt.actionId ? [source('actions', attempt.actionId)] : []), ...attempt.evidenceIds.map(id => source('evidence', id))];
    return { attemptId: attempt.id, lifecycle: attempt.status, result: attempt.result, verification, evidenceScope: { attemptId: attempt.id, evidenceIds: [...new Set(attempt.evidenceIds)].sort(), source: 'explicit_attempt_link' as const }, linkedRecords: { actionId: attempt.actionId, sessionId: attempt.sessionId || null, projectId: attempt.projectId || null, goalId: attempt.goalId || experiment.goalId || null, assessmentId: attempt.assessmentId }, provenance: [...new Map(provenance.map(item => [`${item.table}:${item.id}`, item])).values()] };
  });
  const current = history[0] || null;
  const byResult = new Map<ExperimentResult, string[]>();
  for (const item of history) if (item.result !== 'NOT_EVALUATED') byResult.set(item.result, [...(byResult.get(item.result) || []), item.attemptId]);
  const conflicts = byResult.size > 1 ? [{ results: [...byResult.keys()].sort(), attemptIds: [...byResult.values()].flat().sort() }] : [];
  const nextUnmetRequirement = current?.verification?.missingRequirementKeys[0] || null;
  const reason = !current ? 'No durable attempt has been recorded.' : current.result === 'NOT_EVALUATED' ? (current.lifecycle === 'COMPLETED' ? 'Attempt completed and is awaiting explicit evaluation.' : `Attempt is ${current.lifecycle.toLowerCase().replace('_', ' ')}.`) : `Attempt is explicitly ${current.result.toLowerCase()}.`;
  return { experimentId: experiment.id, current, history, conflicts, nextUnmetRequirement, reason };
}

export function transitionExperimentAttempt(attempt: ExperimentAttempt, status: ExperimentLifecycle, now: string): ExperimentAttempt {
  if (attempt.status === status) return attempt;
  if (!transitions[attempt.status].includes(status)) throw new Error(`Cannot move an experiment attempt from ${attempt.status} to ${status}.`);
  return { ...attempt, status, startedAt: status === 'IN_PROGRESS' ? now : attempt.startedAt, completedAt: status === 'COMPLETED' || status === 'ABANDONED' ? now : attempt.completedAt };
}

export function recordExperimentResult(attempt: ExperimentAttempt, result: ExperimentResult, input: { now: string; assessmentId?: string | null; evidenceIds?: readonly string[] }): ExperimentAttempt {
  if (attempt.status !== 'COMPLETED') throw new Error('An experiment result can only be recorded after completion.');
  if (result === 'NOT_EVALUATED') throw new Error('A completed attempt cannot be reset to NOT_EVALUATED.');
  if (attempt.result !== 'NOT_EVALUATED') {
    if (attempt.result !== result) throw new Error('An evaluated attempt result is immutable.');
    if ((input.assessmentId || null) !== (attempt.assessmentId || null)) throw new Error('An evaluated attempt assessment association is immutable.');
    return attempt;
  }
  return { ...attempt, result, evaluatedAt: input.now, assessmentId: input.assessmentId || null, evidenceIds: [...new Set(input.evidenceIds || [])].sort() };
}
