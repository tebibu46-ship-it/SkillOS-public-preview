import type { Row } from '../domain/database';

export type ProjectProofStatus = 'CLAIMED' | 'SUPPORTED' | 'INSUFFICIENT' | 'REJECTED';
export type ProjectArtifact = {
  projectId: string;
  evidenceId: string;
  type: Row<'evidence'>['type'];
  title: string;
  reference: string | null;
  description: string | null;
  createdAt: string;
};
export type ProjectProof = {
  projectId: string;
  skillId: string;
  evidenceId: string | null;
  artifact: ProjectArtifact | null;
  claim: string | null;
  status: ProjectProofStatus;
  explanation: string;
  createdAt: string | null;
  updatedAt: string | null;
};
export type ProjectProofSummary = {
  projectId: string;
  skillId: string;
  evidenceId: string | null;
  status: ProjectProofStatus;
  explanation: string;
  sources: { table: 'projects' | 'project_skills' | 'evidence' | 'evidence_skills'; id: string }[];
};

type ProjectProofInput = {
  projects: Pick<Row<'projects'>, 'id'>[];
  projectSkills: Pick<Row<'project_skills'>, 'id' | 'project_id' | 'skill_id' | 'created_at' | 'updated_at'>[];
  evidence: Pick<Row<'evidence'>, 'id' | 'project_id' | 'title' | 'type' | 'url' | 'notes' | 'created_at' | 'updated_at'>[];
  evidenceSkills: Pick<Row<'evidence_skills'>, 'id' | 'evidence_id' | 'skill_id'>[];
};

const hasReference = (item: ProjectProofInput['evidence'][number]) => Boolean(item.url || item.notes?.trim());

/**
 * Project proof is a projection over the existing projects, evidence and
 * attribution tables. Project status and project association alone never
 * become skill proof.
 */
export function deriveProjectProofs(input: ProjectProofInput): ProjectProof[] {
  const projectIds = new Set(input.projects.map(project => project.id));
  const linksByEvidence = new Map<string, string[]>();
  for (const link of input.evidenceSkills) linksByEvidence.set(link.evidence_id, [...(linksByEvidence.get(link.evidence_id) || []), link.skill_id]);
  const pairs = new Map<string, { projectId: string; skillId: string; createdAt: string | null; updatedAt: string | null }>();
  for (const link of input.projectSkills) if (projectIds.has(link.project_id)) pairs.set(`${link.project_id}:${link.skill_id}`, { projectId: link.project_id, skillId: link.skill_id, createdAt: link.created_at, updatedAt: link.updated_at });
  for (const evidence of input.evidence) {
    if (!evidence.project_id || !projectIds.has(evidence.project_id)) continue;
    for (const skillId of linksByEvidence.get(evidence.id) || []) if (!pairs.has(`${evidence.project_id}:${skillId}`)) pairs.set(`${evidence.project_id}:${skillId}`, { projectId: evidence.project_id, skillId, createdAt: evidence.created_at, updatedAt: evidence.updated_at });
  }
  return [...pairs.values()].sort((a, b) => a.projectId.localeCompare(b.projectId) || a.skillId.localeCompare(b.skillId)).map(pair => {
    const candidates = input.evidence.filter(evidence => evidence.project_id === pair.projectId && (linksByEvidence.get(evidence.id) || []).includes(pair.skillId)).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const artifact = candidates[0] || null;
    const status: ProjectProofStatus = artifact ? (hasReference(artifact) ? 'SUPPORTED' : 'INSUFFICIENT') : 'CLAIMED';
    const explanation = status === 'SUPPORTED'
      ? 'This artifact supports the explicit skill demonstration claim.'
      : status === 'INSUFFICIENT'
      ? 'The project references this skill, but the supporting evidence reference is incomplete.'
      : 'The project references this skill, but no supporting evidence has been attached.';
    return { projectId: pair.projectId, skillId: pair.skillId, evidenceId: artifact?.id || null, artifact: artifact ? { projectId: pair.projectId, evidenceId: artifact.id, type: artifact.type, title: artifact.title, reference: artifact.url, description: artifact.notes, createdAt: artifact.created_at } : null, claim: artifact?.notes || null, status, explanation, createdAt: artifact?.created_at || pair.createdAt, updatedAt: artifact?.updated_at || pair.updatedAt };
  });
}
