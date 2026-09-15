import { ServiceError } from './errors';

export type RoadmapSkill = { id: string; name: string; category?: string | null; difficulty?: string | null };
export type RoadmapRelationship = { skill_id: string; prerequisite_id: string; relationship_type: string };
export type RoadmapState = { status: string };
export type RoadmapStep = RoadmapSkill & { step: number; isTarget: boolean; status: string; reason: string };
export type RoadmapProgress = {
  completed: number;
  total: number;
  current: RoadmapStep | null;
  next: RoadmapStep | null;
  complete: boolean;
};

export type RoadmapResult = { target: RoadmapSkill; steps: RoadmapStep[]; progress: RoadmapProgress };

export function resolveRoadmap(targetId: string, skills: RoadmapSkill[], relationships: RoadmapRelationship[], states: Map<string, RoadmapState> = new Map()): RoadmapResult {
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const target = byId.get(targetId);
  if (!target) throw new ServiceError('validation', 'That target skill is not available.');
  const prerequisites = new Map<string, string[]>();
  for (const relation of relationships.filter(item => item.relationship_type === 'prerequisite').sort((a, b) => `${a.skill_id}:${a.prerequisite_id}`.localeCompare(`${b.skill_id}:${b.prerequisite_id}`))) {
    if (!byId.has(relation.skill_id) || !byId.has(relation.prerequisite_id)) throw new ServiceError('database', 'This skill graph contains a missing prerequisite relationship.');
    const values = prerequisites.get(relation.skill_id) || [];
    values.push(relation.prerequisite_id); prerequisites.set(relation.skill_id, values);
  }
  const state = new Map<string, 0 | 1 | 2>(); const ordered: Array<{ id: string; dependents: string[] }> = [];
  const visit = (id: string, dependents: string[]): void => {
    const current = state.get(id) || 0;
    if (current === 1) throw new ServiceError('database', `This skill graph contains a prerequisite cycle involving ${byId.get(id)?.name || id}.`);
    if (current === 2) return;
    state.set(id, 1);
    for (const prerequisite of prerequisites.get(id) || []) visit(prerequisite, [id, ...dependents]);
    state.set(id, 2); ordered.push({ id, dependents });
  };
  visit(targetId, []);
  const steps = ordered.map((entry, index) => { const skill = byId.get(entry.id)!; const parent = entry.dependents[0] ? byId.get(entry.dependents[0]) : undefined; return { ...skill, step: index + 1, isTarget: entry.id === targetId, status: states.get(entry.id)?.status || 'not_started', reason: parent ? `Required prerequisite for ${parent.name}.` : 'Selected destination skill.' }; });
  const completed = steps.filter(step => step.status === 'completed').length;
  const currentIndex = steps.findIndex(step => step.status !== 'completed');
  return {
    target,
    steps,
    progress: {
      completed,
      total: steps.length,
      current: currentIndex >= 0 ? steps[currentIndex] : null,
      next: currentIndex >= 0 ? steps[currentIndex + 1] || null : null,
      complete: currentIndex < 0,
    },
  };
}
