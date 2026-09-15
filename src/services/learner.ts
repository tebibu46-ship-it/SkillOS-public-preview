import type { Row } from '../domain/database';
import type { ProjectProofSummary } from './project-proof';
import { deriveCapabilitySnapshot } from './capability';

// Explicit projections exclude identity, free-text notes, URLs and credentials.
export type LearningRecords = {
  goals: Pick<Row<'goals'>, 'id' | 'status' | 'target_skill_id' | 'priority' | 'deadline'>;
  skills: Pick<Row<'skills'>, 'id' | 'name' | 'difficulty' | 'estimated_minutes' | 'review_status' | 'catalog_classification'>;
  user_skills: Pick<Row<'user_skills'>, 'id' | 'skill_id' | 'status'>;
  skill_relationships: Pick<Row<'skill_relationships'>, 'id' | 'skill_id' | 'prerequisite_id' | 'relationship_type' | 'review_status'>;
  learning_sessions: Pick<Row<'learning_sessions'>, 'id' | 'skill_id' | 'goal_id' | 'action_id' | 'status' | 'started_at' | 'completed_at' | 'duration_minutes'>;
  actions: Pick<Row<'actions'>, 'id' | 'goal_id' | 'user_skill_id' | 'project_id' | 'status' | 'priority' | 'estimated_minutes' | 'completed_at'>;
  evidence: Pick<Row<'evidence'>, 'id' | 'action_id' | 'project_id'> & Partial<Pick<Row<'evidence'>, 'attempt_id' | 'type' | 'url' | 'notes' | 'created_at' | 'updated_at'>> & { reference_present?: boolean; reference_valid?: boolean };
  evidence_skills: Pick<Row<'evidence_skills'>, 'id' | 'evidence_id' | 'skill_id'>;
  projects: Pick<Row<'projects'>, 'id' | 'goal_id' | 'status' | 'estimated_minutes'>;
  project_skills: Pick<Row<'project_skills'>, 'id' | 'project_id' | 'skill_id'>;
};
export type LearningTable = keyof LearningRecords;
export type LearningInput = { [K in LearningTable]: LearningRecords[K][] | null };
export const learningColumns: { [K in LearningTable]: string } = {
  goals: 'id,status,target_skill_id,priority,deadline', skills: 'id,name,difficulty,estimated_minutes,review_status,catalog_classification',
  user_skills: 'id,skill_id,status', skill_relationships: 'id,skill_id,prerequisite_id,relationship_type,review_status',
  learning_sessions: 'id,skill_id,goal_id,action_id,status,started_at,completed_at,duration_minutes',
  actions: 'id,goal_id,user_skill_id,project_id,status,priority,estimated_minutes,completed_at',
  evidence: 'id,action_id,project_id,attempt_id,type,created_at,updated_at', evidence_skills: 'id,evidence_id,skill_id',
  projects: 'id,goal_id,status,estimated_minutes', project_skills: 'id,project_id,skill_id',
};
export type Source = { table: LearningTable; id: string };
export type Reason = { type: string; explanation: string; sources: Source[] };
export type Blocker = Reason & { affected: Source | null; resolution: string | null };
export type EvidenceLevel = 'unknown' | 'intent' | 'engagement' | 'practice' | 'demonstration' | 'evidence';
export type NextBestAction = {
  status: 'ready' | 'insufficient_evidence'; type: 'continue_session' | 'resolve_prerequisite' | 'start_session' | 'complete_action' | 'create_demonstration' | 'add_evidence' | 'clarify_goal' | 'inspect_context';
  skillId: string | null; goalId: string | null; entityId: string | null;
  priority: number; estimatedMinutes: number | null; evidenceLevel: EvidenceLevel; reasons: Reason[]; blockers: Blocker[];
};
const source = (table: LearningTable, id: string): Source => ({ table, id });
const stable = <T extends { id: string }>(rows: readonly T[]) => [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const eligible = (skill: LearningRecords['skills']) => skill.review_status === 'reviewed' && skill.catalog_classification !== 'needs_review';

export function derivePersonalLearningModel(input: LearningInput, asOf: string) {
  if (!Number.isFinite(Date.parse(asOf))) throw new Error('A valid observation time is required.');
  // Project again at the pure boundary so a caller cannot accidentally serialize PII.
  const snapshot = Object.fromEntries((Object.keys(learningColumns) as LearningTable[]).map(table => [table, input[table] === null ? null : stable(input[table] as { id: string }[]).map(row => {
    const projected = Object.fromEntries(learningColumns[table].split(',').map(key => {
      const value = (row as unknown as Record<string, unknown>)[key];
      return [key, value];
    })) as Record<string, unknown>;
    if (table === 'evidence') {
      const raw = row as unknown as Record<string, unknown>;
      const url = typeof raw.url === 'string' ? raw.url.trim() : '';
      const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';
      projected.reference_present = typeof raw.reference_present === 'boolean' ? raw.reference_present : !!(url || notes);
      projected.reference_valid = typeof raw.reference_valid === 'boolean' ? raw.reference_valid : !!notes || (() => { try { const parsed = new URL(url); return parsed.protocol === 'http:' || parsed.protocol === 'https:'; } catch { return false; } })();
    }
    return projected;
  })])) as LearningInput;
  const missing = (Object.keys(snapshot) as LearningTable[]).filter(key => snapshot[key] === null);
  const goals = (snapshot.goals || []).filter(g => g.status === 'active').sort((a, b) => a.priority - b.priority || (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.id.localeCompare(b.id));
  const skills = snapshot.skills || [], tracked = snapshot.user_skills || [], sessions = snapshot.learning_sessions || [], actions = snapshot.actions || [], evidence = snapshot.evidence || [];
  const byId = new Map(skills.map(s => [s.id, s]));
  const states = new Map(tracked.map(t => [t.skill_id, t]));
  const blockers: Blocker[] = [];
  const block = (type: string, affected: Source | null, explanation: string, sources: Source[], resolution: string | null) => blockers.push({ type, affected, explanation, sources, resolution });
  const skillStates = skills.map(skill => {
    const tracking = states.get(skill.id);
    const linkedEvidence = snapshot.evidence_skills || [];
    const actionHasExplicitOtherSkill = (actionId: string) => evidence.some(e => e.action_id === actionId && linkedEvidence.some(link => link.evidence_id === e.id && link.skill_id !== skill.id));
    const skillActions = actions.filter(a => a.user_skill_id === tracking?.id || (!a.user_skill_id && !!a.goal_id && goals.some(g => g.id === a.goal_id && g.target_skill_id === skill.id) && !actionHasExplicitOtherSkill(a.id)));
    const completedSessions = sessions.filter(s => s.skill_id === skill.id && s.status === 'completed');
    const activeSessions = sessions.filter(s => s.skill_id === skill.id && s.status === 'active');
    const completedActions = skillActions.filter(a => a.status === 'completed');
    const proof = evidence.filter(e => linkedEvidence.some(l => l.evidence_id === e.id && l.skill_id === skill.id) || (!!e.action_id && skillActions.some(a => a.id === e.action_id) && !linkedEvidence.some(l => l.evidence_id === e.id)));
    // A session linked to a completed action is one activity, not two.
    const activity = completedSessions.length + completedActions.filter(a => !completedSessions.some(s => s.action_id === a.id)).length;
    const demonstrations = proof.filter(item => item.type === 'demo' || item.type === 'exercise' || item.type === 'artifact');
    const level: EvidenceLevel = demonstrations.length ? 'demonstration' : proof.length ? 'evidence' : activity >= 2 ? 'practice' : activity || activeSessions.length || skillActions.some(a => a.status === 'in_progress') ? 'engagement' : tracking || goals.some(g => g.target_skill_id === skill.id) ? 'intent' : 'unknown';
    const timestamps = [...completedSessions.map(s => s.completed_at), ...completedActions.map(a => a.completed_at)].filter((t): t is string => !!t).sort();
    return { skillId: skill.id, trackedStatus: tracking?.status ?? null, eligible: eligible(skill), difficulty: skill.difficulty, estimatedMinutes: skill.estimated_minutes, evidenceLevel: level, completedSessions: snapshot.learning_sessions === null ? null : completedSessions.length, activeSessionIds: activeSessions.map(s => s.id), completedActionIds: completedActions.map(a => a.id), evidenceCount: snapshot.evidence === null || snapshot.evidence_skills === null || snapshot.actions === null ? null : proof.length, activityCount: snapshot.learning_sessions === null || snapshot.actions === null ? null : activity, lastPracticedAt: timestamps.at(-1) ?? null, recentSessionIds: completedSessions.filter(s => s.completed_at && Date.parse(s.completed_at) <= Date.parse(asOf) && Date.parse(s.completed_at) >= Date.parse(asOf) - 7 * 86400000).map(s => s.id), sources: [...(tracking ? [source('user_skills', tracking.id)] : []), ...completedSessions.map(s => source('learning_sessions', s.id)), ...activeSessions.map(s => source('learning_sessions', s.id)), ...skillActions.filter(a => a.status === 'completed' || a.status === 'in_progress').map(a => source('actions', a.id)), ...proof.map(e => source('evidence', e.id)), ...goals.filter(g => g.target_skill_id === skill.id).map(g => source('goals', g.id))] };
  });
  if (missing.length) block('unavailable_data', null, `Learning inputs unavailable: ${missing.join(', ')}.`, [], 'Reload the learning context.');
  if (snapshot.goals && !goals.length) block('missing_goal', null, 'No active goal defines a learning direction.', [], 'Create or activate a goal.');
  const active = sessions.filter(s => s.status === 'active').sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id));
  for (const s of active) block('active_session', source('learning_sessions', s.id), 'A learning session is unfinished.', [source('learning_sessions', s.id)], 'Continue the existing session.');
  const candidates: { skillId: string; goalId: string; reasons: Reason[] }[] = [];
  for (const goal of goals) {
    const gs = source('goals', goal.id);
    if (!goal.target_skill_id) { block('missing_target', gs, 'This goal has no target skill.', [gs], 'Choose a target skill in Goals.'); continue; }
    const visited = new Set<string>(), visiting = new Set<string>(), order: string[] = [], edges: Source[] = [];
    let invalid = false;
    const visit = (id: string): void => {
      if (visiting.has(id)) { invalid = true; block('invalid_graph', gs, 'The goal dependency graph contains a cycle.', [gs, ...edges], null); return; }
      if (visited.has(id)) return;
      const skill = byId.get(id);
      if (!skill || !eligible(skill)) { invalid = true; block(skill ? 'ineligible_skill' : 'missing_catalog_skill', gs, 'A target or required skill is unavailable for reviewed recommendations.', [gs, ...(skill ? [source('skills', id)] : [])], 'Review the catalog context before selecting new work.'); return; }
      visiting.add(id);
      for (const edge of snapshot.skill_relationships || []) if (edge.skill_id === id && edge.relationship_type === 'prerequisite') {
        edges.push(source('skill_relationships', edge.id));
        if (edge.review_status !== 'reviewed') { invalid = true; block('unreviewed_relationship', gs, 'A required relationship is not reviewed.', [gs, source('skill_relationships', edge.id)], 'Wait for catalog review.'); }
        else visit(edge.prerequisite_id);
      }
      visiting.delete(id); visited.add(id); order.push(id);
    };
    visit(goal.target_skill_id);
    if (invalid) continue;
    const prerequisiteSatisfied = (id: string) => {
      const state = skillStates.find(item => item.skillId === id);
      return state?.evidenceLevel === 'demonstration' || state?.evidenceLevel === 'evidence';
    };
    const next = order.find(id => !prerequisiteSatisfied(id));
    if (!next) continue;
    const reasons: Reason[] = [{ type: 'active_goal_alignment', explanation: 'This skill is on the prerequisite-first path to an active goal, ordered by stored goal priority, deadline, then ID.', sources: [gs, source('skills', goal.target_skill_id), ...edges] }];
    if (next !== goal.target_skill_id) {
      const refs = [gs, source('skills', next), ...edges, ...(states.has(next) ? [source('user_skills', states.get(next)!.id)] : [])];
      block('missing_prerequisite', gs, `${byId.get(next)!.name} is an unresolved prerequisite; completion is the learner's recorded state, not a mastery assessment.`, refs, `Work on ${byId.get(next)!.name} first.`);
      reasons.push({ type: 'prerequisite_required', explanation: 'This is the first unresolved prerequisite in the reviewed dependency path.', sources: refs });
    }
    if (states.get(next)?.status === 'paused') { block('paused_skill', source('user_skills', states.get(next)!.id), 'The next tracked skill is paused.', [source('user_skills', states.get(next)!.id)], 'Review the paused skill before starting work.'); continue; }
    candidates.push({ skillId: next, goalId: goal.id, reasons });
  }
  const candidate = missing.length ? null : candidates[0] || null;
  if (!candidate && !missing.length) block('no_eligible_candidate', null, 'No unresolved reviewed skill can be selected from the current goal context.', goals.map(g => source('goals', g.id)), 'Select a goal target or review its catalog dependencies.');
  const selectedState = skillStates.find(s => s.skillId === candidate?.skillId);
  if (selectedState && (selectedState.activityCount || 0) > 0 && selectedState.evidenceCount === 0) block('evidence_gap', source('skills', selectedState.skillId), 'Activity is recorded, but no proof is linked to this skill. Activity does not establish mastery.', selectedState.sources, 'Attach proof to a completed action when available.');
  const projectProofs: ProjectProofSummary[] = [];
  const projectSkillPairs = new Map<string, { projectId: string; skillId: string; projectSkillId: string }>();
  for (const link of snapshot.project_skills || []) projectSkillPairs.set(`${link.project_id}:${link.skill_id}`, { projectId: link.project_id, skillId: link.skill_id, projectSkillId: link.id });
  for (const item of snapshot.evidence || []) {
    if (!item.project_id) continue;
    for (const link of (snapshot.evidence_skills || []).filter(candidateLink => candidateLink.evidence_id === item.id)) {
      const key = `${item.project_id}:${link.skill_id}`;
      const pair = projectSkillPairs.get(key);
      if (pair) projectProofs.push({ projectId: pair.projectId, skillId: pair.skillId, evidenceId: item.id, status: 'SUPPORTED', explanation: 'This skill is supported by explicit project evidence.', sources: [{ table: 'projects', id: pair.projectId }, { table: 'project_skills', id: pair.projectSkillId }, { table: 'evidence', id: item.id }, { table: 'evidence_skills', id: link.id }] });
    }
  }
  for (const pair of projectSkillPairs.values()) if (!projectProofs.some(proof => proof.projectId === pair.projectId && proof.skillId === pair.skillId)) projectProofs.push({ projectId: pair.projectId, skillId: pair.skillId, evidenceId: null, status: 'CLAIMED', explanation: 'This project references the skill, but supporting evidence is incomplete.', sources: [{ table: 'projects', id: pair.projectId }, { table: 'project_skills', id: pair.projectSkillId }] });
  projectProofs.sort((a, b) => a.projectId.localeCompare(b.projectId) || a.skillId.localeCompare(b.skillId));
  let nextAction: NextBestAction = { status: 'insufficient_evidence', type: goals.length ? 'inspect_context' : 'clarify_goal', skillId: null, goalId: null, entityId: null, priority: 99, estimatedMinutes: null, evidenceLevel: goals.length || tracked.length ? 'intent' : 'unknown', reasons: [{ type: 'insufficient_data', explanation: missing.length ? 'The learning context is incomplete; no new work is recommended.' : 'Choose an active goal and reviewed target to establish a direction.', sources: goals.map(g => source('goals', g.id)) }], blockers };
  if (active.length && !missing.length) {
    const s = active[0]; nextAction = { ...nextAction, status: 'ready', type: 'continue_session', skillId: s.skill_id, goalId: s.goal_id, entityId: s.id, priority: 0, evidenceLevel: skillStates.find(t => t.skillId === s.skill_id)?.evidenceLevel || 'engagement', reasons: [{ type: 'active_session', explanation: 'Continue the oldest active session before starting new work.', sources: [source('learning_sessions', s.id)] }] };
  } else if (candidate) {
    const tracking = states.get(candidate.skillId);
    const relatedActions = actions.filter(a => a.user_skill_id === tracking?.id || (!a.user_skill_id && a.goal_id === candidate.goalId && goals.find(g => g.id === candidate.goalId)?.target_skill_id === candidate.skillId));
    const unfinished = relatedActions.filter(a => a.status === 'todo' || a.status === 'in_progress').sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))[0];
    const unproven = relatedActions.find(a => a.status === 'completed' && !evidence.some(e => e.action_id === a.id));
    const action = unfinished || unproven;
    const projectClaim = (snapshot.project_skills || []).find(link => link.skill_id === candidate.skillId);
    const createDemonstration = selectedState!.evidenceLevel === 'practice' && !selectedState!.evidenceCount;
    const projectProofGap = !!projectClaim && !selectedState!.evidenceCount && selectedState!.evidenceLevel !== 'demonstration' && selectedState!.evidenceLevel !== 'evidence';
    const type = unfinished ? 'complete_action' : unproven ? 'add_evidence' : createDemonstration || projectProofGap ? 'create_demonstration' : candidate.reasons.some(r => r.type === 'prerequisite_required') ? 'resolve_prerequisite' : 'start_session';
    const demonstrationReason = createDemonstration ? [{ type: 'demonstration_gap', explanation: 'Practice is recorded, but no demonstration has been captured for this prerequisite.', sources: selectedState!.sources }] : [];
    const projectReason = projectProofGap && projectClaim ? [{ type: 'project_proof_gap', explanation: 'A project references this skill, but no supporting project evidence is attached.', sources: [source('projects', projectClaim.project_id), source('project_skills', projectClaim.id)] }] : [];
    nextAction = { status: 'ready', type, skillId: candidate.skillId, goalId: candidate.goalId, entityId: action?.id || projectClaim?.project_id || null, priority: unfinished ? 1 : unproven ? 2 : createDemonstration || projectProofGap ? 2 : 3, estimatedMinutes: unfinished?.estimated_minutes ?? null, evidenceLevel: selectedState!.evidenceLevel, reasons: [...candidate.reasons, ...demonstrationReason, ...projectReason, ...(action ? [{ type: unfinished ? 'incomplete_action' : 'evidence_gap', explanation: unfinished ? 'A linked action is unfinished.' : 'A completed action has no attached proof.', sources: [source('actions', action.id)] }] : [])], blockers };
  }
  const baseModel = { version: 1 as const, asOf, snapshot, unavailableInputs: missing, activeGoals: goals.map(g => ({ ...g, completedActionCount: snapshot.actions === null ? null : actions.filter(a => a.goal_id === g.id && a.status === 'completed').length, actionCount: snapshot.actions === null ? null : actions.filter(a => a.goal_id === g.id).length })), skillStates, projectProofs, activeProjects: (snapshot.projects || []).filter(p => p.status === 'active').map(p => ({ ...p, linkedSkillIds: snapshot.project_skills === null ? null : snapshot.project_skills.filter(l => l.project_id === p.id).map(l => l.skill_id), unfinishedActionIds: snapshot.actions === null ? null : actions.filter(a => a.project_id === p.id && !['completed', 'cancelled'].includes(a.status)).map(a => a.id), evidenceIds: snapshot.evidence === null ? null : evidence.filter(e => e.project_id === p.id).map(e => e.id) })), blockers, nextBestSkill: candidate, nextAction };
  const capabilities = deriveCapabilitySnapshot(baseModel);
  if (candidate) {
    const capability = capabilities.skills.find(item => item.skillId === candidate.skillId);
    if (capability) {
      const traceSources = capability.traces.flatMap(trace => trace.sources).filter(item => item.table !== 'assessment').map(item => ({ table: item.table as LearningTable, id: item.id }));
      baseModel.nextAction = { ...baseModel.nextAction, reasons: [...baseModel.nextAction.reasons, { type: 'capability_state', explanation: capability.explanation, sources: traceSources }] };
    }
  }
  return { ...baseModel, capabilities };
}
export type PersonalLearningModel = ReturnType<typeof derivePersonalLearningModel>;
