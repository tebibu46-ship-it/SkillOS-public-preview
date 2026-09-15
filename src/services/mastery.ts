export type MasteryBand = 'Not started' | 'Exploring' | 'Developing' | 'Practicing' | 'Strong';
export type MasteryInput = {
  status?: 'learning' | 'practicing' | 'paused' | 'completed' | null;
  completedSessions: number;
  completedActions: number;
  evidenceActions: number;
  roadmapCurrent?: { id: string; name: string } | null;
  skillId: string;
  unfinishedAction?: string | null;
};
export type MasteryResult = {
  score: number;
  band: MasteryBand;
  components: { status: number; sessions: number; actions: number; evidence: number };
  explanation: string;
  nextStep: { label: string; reason: string };
};

export function masteryBand(score: number): MasteryBand {
  if (score < 20) return 'Not started';
  if (score < 40) return 'Exploring';
  if (score < 60) return 'Developing';
  if (score < 80) return 'Practicing';
  return 'Strong';
}

export function calculateSkillMastery(input: MasteryInput): MasteryResult {
  const status = input.status === 'completed' ? 25 : input.status === 'practicing' ? 20 : input.status === 'learning' ? 5 : 0;
  const sessions = Math.min(30, Math.max(0, input.completedSessions) * 10);
  const actions = Math.min(25, Math.max(0, input.completedActions) * 5);
  const evidence = Math.min(20, Math.max(0, input.evidenceActions) * 10);
  const score = Math.min(100, status + sessions + actions + evidence);
  const band = masteryBand(score);
  const nextStep = input.roadmapCurrent && input.roadmapCurrent.id !== input.skillId
    ? { label: `Work on ${input.roadmapCurrent.name}`, reason: 'It is the current incomplete prerequisite in your roadmap.' }
    : input.unfinishedAction
      ? { label: input.unfinishedAction, reason: 'It is an unfinished action already connected to this skill.' }
      : input.roadmapCurrent?.id === input.skillId
        ? { label: `Continue ${input.roadmapCurrent.name}`, reason: 'It is the current focus in your roadmap.' }
        : input.completedSessions === 0 && input.completedActions === 0
          ? { label: 'Start a learning session', reason: 'A completed session is the clearest next piece of activity for this skill.' }
          : { label: 'Complete another focused session', reason: 'Consistent practice is the next measurable signal for this skill.' };
  return {
    score,
    band,
    components: { status, sessions, actions, evidence },
    explanation: `Based on ${input.completedSessions} completed session${input.completedSessions === 1 ? '' : 's'}, ${input.completedActions} completed action${input.completedActions === 1 ? '' : 's'}, and ${input.evidenceActions} action${input.evidenceActions === 1 ? '' : 's'} with evidence.`,
    nextStep,
  };
}
