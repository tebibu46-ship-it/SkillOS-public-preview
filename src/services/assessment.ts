export type AssessmentStatus = 'not_attempted' | 'attempted' | 'partial' | 'passed' | 'insufficient_evidence';
export type AssessmentPrompt = {
  id: string;
  skillId: string;
  prompt: string;
  expectedOutcome: string;
  evidenceTypes: readonly string[];
};
export type AssessmentAttempt = {
  assessmentId: string;
  response: string | null;
  evaluator?: 'manual';
  status?: Exclude<AssessmentStatus, 'not_attempted'>;
  feedback?: string | null;
};
export type AssessmentResult = Omit<AssessmentAttempt, 'status'> & {
  status: AssessmentStatus;
  evidenceRequired: boolean;
};

export type DurableAssessmentStatus = 'ATTEMPTED' | 'PARTIAL' | 'PASSED' | 'INSUFFICIENT_EVIDENCE';
export type AssessmentContractSnapshot = Pick<AssessmentPrompt, 'id' | 'skillId' | 'prompt' | 'expectedOutcome' | 'evidenceTypes'>;
export type DurableAssessment = {
  id: string;
  attemptId: string;
  contractSnapshot: AssessmentContractSnapshot;
  response: string | null;
  evaluator: 'manual';
  status: DurableAssessmentStatus;
  feedback: string | null;
  evaluatedAt: string | null;
  provenance: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

const toDurableStatus: Record<Exclude<AssessmentStatus, 'not_attempted'>, DurableAssessmentStatus> = {
  attempted: 'ATTEMPTED', partial: 'PARTIAL', passed: 'PASSED', insufficient_evidence: 'INSUFFICIENT_EVIDENCE',
};
const fromDurableStatus: Record<DurableAssessmentStatus, Exclude<AssessmentStatus, 'not_attempted'>> = {
  ATTEMPTED: 'attempted', PARTIAL: 'partial', PASSED: 'passed', INSUFFICIENT_EVIDENCE: 'insufficient_evidence',
};

export function assessmentContractSnapshot(prompt: AssessmentPrompt): AssessmentContractSnapshot {
  const id = prompt.id.trim(); const skillId = prompt.skillId.trim(); const text = prompt.prompt.trim(); const expectedOutcome = prompt.expectedOutcome.trim();
  if (!id || !skillId || !text || !expectedOutcome || text.length > 4000 || expectedOutcome.length > 4000) throw new Error('The assessment contract is invalid or exceeds its bounds.');
  return { id, skillId, prompt: text, expectedOutcome, evidenceTypes: assessmentEvidenceTypes(prompt) };
}

export function durableAssessmentStatus(status: Exclude<AssessmentStatus, 'not_attempted'>): DurableAssessmentStatus {
  return toDurableStatus[status];
}

export function runtimeAssessmentStatus(status: DurableAssessmentStatus): Exclude<AssessmentStatus, 'not_attempted'> {
  return fromDurableStatus[status];
}

/** Select the latest explicit evaluation without destroying historical facts. */
export function latestAssessment<T extends Pick<DurableAssessment, 'evaluatedAt' | 'createdAt' | 'id'>>(assessments: readonly T[]): T | null {
  return [...assessments].sort((a, b) => (b.evaluatedAt || '').localeCompare(a.evaluatedAt || '') || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0] || null;
}

/**
 * Manual assessment boundary. Without a stored response, the attempt is unknown;
 * without an explicit human result, it remains attempted. This function never
 * converts time, clicks, or a session into a pass.
 */
export function assessManualAttempt(prompt: AssessmentPrompt, attempt?: AssessmentAttempt | null): AssessmentResult {
  if (!attempt || !attempt.response?.trim()) return { assessmentId: prompt.id, response: null, evaluator: attempt?.evaluator, feedback: attempt?.feedback, status: 'not_attempted', evidenceRequired: true };
  const status = attempt.status && ['partial', 'passed', 'insufficient_evidence'].includes(attempt.status) ? attempt.status : 'attempted';
  return { ...attempt, assessmentId: prompt.id, status, evidenceRequired: status !== 'passed' };
}

export function assessmentEvidenceTypes(prompt: AssessmentPrompt): string[] {
  return [...new Set(prompt.evidenceTypes)].sort();
}
