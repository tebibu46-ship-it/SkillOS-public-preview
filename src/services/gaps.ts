import type { MasteryResult } from './mastery';

export type GapPriority = 1 | 2 | 3 | 4;
export type GapCandidate = {
  skill: { id: string; name: string };
  mastery: MasteryResult;
  meaningfulActivity: boolean;
  roadmap?: { targetSkillId: string; current: { id: string; name: string } | null; complete: boolean };
  goal?: { id: string; title: string; targetSkillId: string };
  action?: { id: string; title: string };
};
export type SkillGap = {
  skill: { id: string; name: string };
  mastery: MasteryResult;
  reason: string;
  priority: GapPriority;
  recommendedNextAction: string;
  roadmapStep: { id: string; name: string } | null;
  goal: { id: string; title: string } | null;
  action: { id: string; title: string } | null;
};

function result(candidate: GapCandidate, priority: GapPriority, reason: string): SkillGap {
  return {
    skill: candidate.skill,
    mastery: candidate.mastery,
    reason,
    priority,
    recommendedNextAction: candidate.action?.title || candidate.mastery.nextStep.label,
    roadmapStep: candidate.roadmap?.current || null,
    goal: candidate.goal ? { id: candidate.goal.id, title: candidate.goal.title } : null,
    action: candidate.action || null,
  };
}

export function selectSkillGap(candidates: readonly GapCandidate[]): SkillGap | null {
  const ordered = [...candidates];
  const prerequisite = ordered.find(candidate => candidate.roadmap?.current && candidate.roadmap.current.id !== candidate.roadmap.targetSkillId);
  if (prerequisite) return result(prerequisite, 1, `${prerequisite.skill.name} is an incomplete prerequisite for ${prerequisite.goal?.title || 'your current target skill'}.`);

  const roadmapStep = ordered.find(candidate => { const roadmap = candidate.roadmap; return !!roadmap?.current && roadmap.current.id === roadmap.targetSkillId; });
  if (roadmapStep) return result(roadmapStep, 2, `${roadmapStep.skill.name} is the current incomplete step in your roadmap.`);

  const activeGoal = ordered.find(candidate => candidate.goal && (!candidate.roadmap || candidate.roadmap.complete) && (candidate.action || candidate.mastery.band !== 'Strong'));
  if (activeGoal) return result(activeGoal, 3, `${activeGoal.skill.name} is the target of your active goal.`);

  const lowMastery = ordered
    .filter(candidate => candidate.meaningfulActivity && candidate.mastery.score < 80)
    .sort((a, b) => a.mastery.score - b.mastery.score || a.skill.name.localeCompare(b.skill.name) || a.skill.id.localeCompare(b.skill.id))[0];
  if (lowMastery) return result(lowMastery, 4, `${lowMastery.skill.name} has meaningful activity but still needs practice before the next mastery band.`);
  return null;
}
