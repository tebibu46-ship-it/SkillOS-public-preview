export type LearnerEntryState = { trackedSkills: number; activeGoals: number; meaningfulRoadmap: boolean; planItems: number; sessions: number };

export function shouldShowFirstTimeJourney(state: LearnerEntryState): boolean {
  return state.trackedSkills === 0 && state.activeGoals === 0 && !state.meaningfulRoadmap && state.planItems === 0 && state.sessions === 0;
}
