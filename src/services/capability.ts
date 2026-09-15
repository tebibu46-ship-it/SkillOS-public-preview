import type { AssessmentStatus } from './assessment';
import type { Blocker, EvidenceLevel, LearningInput, LearningTable, Source } from './learner';
import type { ProjectProofSummary } from './project-proof';
import type { EvidenceVerificationSnapshot } from './verification';

export type CapabilityState = 'UNKNOWN' | 'INTENT' | 'ENGAGED' | 'PRACTICING' | 'DEMONSTRATED' | 'SUPPORTED' | 'PARTIAL' | 'BLOCKED';
export type CapabilitySource = { table: LearningTable | 'assessment'; id: string };
export type CapabilityTraceKind = 'intent' | 'practice' | 'demonstration' | 'evidence' | 'project_claim' | 'project_proof' | 'assessment' | 'prerequisite';
export type EvidenceTrace = {
  skillId: string;
  kind: CapabilityTraceKind;
  sourceId: string | null;
  sources: CapabilitySource[];
  projectId: string | null;
  evidenceId: string | null;
  explanation: string;
  occurredAt: string | null;
  qualifies: boolean;
};
export type CapabilityConflict = {
  type: 'partial_assessment' | 'insufficient_assessment' | 'passed_without_evidence' | 'insufficient_project_proof' | 'rejected_project_proof';
  explanation: string;
  sources: CapabilitySource[];
};
export type CapabilityPrerequisite = {
  skillId: string;
  satisfied: boolean;
  explanation: string;
  sources: CapabilitySource[];
};
export type CapabilityRecord = {
  skillId: string;
  state: CapabilityState;
  satisfiesPrerequisite: boolean;
  traces: EvidenceTrace[];
  blockers: Blocker[];
  conflicts: CapabilityConflict[];
  prerequisites: CapabilityPrerequisite[];
  explanation: string;
};
export type CapabilitySnapshot = {
  version: 1;
  asOf: string;
  skills: CapabilityRecord[];
  unavailableInputs: LearningTable[];
};
export type CapabilityAssessment = { id?: string; skillId: string; status: AssessmentStatus };

type CapabilitySkillState = {
  skillId: string;
  evidenceLevel: EvidenceLevel;
  evidenceCount: number | null;
  activityCount: number | null;
  sources: Source[];
};
type CapabilityInput = {
  asOf: string;
  snapshot: LearningInput;
  skillStates: readonly CapabilitySkillState[];
  projectProofs: readonly ProjectProofSummary[];
  blockers: readonly Blocker[];
  unavailableInputs: readonly LearningTable[];
};

const source = (table: CapabilitySource['table'], id: string): CapabilitySource => ({ table, id });
const sortSources = (sources: readonly CapabilitySource[]) => [...new Map(sources.map(item => [`${item.table}:${item.id}`, item])).values()].sort((a, b) => a.table.localeCompare(b.table) || a.id.localeCompare(b.id));
const assessmentSource = (assessment: CapabilityAssessment): CapabilitySource[] => assessment.id ? [source('assessment', assessment.id)] : [];
const assessmentLabel = (assessment: CapabilityAssessment) => assessment.id ? `Assessment ${assessment.id}` : `The ${assessment.status.replaceAll('_', ' ')} assessment`;
const stateFromEvidence = (level: EvidenceLevel): CapabilityState => ({ unknown: 'UNKNOWN', intent: 'INTENT', engagement: 'ENGAGED', practice: 'PRACTICING', demonstration: 'DEMONSTRATED', evidence: 'SUPPORTED' } as const)[level];

/**
 * Build a source-linked capability projection from the existing learner
 * snapshot. This is pure: it performs no I/O and never invents evidence.
 */
export function deriveCapabilitySnapshot(input: CapabilityInput, assessments: readonly CapabilityAssessment[] = [], verification: EvidenceVerificationSnapshot | null = null): CapabilitySnapshot {
  if (!Number.isFinite(Date.parse(input.asOf))) throw new Error('A valid observation time is required.');
  const skillById = new Map((input.snapshot.skills || []).map(skill => [skill.id, skill]));
  const stateBySkill = new Map(input.skillStates.map(state => [state.skillId, state]));
  const projectProofsBySkill = new Map<string, ProjectProofSummary[]>();
  for (const proof of [...input.projectProofs].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.skillId.localeCompare(b.skillId) || (a.evidenceId || '').localeCompare(b.evidenceId || ''))) {
    projectProofsBySkill.set(proof.skillId, [...(projectProofsBySkill.get(proof.skillId) || []), proof]);
  }
  const assessmentsBySkill = new Map<string, CapabilityAssessment[]>();
  for (const assessment of [...assessments].sort((a, b) => a.skillId.localeCompare(b.skillId) || (a.id || '').localeCompare(b.id || '') || a.status.localeCompare(b.status))) {
    assessmentsBySkill.set(assessment.skillId, [...(assessmentsBySkill.get(assessment.skillId) || []), assessment]);
  }
  const edgesBySkill = new Map<string, NonNullable<LearningInput['skill_relationships']>>();
  for (const edge of input.snapshot.skill_relationships || []) if (edge.relationship_type === 'prerequisite' && edge.review_status === 'reviewed') edgesBySkill.set(edge.skill_id, [...(edgesBySkill.get(edge.skill_id) || []), edge]);
  const evidenceById = new Map((input.snapshot.evidence || []).map(item => [item.id, item]));
  const evidenceLinks = input.snapshot.evidence_skills || [];
  const records = [...(input.snapshot.skills || [])].sort((a, b) => a.id.localeCompare(b.id)).map(skill => {
    const learnerState = stateBySkill.get(skill.id);
    const traces: EvidenceTrace[] = [];
    const proofs = projectProofsBySkill.get(skill.id) || [];
    const skillEvidenceLinks = evidenceLinks.filter(link => link.skill_id === skill.id).sort((a, b) => a.evidence_id.localeCompare(b.evidence_id) || a.id.localeCompare(b.id));
    for (const link of skillEvidenceLinks) {
      const evidence = evidenceById.get(link.evidence_id);
      if (!evidence) continue;
      const verificationApplies = verification?.skillId === skill.id;
      const qualifies = !verificationApplies || verification!.state === 'SUFFICIENT' && verification!.sufficientEvidenceIds.includes(evidence.id);
      const kind: CapabilityTraceKind = evidence.type === 'demo' || evidence.type === 'exercise' || evidence.type === 'artifact' ? 'demonstration' : 'evidence';
      traces.push({ skillId: skill.id, kind, sourceId: evidence.id, sources: sortSources([source('evidence', evidence.id), source('evidence_skills', link.id)]), projectId: evidence.project_id, evidenceId: evidence.id, explanation: qualifies ? (kind === 'demonstration' ? 'Explicit demonstration-style evidence is attributed to this skill.' : 'Explicit evidence is attributed to this skill.') : 'Evidence is attributed to this skill but does not satisfy the selected experiment requirements.', occurredAt: null, qualifies });
    }
    for (const proof of proofs) {
      const kind: CapabilityTraceKind = proof.status === 'CLAIMED' ? 'project_claim' : 'project_proof';
      traces.push({ skillId: skill.id, kind, sourceId: proof.evidenceId || proof.projectId, sources: sortSources(proof.sources), projectId: proof.projectId, evidenceId: proof.evidenceId, explanation: proof.explanation, occurredAt: null, qualifies: proof.status === 'SUPPORTED' });
    }
    for (const item of learnerState?.sources || []) {
      if (item.table === 'learning_sessions' || item.table === 'actions') traces.push({ skillId: skill.id, kind: 'practice', sourceId: item.id, sources: [source(item.table, item.id)], projectId: null, evidenceId: null, explanation: 'Recorded practice activity contributes to the learning state but does not establish capability by itself.', occurredAt: null, qualifies: false });
      else if (item.table === 'user_skills' || item.table === 'goals') traces.push({ skillId: skill.id, kind: 'intent', sourceId: item.id, sources: [source(item.table, item.id)], projectId: null, evidenceId: null, explanation: 'Tracking or goal context records intent for this skill.', occurredAt: null, qualifies: false });
    }
    const skillAssessments = assessmentsBySkill.get(skill.id) || [];
    for (const assessment of skillAssessments) traces.push({ skillId: skill.id, kind: 'assessment', sourceId: assessment.id || null, sources: assessmentSource(assessment), projectId: null, evidenceId: null, explanation: `${assessmentLabel(assessment)} reports ${assessment.status.replaceAll('_', ' ')}.`, occurredAt: null, qualifies: false });

    const conflicts: CapabilityConflict[] = [];
    const supportedProof = proofs.some(proof => proof.status === 'SUPPORTED');
    for (const proof of proofs.filter(item => item.status === 'INSUFFICIENT' || item.status === 'REJECTED')) conflicts.push({ type: proof.status === 'REJECTED' ? 'rejected_project_proof' : 'insufficient_project_proof', explanation: proof.explanation, sources: sortSources(proof.sources) });
    for (const assessment of skillAssessments) {
      if (assessment.status === 'partial') conflicts.push({ type: 'partial_assessment', explanation: `${assessmentLabel(assessment)} reports partial performance.`, sources: assessmentSource(assessment) });
      if (assessment.status === 'insufficient_evidence') conflicts.push({ type: 'insufficient_assessment', explanation: `${assessmentLabel(assessment)} reports insufficient evidence.`, sources: assessmentSource(assessment) });
      if (assessment.status === 'passed' && !supportedProof && !traces.some(trace => trace.qualifies && (trace.kind === 'demonstration' || trace.kind === 'evidence'))) conflicts.push({ type: 'passed_without_evidence', explanation: `${assessmentLabel(assessment)} passed, but no qualifying evidence is linked to this skill.`, sources: assessmentSource(assessment) });
    }
    const unavailable = input.unavailableInputs.length > 0;
    let state: CapabilityState = unavailable ? 'BLOCKED' : stateFromEvidence(learnerState?.evidenceLevel || 'unknown');
    const verificationApplies = verification?.skillId === skill.id;
    const verificationSufficient = !verificationApplies || verification!.state === 'SUFFICIENT';
    if (supportedProof || learnerState?.evidenceLevel === 'evidence' && verificationSufficient) state = unavailable ? 'BLOCKED' : 'SUPPORTED';
    else if (learnerState?.evidenceLevel === 'demonstration' && verificationSufficient) state = unavailable ? 'BLOCKED' : 'DEMONSTRATED';
    else if (!supportedProof && skillAssessments.some(item => item.status === 'partial')) state = unavailable ? 'BLOCKED' : 'PARTIAL';

    const prerequisites: CapabilityPrerequisite[] = (edgesBySkill.get(skill.id) || []).sort((a, b) => a.prerequisite_id.localeCompare(b.prerequisite_id) || a.id.localeCompare(b.id)).map(edge => {
      const prerequisite = stateBySkill.get(edge.prerequisite_id);
      const satisfied = !input.unavailableInputs.length && stateBySkill.has(edge.prerequisite_id) && (stateFromEvidence(prerequisite!.evidenceLevel) === 'SUPPORTED' || stateFromEvidence(prerequisite!.evidenceLevel) === 'DEMONSTRATED' || (projectProofsBySkill.get(edge.prerequisite_id) || []).some(proof => proof.status === 'SUPPORTED'));
      const prerequisiteProofs = projectProofsBySkill.get(edge.prerequisite_id) || [];
      const refs = [source('skill_relationships', edge.id), source('skills', edge.prerequisite_id), ...prerequisiteProofs.filter(proof => proof.status === 'SUPPORTED').flatMap(proof => proof.sources)];
      return { skillId: edge.prerequisite_id, satisfied, explanation: satisfied ? `Prerequisite ${skillById.get(edge.prerequisite_id)?.name || edge.prerequisite_id} is supported by recorded evidence.` : `Blocked because prerequisite ${skillById.get(edge.prerequisite_id)?.name || edge.prerequisite_id} has no qualifying evidence.`, sources: sortSources(refs) };
    });
    const satisfiesPrerequisite = state === 'SUPPORTED' || state === 'DEMONSTRATED';
    const explanation = unavailable ? `Capability is blocked because learning inputs are unavailable: ${input.unavailableInputs.join(', ')}.` : state === 'SUPPORTED' ? (supportedProof ? 'Supported by explicit project evidence.' : 'Supported by explicit evidence attributed to this skill.') : state === 'DEMONSTRATED' ? 'The learner recorded a demonstration through explicit evidence.' : state === 'PARTIAL' ? 'The supplied assessment was partial and no independent qualifying proof is linked.' : state === 'PRACTICING' ? 'The learner is practicing this skill; no qualifying demonstration is recorded.' : state === 'ENGAGED' ? 'The learner has started working on this skill.' : state === 'INTENT' ? 'The learner has recorded intent to develop this skill.' : 'No qualifying capability evidence is recorded.';
    return { skillId: skill.id, state, satisfiesPrerequisite, traces: traces.sort((a, b) => (a.sourceId || '').localeCompare(b.sourceId || '') || a.kind.localeCompare(b.kind)), blockers: input.blockers.filter(blocker => blocker.sources.some(item => item.table === 'skills' && item.id === skill.id)), conflicts: conflicts.sort((a, b) => a.type.localeCompare(b.type) || a.explanation.localeCompare(b.explanation)), prerequisites, explanation };
  });
  return { version: 1, asOf: input.asOf, skills: records, unavailableInputs: [...input.unavailableInputs].sort() };
}
