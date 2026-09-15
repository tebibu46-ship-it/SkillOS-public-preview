import type { CatalogSkill } from './skills';

export type DiscoveryAnswers = {
  goal: string;
  experience: 'new' | 'some' | 'working';
  minutesPerDay: number;
  area: string;
  outcome: string;
};

export type DiscoveryRelationship = { skill_id: string; prerequisite_id: string; relationship_type: string; review_status?: string };
export type DiscoveryTrackedSkill = { skill_id: string; status: 'learning' | 'practicing' | 'paused' | 'completed' };
export type DiscoveryRecommendation = {
  skill: CatalogSkill;
  score: number;
  reason: string;
  prerequisites: string[];
  estimatedMinutes: number | null;
  factors: { relevance: number; readiness: number; difficulty: number; time: number; quality: number };
};
export type DiscoveryGoal = { id: string; title: string; targetSkillName?: string | null; area?: string | null };
export type GoalRecommendation = { recommendation: DiscoveryRecommendation; goal: { id: string; title: string } };

const stopWords = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with', 'my', 'learn', 'learning']);
function tokens(value: string) { return value.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2 && !stopWords.has(token)); }
function overlap(needles: string[], haystack: string[]) { const set = new Set(haystack); return needles.filter(token => set.has(token)).length; }

/**
 * Selects a starting skill from catalog data only. Weights are deliberately small and
 * explainable: relevance 0-4, readiness 0-3, time 0-2, difficulty 0-2, review quality 0-1.
 */
export function recommendStartingSkills(
  answers: DiscoveryAnswers,
  skills: readonly CatalogSkill[],
  relationships: readonly DiscoveryRelationship[],
  tracked: readonly DiscoveryTrackedSkill[] = [],
): DiscoveryRecommendation[] {
  const requested = tokens([answers.goal, answers.area, answers.outcome].join(' '));
  const known = new Set(tracked.filter(skill => skill.status === 'completed' || skill.status === 'practicing').map(skill => skill.skill_id));
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const candidates = skills.filter(skill => skill.review_status === 'reviewed' && skill.catalog_classification !== 'needs_review' && !tracked.some(item => item.skill_id === skill.id && item.status === 'completed'));
  return candidates.map(skill => {
    const haystack = tokens([skill.name, skill.category || '', skill.subcategory || '', skill.description || '', ...(skill.tags || [])].join(' '));
    const relevance = Math.min(4, overlap(requested, haystack));
    const prereqRows = relationships.filter(row => row.skill_id === skill.id && row.relationship_type === 'prerequisite' && (row.review_status || 'reviewed') === 'reviewed');
    const missing = prereqRows.map(row => byId.get(row.prerequisite_id)).filter((item): item is CatalogSkill => !!item && item.review_status === 'reviewed' && item.catalog_classification !== 'needs_review' && !known.has(item.id));
    const readiness = missing.length === 0 ? 3 : Math.max(0, 3 - missing.length);
    const difficulty = skill.difficulty === 'beginner' && answers.experience === 'new' || skill.difficulty === 'intermediate' && answers.experience === 'some' || skill.difficulty === 'advanced' && answers.experience === 'working' ? 2 : skill.difficulty === 'advanced' && answers.experience === 'new' ? 0 : 1;
    const effort = skill.estimated_minutes == null ? 1 : skill.estimated_minutes <= answers.minutesPerDay * 5 ? 2 : skill.estimated_minutes <= answers.minutesPerDay * 10 ? 1 : 0;
    const review = skill.review_status === 'reviewed' ? 1 : 0;
    const score = relevance + readiness + difficulty + effort + review;
    const reason = relevance > 0
      ? `${skill.name} matches your stated direction.${effort === 2 ? ' Its catalog estimate fits five days of your stated study budget.' : ''}`
      : missing.length === 0
        ? `${skill.name} is a reviewed starting point; no unresolved eligible prerequisites were found in the reviewed catalog links.`
        : `${skill.name} is a reviewed catalog skill; build its prerequisites before moving further.`;
    return { skill, score, reason, prerequisites: missing.map(item => item.name), estimatedMinutes: skill.estimated_minutes ?? null, factors: { relevance, readiness, difficulty, time: effort, quality: review } };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name) || a.skill.id.localeCompare(b.skill.id)).slice(0, 3);
}

export function recommendAcrossGoals(
  goals: readonly DiscoveryGoal[],
  skills: readonly CatalogSkill[],
  relationships: readonly DiscoveryRelationship[],
  tracked: readonly DiscoveryTrackedSkill[] = [],
): GoalRecommendation[] {
  const experience = tracked.length ? 'some' as const : 'new' as const;
  return goals.flatMap(goal => recommendStartingSkills({ goal: goal.title, experience, minutesPerDay: 30, area: goal.area || '', outcome: goal.targetSkillName || goal.title }, skills, relationships, tracked).map(recommendation => ({ recommendation, goal: { id: goal.id, title: goal.title } })))
    .sort((a, b) => b.recommendation.score - a.recommendation.score || a.recommendation.skill.name.localeCompare(b.recommendation.skill.name) || a.recommendation.skill.id.localeCompare(b.recommendation.skill.id));
}
