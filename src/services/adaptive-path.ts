import type { AssessmentStatus } from './assessment';
import type { PersonalLearningModel, NextBestAction } from './learner';
import type { CapabilityState, CapabilitySource } from './capability';

export type AdaptivePathStatus = 'READY' | 'BLOCKED' | 'IN_PROGRESS' | 'NEEDS_PRACTICE' | 'NEEDS_DEMONSTRATION' | 'NEEDS_EVIDENCE' | 'UNKNOWN' | 'COMPLETED';
export type AdaptiveAssessment = { id?: string; skillId: string; status: AssessmentStatus };
export type AdaptivePathDependency = { skillId: string; skillName: string; status: AdaptivePathStatus };
export type AdaptivePathStep = {
  skillId: string;
  skillName: string;
  position: number;
  status: AdaptivePathStatus;
  reason: string;
  prerequisiteSkillIds: string[];
  learnerEvidenceState: PersonalLearningModel['skillStates'][number]['evidenceLevel'];
  readiness: 'ready' | 'blocked' | 'recorded' | 'unknown';
  recommendedAction: NextBestAction['type'] | null;
  dependencies: AdaptivePathDependency[];
  capabilityState: CapabilityState;
  capabilitySources: CapabilitySource[];
};
export type AdaptiveLearningPath = {
  id: string;
  goalId: string | null;
  targetSkillId: string | null;
  orderedSteps: AdaptivePathStep[];
  currentStep: AdaptivePathStep | null;
  status: AdaptivePathStatus;
  generatedAt: string;
  explanation: string;
  blockers: PersonalLearningModel['blockers'];
  evidenceState: PersonalLearningModel['nextAction']['evidenceLevel'];
};

const assessmentFor = (assessments: readonly AdaptiveAssessment[], skillId: string) => assessments.find(item => item.skillId === skillId)?.status;

/**
 * Build the learner's current route from the reviewed graph and recorded model.
 * This is deliberately a path decision; the model's NextBestAction remains the
 * separate immediate action decision.
 */
export function generateAdaptiveLearningPath(model: PersonalLearningModel, targetSkillId?: string | null, assessments: readonly AdaptiveAssessment[] = []): AdaptiveLearningPath {
  const goal = targetSkillId ? model.activeGoals.find(item => item.target_skill_id === targetSkillId) : model.activeGoals[0];
  const target = targetSkillId || goal?.target_skill_id || null;
  const skills = model.snapshot.skills || [];
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  if (!goal || !target || !byId.has(target)) return { id: `unresolved:${goal?.id || 'none'}:${target || 'none'}`, goalId: goal?.id || null, targetSkillId: target, orderedSteps: [], currentStep: null, status: 'UNKNOWN', generatedAt: model.asOf, explanation: 'Not enough evidence to determine the next learning step.', blockers: model.blockers, evidenceState: model.nextAction.evidenceLevel };

  const prerequisites = new Map<string, string[]>();
  for (const edge of model.snapshot.skill_relationships || []) if (edge.relationship_type === 'prerequisite' && edge.review_status === 'reviewed') prerequisites.set(edge.skill_id, [...(prerequisites.get(edge.skill_id) || []), edge.prerequisite_id]);
  const order: string[] = [], visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => { if (visiting.has(id) || visited.has(id)) return; visiting.add(id); for (const prerequisite of (prerequisites.get(id) || []).sort()) visit(prerequisite); visiting.delete(id); visited.add(id); order.push(id); };
  visit(target);
  const stateFor = (id: string) => model.skillStates.find(state => state.skillId === id);
  const capabilityFor = (id: string) => model.capabilities?.skills.find(state => state.skillId === id);
  const activeIds = new Set((model.snapshot.learning_sessions || []).filter(session => session.status === 'active').map(session => session.skill_id));
  const raw: AdaptivePathStep[] = order.map((id, index) => {
    const skill = byId.get(id)!; const state = stateFor(id); const capability = capabilityFor(id); const capabilityState = capability?.state || 'UNKNOWN'; const assessment = assessmentFor(assessments, id); const evidence = state?.evidenceLevel || 'unknown';
    let status: AdaptivePathStatus = 'UNKNOWN'; let reason = 'This skill has no recorded learner activity yet.'; let action: NextBestAction['type'] | null = null; let readiness: AdaptivePathStep['readiness'] = 'unknown';
    if (capabilityState === 'SUPPORTED' || capabilityState === 'DEMONSTRATED') { status = 'COMPLETED'; reason = capability?.explanation || 'Qualifying evidence is recorded for this skill.'; readiness = 'recorded'; }
    else if (assessment === 'insufficient_evidence') { status = 'NEEDS_EVIDENCE'; reason = 'The previous assessment found insufficient evidence; capture the missing proof before reassessing.'; action = 'add_evidence'; readiness = 'blocked'; }
    else if (assessment === 'partial') { status = 'NEEDS_PRACTICE'; reason = 'The previous assessment was partial; targeted practice is required before reassessment.'; action = 'start_session'; readiness = 'blocked'; }
    else if (activeIds.has(id)) { status = 'IN_PROGRESS'; reason = 'Continue the active session before starting another step.'; action = 'continue_session'; readiness = 'ready'; }
    else if (evidence === 'practice') { status = 'NEEDS_DEMONSTRATION'; reason = 'Practice is recorded, but a demonstration has not been captured.'; action = 'create_demonstration'; readiness = 'blocked'; }
    else if (evidence === 'engagement') { status = 'NEEDS_PRACTICE'; reason = 'Engagement is recorded; add another focused practice activity.'; action = 'start_session'; readiness = 'blocked'; }
    else if (evidence === 'intent') { status = 'READY'; reason = 'Your intent is recorded; start a learning session for this step.'; action = 'start_session'; readiness = 'ready'; }
    else { status = 'READY'; reason = index === 0 ? 'This is the earliest required prerequisite for the target.' : 'This required step is available once its dependencies are satisfied.'; action = 'start_session'; readiness = 'ready'; }
    return { skillId: id, skillName: skill.name, position: index + 1, status, reason, prerequisiteSkillIds: [...(prerequisites.get(id) || [])], learnerEvidenceState: evidence, readiness, recommendedAction: action, dependencies: [] as AdaptivePathDependency[], capabilityState, capabilitySources: capability?.traces.flatMap(trace => trace.sources) || [] };
  });
  for (const step of raw) {
    step.dependencies = step.prerequisiteSkillIds.map(id => { const dependency = raw.find(candidate => candidate.skillId === id); const skill = byId.get(id); return { skillId: id, skillName: skill?.name || id, status: dependency?.status || 'UNKNOWN' }; });
    if (step.status === 'READY' && step.dependencies.length && step.dependencies.every(dependency => dependency.status === 'COMPLETED')) {
      const dependency = step.dependencies[0]; const capability = capabilityFor(dependency.skillId);
      step.reason = `Ready because ${dependency.skillName} is supported by recorded evidence.`;
      if (capability?.traces.length) step.capabilitySources = capability.traces.flatMap(trace => trace.sources);
    }
  }
  let priorIncomplete: AdaptivePathStep | null = null;
  for (const step of raw) {
    if (priorIncomplete && step.status !== 'COMPLETED' && step.status !== 'IN_PROGRESS') { step.status = 'BLOCKED'; step.reason = `Blocked until ${priorIncomplete.skillName} is complete with demonstration or evidence.`; step.recommendedAction = null; step.readiness = 'blocked'; }
    if (step.status !== 'COMPLETED' && !priorIncomplete) priorIncomplete = step;
  }
  const activeIndex = raw.findIndex(step => step.status === 'IN_PROGRESS');
  const firstIncomplete = activeIndex >= 0 ? activeIndex : raw.findIndex(step => step.status !== 'COMPLETED');
  const currentIndex = firstIncomplete < 0 ? raw.length - 1 : firstIncomplete;
  const current = raw[currentIndex] || null;
  if (current && current.status !== 'IN_PROGRESS' && currentIndex > 0 && raw.slice(0, currentIndex).some(step => step.status !== 'COMPLETED')) { const blocker = raw.slice(0, currentIndex).find(step => step.status !== 'COMPLETED')!; current.status = 'BLOCKED'; current.reason = `Blocked until ${blocker.skillName} is complete with demonstration or evidence.`; current.recommendedAction = null; current.readiness = 'blocked'; }
  const pathStatus = current?.status || 'UNKNOWN';
  const explanation = current ? (current.status === 'BLOCKED' ? current.reason : `${current.skillName} is the first path step that needs attention.`) : 'Not enough evidence to determine the next learning step.';
  return { id: `${goal.id}:${target}`, goalId: goal.id, targetSkillId: target, orderedSteps: raw, currentStep: current, status: pathStatus, generatedAt: model.asOf, explanation, blockers: model.blockers, evidenceState: current?.learnerEvidenceState || model.nextAction.evidenceLevel };
}
