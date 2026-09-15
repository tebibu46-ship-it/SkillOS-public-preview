import type { LearningExperiment } from './experiments';
import type { LearningInput, PersonalLearningModel } from './learner';

export type VerificationMode = 'DETERMINISTIC' | 'MANUAL' | 'UNAVAILABLE';
export type VerificationState = 'MISSING' | 'PRESENT' | 'ATTRIBUTED' | 'SUFFICIENT' | 'INSUFFICIENT' | 'MANUAL_VERIFICATION_REQUIRED' | 'UNAVAILABLE' | 'REJECTED';
export type VerificationDimensions = {
  presence: boolean;
  attribution: boolean;
  relevance: boolean;
  completeness: boolean;
  structuralUsability: boolean;
  evaluation: 'not_required' | 'manual_required' | 'unavailable';
};
export type VerificationProvenance = {
  evidenceId: string | null;
  evidenceType: string | null;
  evidenceSkillId: string | null;
  skillId: string;
  projectId: string | null;
  projectSkillId: string | null;
  experimentId: string;
  attemptId: string | null;
  assessmentId: string | null;
  requirementKey: string;
  mode: VerificationMode;
  state: VerificationState;
  explanation: string;
  createdAt: string | null;
  updatedAt: string | null;
};
export type RequirementVerification = {
  requirementKey: string;
  requirementType: string;
  required: boolean;
  mode: VerificationMode;
  state: VerificationState;
  dimensions: VerificationDimensions;
  evidenceIds: string[];
  attributedEvidenceIds: string[];
  provenance: VerificationProvenance[];
  explanation: string;
};
export type EvidenceVerificationSnapshot = {
  version: 1;
  skillId: string;
  experimentId: string;
  attemptId: string | null;
  assessmentId: string | null;
  mode: VerificationMode;
  state: VerificationState;
  requirements: RequirementVerification[];
  sufficientEvidenceIds: string[];
  missingRequirementKeys: string[];
  reasons: string[];
  provenance: VerificationProvenance[];
};

const manualTypes = new Set(['demo', 'screenshot', 'writing', 'certificate']);
const knownTypes = new Set(['repository', 'deployment', 'screenshot', 'demo', 'certificate', 'writing', 'exercise', 'artifact']);
const source = (row: { id: string; project_id?: string | null }, links: NonNullable<LearningInput['project_skills']>, skillId: string) =>
  row.project_id ? links.find(link => link.project_id === row.project_id && link.skill_id === skillId)?.id || null : null;

const usableReference = (evidence: { url?: string | null; notes?: string | null; reference_present?: boolean; reference_valid?: boolean }) => {
  if (typeof evidence.reference_valid === 'boolean') return evidence.reference_present === true && evidence.reference_valid;
  if (evidence.notes?.trim()) return true;
  if (!evidence.url?.trim()) return false;
  try {
    const url = new URL(evidence.url);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const ordered = <T extends { id: string }>(rows: readonly T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

/**
 * Derive requirement-level evidence verification from the learner snapshot.
 * This function is pure and deliberately performs no network or file access.
 */
export function verifyExperimentEvidence(model: Pick<PersonalLearningModel, 'snapshot' | 'asOf'>, experiment: LearningExperiment, input: { attemptId?: string | null; assessmentId?: string | null; evidenceIds?: readonly string[] } = {}): EvidenceVerificationSnapshot {
  const evidence = model.snapshot.evidence;
  const links = model.snapshot.evidence_skills;
  const projectSkills = model.snapshot.project_skills || [];
  const unavailable = evidence === null || links === null;
  const scopedIds = input.evidenceIds ? new Set(input.evidenceIds) : null;
  const scopedAttemptId = input.attemptId || null;
  // Durable attempt ownership is authoritative; caller IDs may only narrow it.
  const rows = (evidence || []).filter(item => (!scopedAttemptId || item.attempt_id === scopedAttemptId) && (!scopedIds || scopedIds.has(item.id)));
  const linkByEvidence = new Map<string, NonNullable<LearningInput['evidence_skills']>>();
  for (const link of links || []) linkByEvidence.set(link.evidence_id, [...(linkByEvidence.get(link.evidence_id) || []), link]);
  const requirements: RequirementVerification[] = experiment.evidenceRequirements.map((requirement, index) => {
    const requirementKey = `${requirement.type}:${index + 1}`;
    const matching = ordered(rows.filter(item => item.type === requirement.type));
    const attributed = matching.filter(item => (linkByEvidence.get(item.id) || []).some(link => link.skill_id === experiment.skillId));
    const usable = attributed.filter(item => usableReference(item));
    const unknownType = !knownTypes.has(requirement.type);
    const requiresManual = manualTypes.has(requirement.type);
    const dimensions: VerificationDimensions = {
      presence: matching.length > 0,
      attribution: attributed.length > 0,
      relevance: matching.length > 0,
      completeness: !requirement.required || usable.length > 0,
      structuralUsability: usable.length > 0,
      evaluation: unknownType ? 'unavailable' : requiresManual ? 'manual_required' : 'not_required',
    };
    let mode: VerificationMode = unknownType || unavailable ? 'UNAVAILABLE' : requiresManual && usable.length > 0 ? 'MANUAL' : 'DETERMINISTIC';
    let state: VerificationState;
    let explanation: string;
    if (unavailable) {
      state = 'UNAVAILABLE'; explanation = 'Evidence or attribution records are unavailable in the learning snapshot.';
    } else if (unknownType) {
      state = 'UNAVAILABLE'; explanation = `The evidence requirement type ${requirement.type} has no safe deterministic matcher.`;
    } else if (!matching.length) {
      state = 'MISSING'; explanation = `Required ${requirement.description.toLowerCase()} is missing.`;
    } else if (!attributed.length) {
      state = 'INSUFFICIENT'; explanation = `Matching evidence exists, but none is explicitly attributed to the claimed skill.`;
    } else if (!usable.length) {
      state = 'INSUFFICIENT'; explanation = 'Attributed evidence has no usable URL or notes reference.';
    } else if (requiresManual) {
      state = 'MANUAL_VERIFICATION_REQUIRED'; explanation = 'The evidence exists and is attributed, but a person must inspect it.';
    } else {
      state = 'SUFFICIENT'; explanation = 'The required evidence exists, is attributed, relevant, and structurally usable.';
    }
    if (!requirement.required && state === 'MISSING') state = 'PRESENT';
    const provenance = matching.map(item => {
      const link = (linkByEvidence.get(item.id) || []).find(candidate => candidate.skill_id === experiment.skillId) || null;
      return {
        evidenceId: item.id, evidenceType: item.type || null, evidenceSkillId: link?.id || null, skillId: experiment.skillId,
        projectId: item.project_id || null, projectSkillId: source(item, projectSkills, experiment.skillId), experimentId: experiment.id,
        attemptId: input.attemptId || null, assessmentId: input.assessmentId || null, requirementKey, mode, state,
        explanation, createdAt: 'created_at' in item && typeof item.created_at === 'string' ? item.created_at : null,
        updatedAt: 'updated_at' in item && typeof item.updated_at === 'string' ? item.updated_at : null,
      } satisfies VerificationProvenance;
    });
    return { requirementKey, requirementType: requirement.type, required: requirement.required, mode, state, dimensions, evidenceIds: matching.map(item => item.id), attributedEvidenceIds: attributed.map(item => item.id), provenance, explanation };
  });
  const required = requirements.filter(item => item.required);
  const requiredWithUnavailable = required.some(item => item.state === 'UNAVAILABLE');
  const manual = required.some(item => item.state === 'MANUAL_VERIFICATION_REQUIRED');
  const insufficient = required.some(item => !['SUFFICIENT'].includes(item.state));
  const state: VerificationState = unavailable || requiredWithUnavailable ? 'UNAVAILABLE' : manual ? 'MANUAL_VERIFICATION_REQUIRED' : insufficient ? 'INSUFFICIENT' : 'SUFFICIENT';
  const mode: VerificationMode = state === 'UNAVAILABLE' ? 'UNAVAILABLE' : state === 'MANUAL_VERIFICATION_REQUIRED' ? 'MANUAL' : 'DETERMINISTIC';
  const missingRequirementKeys = required.filter(item => item.state !== 'SUFFICIENT').map(item => item.requirementKey);
  const sufficientEvidenceIds = [...new Set(required.filter(item => item.state === 'SUFFICIENT').flatMap(item => item.attributedEvidenceIds))].sort();
  const reasons = required.filter(item => item.state !== 'SUFFICIENT').map(item => `${item.requirementKey}: ${item.explanation}`);
  const provenance = requirements.flatMap(item => item.provenance).map(item => ({ ...item, mode, state }));
  return { version: 1, skillId: experiment.skillId, experimentId: experiment.id, attemptId: input.attemptId || null, assessmentId: input.assessmentId || null, mode, state, requirements, sufficientEvidenceIds, missingRequirementKeys, reasons, provenance };
}
