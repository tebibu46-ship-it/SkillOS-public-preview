export type MilestoneEvent =
  | 'first_goal_created'
  | 'first_skill_selected'
  | 'first_roadmap_viewed'
  | 'first_session_started'
  | 'first_session_completed'
  | 'first_action_completed'
  | 'first_evidence_added'
  | 'first_mastery_viewed'
  | 'first_history_viewed';

type TestEventWindow = Window & { __SKILLOS_TEST_EVENTS__?: MilestoneEvent[] };

function developmentEvents(): MilestoneEvent[] | null {
  const viteEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (viteEnv?.DEV !== true || typeof window === 'undefined') return null;
  const target = window as TestEventWindow;
  target.__SKILLOS_TEST_EVENTS__ ||= [];
  return target.__SKILLOS_TEST_EVENTS__;
}

/** Records milestone names only during local Vite development; product data remains authoritative. */
export function recordMilestone(event: MilestoneEvent): void {
  const events = developmentEvents();
  if (events && !events.includes(event)) events.push(event);
}

/** Returns a copy for a local tester or developer inspecting the current session. */
export function readMilestones(): MilestoneEvent[] {
  return [...(developmentEvents() || [])];
}
