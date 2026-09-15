import { renderLearningIntelligence } from './services/learning-view';
import type { NextBestAction } from './services/learner';
import './styles.css';
import './world.css';
import type { Session } from '@supabase/supabase-js';
import type { Row, TableName } from './domain/database';
import { initializeClient } from './lib/client';
import { isPublicPreview } from './lib/config';
import { renderPublicPreview } from './lib/public-preview';
import { closeEditorialDialog, initializeEditorialMotion, revealEditorialSurface } from './motion';
import { authService } from './services/auth';
import { dataServices } from './services/data';
import { safeError } from './services/errors';
import { goalSkillId, goalTitle, resourceTitle, resourceUrl, type ResourceType, type SkillStatus } from './services/validation';
import { currentWeekPeriod, type LearningHistoryPeriod } from './services/progress';
import { shouldShowFirstTimeJourney } from './services/journey';
import { recordMilestone } from './services/instrumentation';
import { recommendStartingSkills, type DiscoveryAnswers } from './services/discovery';
import type { CatalogSkill } from './services/skills';

const el = <T extends HTMLElement = HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing application element: ${id}`);
  return element as T;
};
type View = 'Today' | 'Learning history' | 'Intelligence' | 'Skills' | 'Roadmap' | 'Goals' | 'Projects' | 'Actions' | 'Evidence' | 'Opportunities' | 'Decisions' | 'Weekly review';
const views: Record<Exclude<View, 'Today'>, { subtitle: string; empty: string; note: string; table?: TableName }> = {
  'Learning history': { subtitle: 'See the work that became learning.', empty: 'No completed learning sessions yet.', note: 'Finish a session from Today and it will appear here.' },
  Intelligence: { subtitle: 'Understand what matters.', empty: 'Intelligence is not enabled yet.', note: 'This phase establishes your data. Recommendations and external providers come later.' },
  Skills: { subtitle: 'Build capability with evidence.', empty: 'No skills tracked yet.', note: 'Your skill catalog and practice records will support mastery. No mastery score is inferred from completed actions.', table: 'user_skills' },
  Roadmap: { subtitle: 'Learn in the order that builds.', empty: 'Choose a target skill to begin.', note: 'Roadmaps are derived from the global prerequisite graph.' },
  Goals: { subtitle: 'Give your work a direction.', empty: 'No goals saved yet.', note: 'Create a goal to give your work a shared purpose.', table: 'goals' },
  Projects: { subtitle: 'Turn learning into something useful.', empty: 'No projects yet.', note: 'Projects connect goals and skills to tangible evidence.', table: 'projects' },
  Actions: { subtitle: 'Make the next step concrete.', empty: 'No actions yet.', note: 'Your saved actions will appear here.', table: 'actions' },
  Evidence: { subtitle: 'Show what you can do.', empty: 'No evidence added yet.', note: 'Evidence records support your skills and projects.', table: 'evidence' },
  Opportunities: { subtitle: 'Pursue real requirements.', empty: 'No opportunities tracked.', note: 'External opportunity providers are not connected in this phase.', table: 'opportunities' },
  Decisions: { subtitle: 'Keep the reasoning behind your choices.', empty: 'No decisions recorded yet.', note: 'Your decisions can connect to goals, projects and actions.', table: 'decisions' },
  'Weekly review': { subtitle: 'Reflect before you redirect.', empty: 'Nothing to review yet.', note: 'Complete an action and you will start building a record of your progress.' },
};
const viewSections: Record<View, string> = {
  Today: 'Daily direction',
  Skills: 'Knowledge atlas',
  Roadmap: 'Learning route',
  Goals: 'Direction',
  'Learning history': 'Learning record',
  Intelligence: 'Patterns',
  Projects: 'Applied work',
  Actions: 'Execution',
  Evidence: 'Proof of work',
  Opportunities: 'Signals',
  Decisions: 'Reasoning',
  'Weekly review': 'Reflection',
};
const surfaceArtwork: Partial<Record<View, string>> = {
  Skills: '/media/knowledge-territories.webp',
  Roadmap: '/media/knowledge-territories.webp',
  Goals: '/media/destination-observatory.webp',
  'Learning history': '/media/field-journal.webp',
  'Weekly review': '/media/field-journal.webp',
  Projects: '/media/workshop-table.webp',
  Actions: '/media/workshop-table.webp',
  Evidence: '/media/proof-archive.webp',
  Opportunities: '/media/horizon-threshold.webp',
  Decisions: '/media/crossroads-study.webp',
  Intelligence: '/media/knowledge-landscape.webp'
};
const runtimeEnvironment = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const publicPreview = isPublicPreview(runtimeEnvironment);
let client: ReturnType<typeof initializeClient> = null;
let configError = '';
try { if (!publicPreview) client = initializeClient(); } catch (error) { configError = error instanceof Error ? error.message : 'Invalid public configuration.'; }
const auth = client ? authService(client) : null;
const data = client ? dataServices(client) : null;
let userId: string | null = null;
let authEpoch = 0;
let viewEpoch = 0;
let currentView: View = 'Today';
let page = 0;
let pendingGoal: { id: string; title: string } | null = null;
let goalBusy = false;
let editingGoalId: string | null = null;
let firstTimeJourney = false;
let journeyStep = 1;
let authBusy = false;
let dataBusy = false;
type ResourceRow = Row<'resources'>;
type TrackedSkill = { trackingId: string; skill_id: string; name: string; status: SkillStatus; target_mastery: number | null };
type SkillRelationship = { skill_id: string; prerequisite_id: string; relationship_type: string; skill?: { id: string; name: string }; prerequisite?: { id: string; name: string } };
let skillUi: {
  tools: HTMLElement; search: HTMLInputElement; category: HTMLSelectElement; difficulty: HTMLSelectElement;
  status: HTMLElement; clear: HTMLButtonElement; catalog: HTMLUListElement; tracked: HTMLUListElement; trackedStatus: HTMLElement; atlasStats: HTMLElement; categoryNav: HTMLElement; atlasRecommendation: HTMLElement; detail: HTMLElement; detailName: HTMLElement; detailDescription: HTMLElement;
  detailMeta: HTMLElement; prerequisites: HTMLUListElement; related: HTMLUListElement; mastery: HTMLElement; stateText: HTMLElement;
  knowledgeMap: HTMLElement; state: HTMLSelectElement; target: HTMLInputElement; track: HTMLButtonElement; save: HTMLButtonElement; remove: HTMLButtonElement;
  actionStatus: HTMLElement; close: HTMLButtonElement; createGoal: HTMLButtonElement; resources: HTMLUListElement; resourceActivity: HTMLUListElement; resourceStatus: HTMLElement; resourceFilter: HTMLSelectElement;
  resourceForm: HTMLFormElement; resourceTitle: HTMLInputElement; resourceUrl: HTMLInputElement; resourceType: HTMLSelectElement; resourceSource: HTMLInputElement; resourceProvider: HTMLInputElement; resourceError: HTMLElement; resourceCancel: HTMLButtonElement;
} | null = null;
let selectedSkill: CatalogSkill | null = null;
let trackedSkills: TrackedSkill[] = [];
let pendingSkillId: string | null = null;
let editingResourceId: string | null = null;
let pendingGoalId: string | null = null;
let selectedGoal: Record<string, unknown> | null = null;
let editingActionId: string | null = null;
let editingActionInitialStatus: Row<'actions'>['status'] | null = null;
let goalUi: {
  detail: HTMLElement; title: HTMLElement; target: HTMLElement; meta: HTMLElement; progress: HTMLElement; progressText: HTMLElement; progressFill: HTMLElement;
  reflection: HTMLElement; reflectionPeriod: HTMLElement; reflectionSummary: HTMLElement; reflectionNext: HTMLElement; reflectionAction: HTMLButtonElement; reflectionStart: HTMLButtonElement; reflectionForm: HTMLFormElement; reflectionAccomplishment: HTMLTextAreaElement; reflectionLearning: HTMLTextAreaElement; reflectionBlocker: HTMLTextAreaElement; reflectionNextInput: HTMLTextAreaElement; reflectionStatus: HTMLElement; reflectionSave: HTMLButtonElement; reflectionCancel: HTMLButtonElement; reflectionId: string | null;
  actions: HTMLUListElement; actionStatus: HTMLElement; addAction: HTMLButtonElement; edit: HTMLButtonElement; remove: HTMLButtonElement; back: HTMLButtonElement;
  actionDialog: HTMLDialogElement; actionForm: HTMLFormElement; actionTitle: HTMLInputElement; actionReason: HTMLTextAreaElement;
  actionState: HTMLSelectElement; actionDue: HTMLInputElement; actionError: HTMLElement;
  evidenceDialog: HTMLDialogElement; evidenceForm: HTMLFormElement; evidenceTitle: HTMLInputElement; evidenceType: HTMLSelectElement; evidenceSkill: HTMLSelectElement;
  evidenceUrl: HTMLInputElement; evidenceNotes: HTMLTextAreaElement; evidenceError: HTMLElement;
} | null = null;
let projectUi: { panel: HTMLElement; body: HTMLElement; create: HTMLButtonElement; dialog: HTMLDialogElement; form: HTMLFormElement; title: HTMLInputElement; description: HTMLTextAreaElement; status: HTMLSelectElement; error: HTMLElement; save: HTMLButtonElement; cancel: HTMLButtonElement; artifactDialog: HTMLDialogElement; artifactForm: HTMLFormElement; artifactProject: string | null; artifactTitle: HTMLInputElement; artifactType: HTMLSelectElement; artifactReference: HTMLInputElement; artifactNotes: HTMLTextAreaElement; artifactError: HTMLElement; artifactSave: HTMLButtonElement; artifactCancel: HTMLButtonElement; proofDialog: HTMLDialogElement; proofForm: HTMLFormElement; proofProject: string | null; proofSkill: HTMLSelectElement; proofTitle: HTMLInputElement; proofType: HTMLSelectElement; proofReference: HTMLInputElement; proofClaim: HTMLTextAreaElement; proofError: HTMLElement; proofSave: HTMLButtonElement; proofCancel: HTMLButtonElement } | null = null;
let editingEvidenceId: string | null = null;
let selectedEvidenceActionId: string | null = null;
let actionFromReflection = false;
let roadmapUi: { panel: HTMLElement; target: HTMLSelectElement; generate: HTMLButtonElement; status: HTMLElement; path: HTMLOListElement; context: HTMLElement } | null = null;
let dailyUi: { panel: HTMLElement; gap: HTMLElement; focus: HTMLElement; goal: HTMLElement; summary: HTMLElement; resources: HTMLUListElement; items: HTMLUListElement; sessions: HTMLUListElement; title: HTMLInputElement; add: HTMLButtonElement; session: HTMLButtonElement; sessionStatus: HTMLElement; sessionDialog: HTMLDialogElement; sessionNotes: HTMLTextAreaElement; finish: HTMLButtonElement } | null = null;
let firstJourneyPanel: HTMLElement | null = null;
let historyUi: { panel: HTMLElement; skill: HTMLSelectElement; period: HTMLSelectElement; status: HTMLElement; summary: HTMLElement; records: HTMLUListElement } | null = null;
let reviewUi: { panel: HTMLElement; period: HTMLElement; pulse: HTMLElement; signal: HTMLElement; metrics: HTMLUListElement; accomplishments: HTMLUListElement; evidence: HTMLUListElement; form: HTMLFormElement; goal: HTMLSelectElement; accomplishment: HTMLTextAreaElement; learning: HTMLTextAreaElement; blocker: HTMLTextAreaElement; nextStep: HTMLTextAreaElement; status: HTMLElement; save: HTMLButtonElement; editId: string | null } | null = null;
let recommendationUi: { panel: HTMLElement; status: HTMLElement; body: HTMLElement } | null = null;
const dialog = el<HTMLDialogElement>('goalDialog');
const goalInput = el<HTMLInputElement>('goalTitle');
const goalSkill = el<HTMLSelectElement>('goalSkill');
const goalSkillContext = el<HTMLParagraphElement>('goalSkillContext');
const goalMastery = el<HTMLInputElement>('goalMastery');
const goalDeadlineInput = el<HTMLInputElement>('goalDeadline');
const goalStatusInput = el<HTMLSelectElement>('goalStatus');
const discoveryFields = el('discoveryFields');
const discoveryExperience = el<HTMLSelectElement>('discoveryExperience');
const discoveryMinutes = el<HTMLSelectElement>('discoveryMinutes');
const discoveryArea = el<HTMLInputElement>('discoveryArea');
const discoveryOutcome = el<HTMLInputElement>('discoveryOutcome');
const discoveryRecommendation = el<HTMLParagraphElement>('discoveryRecommendation');
const password = el<HTMLInputElement>('password');
const strategyArticles = el('today').querySelectorAll('.rail article');
strategyArticles[2].querySelector('h3')!.textContent = 'Connect work to real requirements.';
strategyArticles[2].querySelector('p:last-of-type')!.textContent = 'View your saved opportunities in the radar. External providers are not enabled yet.';
strategyArticles[3].querySelector('p:last-of-type')!.textContent = 'Readiness is not calculated in this phase. Saved evidence is available in Evidence.';
strategyArticles[1].querySelector('h3')!.textContent = 'Build the next capability.';
strategyArticles[1].querySelector('p:last-of-type')!.textContent = 'Your next best step is derived from your roadmap, goals, and practice.';

function message(text: string) { el('status').textContent = text; }
function clearPrivateState() {
  userId = null;
  viewEpoch++;
  el('workspace').hidden = true;
  el('authPanel').hidden = false;
  el('records').replaceChildren();
  el('todayActions').replaceChildren();
  el('north').textContent = 'A direction worth pursuing.';
  el('northNote').textContent = 'Start with one meaningful goal.';
  pendingGoal = null;
  editingGoalId = null;
  firstTimeJourney = false;
  journeyStep = 1;
  goalInput.value = '';
  goalSkill.replaceChildren(new Option('No target skill selected', ''));
  goalMastery.value = ''; goalDeadlineInput.value = ''; goalStatusInput.value = 'active';
  el('goalError').textContent = '';
  message('');
  if (dialog.open) dialog.close();
  trackedSkills = [];
  selectedSkill = null;
}
function showAuth(description = 'A private place to turn curiosity into capability, one deliberate chapter at a time.') {
  clearPrivateState();
  el('authHeading').textContent = 'Find your way forward.';
  el('authDescription').textContent = description;
  el('authForm').hidden = false;
}
function handleFailure(error: unknown, target: string) {
  const safe = safeError(error);
  if (safe.kind === 'auth') {
    authEpoch++;
    showAuth(safe.message);
    return;
  }
  el(target).textContent = safe.message;
}
function make<T extends HTMLElement>(tag: string, text = '') {
  const node = document.createElement(tag) as T;
  if (text) node.textContent = text;
  return node;
}
function ensureSkillUi() {
  if (skillUi) return skillUi;
  const host = document.querySelector<HTMLElement>('.wide-empty');
  if (!host) throw new Error('Missing skill catalog host.');
  const tools = make<HTMLElement>('section'); tools.className = 'skill-tools'; tools.hidden = true; tools.setAttribute('aria-labelledby', 'skillToolsTitle');
  const atlasHeader = make<HTMLElement>('header'); atlasHeader.className = 'atlas-header ambient-scene';
  const atlasCopy = make<HTMLElement>('div'); atlasCopy.className = 'atlas-header-copy';
  atlasCopy.append(make<HTMLElement>('p', 'Knowledge atlas'));
  atlasCopy.firstElementChild!.className = 'section-label';
  const title = make<HTMLHeadingElement>('h2', 'Understand what you know. Discover what connects next.'); title.id = 'skillToolsTitle'; atlasCopy.append(title);
  atlasCopy.append(make<HTMLParagraphElement>('p', 'A living map of skills, prerequisites, and the next useful capability. Search the atlas when you need direction, then follow the connections into practice.'));
  const atlasMark = make<HTMLElement>('div'); atlasMark.className = 'atlas-mark'; atlasMark.setAttribute('aria-hidden', 'true'); for (const className of ['atlas-mark-core', 'atlas-mark-orbit atlas-mark-orbit-a', 'atlas-mark-orbit atlas-mark-orbit-b', 'atlas-mark-line']) { const mark = make<HTMLElement>('span'); mark.className = className; atlasMark.append(mark); }
  const atlasMotion = make<HTMLButtonElement>('button', 'Pause ambient motion'); atlasMotion.type = 'button'; atlasMotion.className = 'surface-motion-toggle'; atlasMotion.dataset.motionToggle = ''; atlasMotion.setAttribute('aria-pressed', 'false'); atlasHeader.append(atlasCopy, atlasMark, atlasMotion); tools.append(atlasHeader);
  const atlasStats = make<HTMLElement>('div'); atlasStats.className = 'atlas-stats'; tools.append(atlasStats);
  const atlasRecommendation = make<HTMLElement>('section'); atlasRecommendation.className = 'atlas-recommendation'; atlasRecommendation.setAttribute('aria-labelledby', 'atlasRecommendationTitle'); const recommendationTitle = make<HTMLHeadingElement>('h3', 'What should you learn next?'); recommendationTitle.id = 'atlasRecommendationTitle'; const recommendationText = make<HTMLParagraphElement>('p', 'Your next recommendation will appear once your learning context is available.'); const recommendationButton = make<HTMLButtonElement>('button', 'Open Intelligence'); recommendationButton.type = 'button'; recommendationButton.className = 'inline-link'; recommendationButton.onclick = () => { const url = new URL(location.href); url.searchParams.set('view', 'Intelligence'); history.pushState({}, '', url); void navigate('Intelligence'); }; atlasRecommendation.append(recommendationTitle, recommendationText, recommendationButton); tools.append(atlasRecommendation);
  const searchBand = make<HTMLElement>('div'); searchBand.className = 'atlas-search-band';
  const searchLabel = make<HTMLLabelElement>('label', 'Search the atlas'); const search = make<HTMLInputElement>('input'); search.type = 'search'; search.maxLength = 80; search.placeholder = 'Search by skill, category, or idea'; search.setAttribute('aria-keyshortcuts', '/'); searchLabel.append(search); const searchHint = make<HTMLElement>('span', '/'); searchHint.className = 'atlas-search-hint'; searchLabel.append(searchHint); searchBand.append(searchLabel);
  const filters = make<HTMLElement>('div'); filters.className = 'filters';
  const categoryLabel = make<HTMLLabelElement>('label', 'Category'); const category = make<HTMLSelectElement>('select'); const allCategories = make<HTMLOptionElement>('option', 'All categories'); allCategories.value = ''; category.append(allCategories); categoryLabel.append(category);
  const difficultyLabel = make<HTMLLabelElement>('label', 'Difficulty'); const difficulty = make<HTMLSelectElement>('select'); for (const [value, label] of [['', 'All levels'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]) { const option = make<HTMLOptionElement>('option', label); option.value = value; difficulty.append(option); } difficultyLabel.append(difficulty);
  const clear = make<HTMLButtonElement>('button', 'Clear filters'); clear.type = 'button'; clear.className = 'secondary';
  filters.append(categoryLabel, difficultyLabel, clear); searchBand.append(filters); tools.append(searchBand);
  const explore = make<HTMLElement>('section'); explore.className = 'atlas-explore'; const exploreHead = make<HTMLElement>('div'); exploreHead.className = 'atlas-section-head'; exploreHead.append(make<HTMLElement>('p', 'Explore')); exploreHead.firstElementChild!.className = 'section-label'; exploreHead.append(make<HTMLParagraphElement>('p', 'Choose a field to narrow the atlas.')); const categoryNav = make<HTMLElement>('div'); categoryNav.className = 'atlas-categories'; explore.append(exploreHead, categoryNav); tools.append(explore);
  const status = make<HTMLElement>('p'); status.setAttribute('role', 'status');
  const mySkills = make<HTMLElement>('section'); mySkills.className = 'skill-tracked'; const trackedTitle = make<HTMLHeadingElement>('h3', 'Your tracked skills'); const trackedStatus = make<HTMLElement>('p', 'No skills tracked yet.'); trackedStatus.setAttribute('role', 'status'); const tracked = make<HTMLUListElement>('ul'); tracked.className = 'records'; mySkills.append(trackedTitle, trackedStatus, tracked); tools.append(mySkills);
  const catalogHead = make<HTMLElement>('div'); catalogHead.className = 'atlas-catalog-head'; const catalogTitle = make<HTMLHeadingElement>('h3', 'Browse the atlas'); catalogHead.append(catalogTitle, status); tools.append(catalogHead); const catalog = make<HTMLUListElement>('ul'); catalog.className = 'records'; tools.append(catalog);
  const detail = make<HTMLElement>('section'); detail.className = 'skill-detail atlas-detail'; detail.hidden = true; detail.setAttribute('aria-labelledby', 'skillDetailName');
  const close = make<HTMLButtonElement>('button', '← Back to atlas'); close.type = 'button'; close.className = 'back-link'; detail.append(close);
  const chapterIntro = make<HTMLElement>('div'); chapterIntro.className = 'skill-chapter-intro';
  const detailLabel = make('div', 'Skill brief'); detailLabel.className = 'section-label'; detail.append(detailLabel);
  const detailName = make<HTMLHeadingElement>('h2', ''); detailName.id = 'skillDetailName'; const detailDescription = make<HTMLParagraphElement>('p'); const detailMeta = make<HTMLParagraphElement>('p'); detailMeta.className = 'skill-detail-meta'; detail.append(detailName, detailDescription, detailMeta);
  chapterIntro.append(detailLabel, detailName, detailDescription, detailMeta); detail.append(chapterIntro);
  const chapterVisual = make<HTMLElement>('figure'); chapterVisual.className = 'skill-chapter-visual'; chapterVisual.setAttribute('aria-hidden', 'true'); const chapterImage = make<HTMLImageElement>('img'); chapterImage.src = '/media/knowledge-landscape.webp'; chapterImage.alt = ''; chapterImage.width = 1672; chapterImage.height = 941; chapterImage.loading = 'eager'; chapterImage.decoding = 'async'; chapterVisual.append(chapterImage, make<HTMLElement>('figcaption', 'Knowledge chapter · connected paths')); detail.append(chapterVisual);
  const detailGrid = make<HTMLElement>('div'); detailGrid.className = 'skill-detail-grid'; const prereqBox = make<HTMLElement>('div'); prereqBox.className = 'knowledge-column'; const prereqTitle = make<HTMLHeadingElement>('h3', 'Prerequisites'); const prerequisites = make<HTMLUListElement>('ul'); prerequisites.className = 'records'; prereqBox.append(prereqTitle, prerequisites); const relatedBox = make<HTMLElement>('div'); relatedBox.className = 'knowledge-column'; const relatedTitle = make<HTMLHeadingElement>('h3', 'Connected skills'); const related = make<HTMLUListElement>('ul'); related.className = 'records'; relatedBox.append(relatedTitle, related); detailGrid.append(prereqBox, relatedBox); detail.append(detailGrid);
  const knowledgeMap = make<HTMLElement>('section'); knowledgeMap.className = 'knowledge-map'; knowledgeMap.setAttribute('aria-labelledby', 'knowledgeMapTitle'); const knowledgeMapTitle = make<HTMLHeadingElement>('h3', 'Knowledge around this skill'); knowledgeMapTitle.id = 'knowledgeMapTitle'; knowledgeMap.append(knowledgeMapTitle); detail.append(knowledgeMap);
  const mastery = make<HTMLElement>('section'); mastery.className = 'mastery-panel'; mastery.setAttribute('aria-labelledby', 'masteryTitle'); const masteryHeading = make<HTMLHeadingElement>('h3', 'Current mastery'); masteryHeading.id = 'masteryTitle'; mastery.append(masteryHeading); detail.append(mastery);
  const stateBox = make<HTMLElement>('div'); stateBox.className = 'skill-state'; stateBox.append(make<HTMLHeadingElement>('h3', 'My skill state')); const stateText = make<HTMLParagraphElement>('p', 'Not tracked yet.');
  const stateLabel = make<HTMLLabelElement>('label', 'Status'); const state = make<HTMLSelectElement>('select'); for (const [value, label] of [['learning', 'Learning'], ['practicing', 'Practicing'], ['paused', 'Paused'], ['completed', 'Completed']]) { const option = make<HTMLOptionElement>('option', label); option.value = value; state.append(option); } stateLabel.append(state);
  const targetLabel = make<HTMLLabelElement>('label', 'Target mastery (optional)'); const target = make<HTMLInputElement>('input'); target.type = 'number'; target.min = '0'; target.max = '100'; target.step = '1'; target.placeholder = 'Not set'; targetLabel.append(target);
  const buttons = make<HTMLElement>('div'); buttons.className = 'buttons'; const track = make<HTMLButtonElement>('button', 'Track skill'); track.type = 'button'; track.className = 'primary'; const save = make<HTMLButtonElement>('button', 'Save state'); save.type = 'button'; save.hidden = true; const remove = make<HTMLButtonElement>('button', 'Remove from My Skills'); remove.type = 'button'; remove.hidden = true; const createGoal = make<HTMLButtonElement>('button', 'Create goal'); createGoal.type = 'button'; buttons.append(track, save, remove, createGoal); const actionStatus = make<HTMLParagraphElement>('p'); actionStatus.setAttribute('role', 'status'); stateBox.append(stateText, stateLabel, targetLabel, buttons, actionStatus); detail.append(stateBox); tools.append(detail); host.prepend(tools);
  const resourceSection = make<HTMLElement>('section'); resourceSection.className = 'skill-resources'; resourceSection.setAttribute('aria-labelledby', 'skillResourcesTitle');
  const resourceHeader = make<HTMLElement>('div'); resourceHeader.className = 'detail-sectionhead'; const resourceTitleHeading = make<HTMLHeadingElement>('h3', 'Learning resources'); resourceTitleHeading.id = 'skillResourcesTitle'; const resourceFilter = make<HTMLSelectElement>('select'); resourceFilter.setAttribute('aria-label', 'Filter resources by type'); resourceFilter.append(new Option('All types', '')); for (const [value, label] of [['watch', 'Video'], ['read', 'Article / documentation'], ['learn', 'Course / book'], ['build', 'Exercise / project'], ['research', 'Research'], ['tool', 'Tool / reference']]) resourceFilter.append(new Option(label, value)); const addResource = make<HTMLButtonElement>('button', 'Add resource'); addResource.type = 'button'; addResource.className = 'secondary'; resourceHeader.append(resourceTitleHeading, resourceFilter, addResource); resourceSection.append(resourceHeader);
  const resourceStatus = make<HTMLElement>('p', 'Resources you save for this skill will appear here.'); resourceStatus.setAttribute('role', 'status'); const resources = make<HTMLUListElement>('ul'); resources.className = 'records resource-list'; const activityTitle = make<HTMLHeadingElement>('h4', 'Recent learning activity'); const resourceActivity = make<HTMLUListElement>('ul'); resourceActivity.className = 'records resource-activity'; resourceSection.append(resourceStatus, resources, activityTitle, resourceActivity);
  const resourceForm = make<HTMLFormElement>('form'); resourceForm.className = 'resource-form'; resourceForm.hidden = true; resourceForm.setAttribute('aria-label', 'Learning resource');
  const titleLabel = make<HTMLLabelElement>('label', 'Title'); const resourceTitleInput = make<HTMLInputElement>('input'); resourceTitleInput.required = true; resourceTitleInput.maxLength = 180; titleLabel.append(resourceTitleInput);
  const urlLabel = make<HTMLLabelElement>('label', 'HTTPS URL'); const resourceUrlInput = make<HTMLInputElement>('input'); resourceUrlInput.type = 'url'; resourceUrlInput.required = true; resourceUrlInput.placeholder = 'https://'; resourceUrlInput.maxLength = 2048; urlLabel.append(resourceUrlInput);
  const typeLabel = make<HTMLLabelElement>('label', 'Type'); const resourceTypeInput = make<HTMLSelectElement>('select'); for (const [value, label] of [['watch', 'Video'], ['read', 'Article / documentation'], ['learn', 'Course / book'], ['build', 'Exercise / project'], ['research', 'Research'], ['tool', 'Tool / reference']]) resourceTypeInput.append(new Option(label, value)); typeLabel.append(resourceTypeInput);
  const sourceLabel = make<HTMLLabelElement>('label', 'Source <span>(optional)</span>'); const sourceInput = make<HTMLInputElement>('input'); sourceInput.maxLength = 120; sourceInput.placeholder = 'e.g. MDN'; sourceLabel.append(sourceInput);
  const providerLabel = make<HTMLLabelElement>('label', 'Provider <span>(optional)</span>'); const providerInput = make<HTMLInputElement>('input'); providerInput.maxLength = 120; providerInput.placeholder = 'e.g. YouTube'; providerLabel.append(providerInput);
  const resourceError = make<HTMLElement>('p'); resourceError.setAttribute('role', 'alert'); const resourceButtons = make<HTMLElement>('div'); resourceButtons.className = 'buttons'; const resourceCancel = make<HTMLButtonElement>('button', 'Cancel'); resourceCancel.type = 'button'; const resourceSave = make<HTMLButtonElement>('button', 'Save resource'); resourceSave.type = 'submit'; resourceSave.className = 'primary'; resourceButtons.append(resourceCancel, resourceSave); resourceForm.append(titleLabel, urlLabel, typeLabel, sourceLabel, providerLabel, resourceError, resourceButtons); resourceSection.append(resourceForm); detail.append(resourceSection);
  skillUi = { tools, search, category, difficulty, status, clear, catalog, tracked, trackedStatus, atlasStats, categoryNav, atlasRecommendation, detail, detailName, detailDescription, detailMeta, prerequisites, related, knowledgeMap, mastery, stateText, state, target, track, save, remove, actionStatus, close, createGoal, resources, resourceActivity, resourceStatus, resourceFilter, resourceForm, resourceTitle: resourceTitleInput, resourceUrl: resourceUrlInput, resourceType: resourceTypeInput, resourceSource: sourceInput, resourceProvider: providerInput, resourceError, resourceCancel };
  const refresh = () => void loadSkills(); search.oninput = refresh; category.onchange = refresh; difficulty.onchange = refresh; clear.onclick = () => { search.value = ''; category.value = ''; difficulty.value = ''; void loadSkills(); }; close.onclick = () => { detail.hidden = true; catalog.hidden = false; tools.classList.remove('detail-open'); search.focus(); };
  track.onclick = () => void saveSkillState(true); save.onclick = () => void saveSkillState(false); remove.onclick = () => void removeTrackedSkill(); createGoal.onclick = () => void openGoalDialog(selectedSkill?.id);
  addResource.onclick = () => { editingResourceId = null; resourceForm.reset(); resourceTypeInput.value = 'watch'; resourceError.textContent = ''; resourceForm.hidden = false; resourceTitleInput.focus(); };
  resourceFilter.onchange = () => { if (selectedSkill) void showSkillDetail(selectedSkill); };
  resourceCancel.onclick = () => { resourceForm.hidden = true; editingResourceId = null; };
  resourceForm.onsubmit = async event => { event.preventDefault(); if (!data || !selectedSkill) return; try { const input = { title: resourceTitleInput.value, url: resourceUrlInput.value, type: resourceTypeInput.value, source: sourceInput.value, provider: providerInput.value }; resourceTitle(input.title); resourceUrl(input.url); if (editingResourceId) await data.updateResource(editingResourceId, input); else await data.createResource(selectedSkill.id, input); resourceForm.hidden = true; editingResourceId = null; await showSkillDetail(selectedSkill); } catch (error) { resourceError.textContent = safeError(error).message; } };
  return skillUi;
}
function skillLink(skill: CatalogSkill | undefined, relation: string) {
  const li = make<HTMLLIElement>('li'); if (!skill) { li.textContent = 'Unavailable skill'; return li; } const button = make<HTMLButtonElement>('button', `${skill.name} · ${relation}`); button.type = 'button'; button.onclick = () => void showSkillDetail(skill); li.append(button); return li;
}
function renderKnowledgeMap(skill: CatalogSkill, relationships: SkillRelationship[], host: HTMLElement) {
  host.replaceChildren();
  const title = make<HTMLHeadingElement>('h3', 'Knowledge around this skill'); title.id = 'knowledgeMapTitle'; host.append(title);
  const prerequisites = relationships.filter(row => row.relationship_type === 'prerequisite' && row.skill_id === skill.id).map(row => row.prerequisite).filter((row): row is { id: string; name: string } => !!row);
  const connected = relationships.filter(row => row.relationship_type !== 'prerequisite').map(row => row.skill_id === skill.id ? row.prerequisite : row.skill).filter((row): row is { id: string; name: string } => !!row);
  void renderAdaptivePathContext(skill.id, host);
  if (!prerequisites.length && !connected.length) { host.append(make<HTMLParagraphElement>('p', 'No reviewed connections are recorded for this skill yet.')); return; }
  const map = make<HTMLElement>('div'); map.className = 'knowledge-map-canvas'; map.setAttribute('role', 'group'); map.setAttribute('aria-label', `Knowledge connections for ${skill.name}`);
  const column = (label: string, nodes: { id: string; name: string }[], className: string) => { const section = make<HTMLElement>('div'); section.className = `knowledge-map-column ${className}`; section.append(make<HTMLElement>('span', label)); const list = make<HTMLUListElement>('ul'); for (const node of nodes) { const item = make<HTMLLIElement>('li'); const button = make<HTMLButtonElement>('button', node.name); button.type = 'button'; button.onclick = () => { const target = relationships.flatMap(row => [row.skill, row.prerequisite]).find(candidate => candidate?.id === node.id); if (target) void showSkillDetail({ id: target.id, name: target.name, slug: '', category: null, difficulty: null }); }; item.append(button); list.append(item); } section.append(list); return section; };
  const before = column('Prerequisites', prerequisites, 'knowledge-map-before'); const current = make<HTMLElement>('div'); current.className = 'knowledge-map-current'; current.append(make<HTMLElement>('span', 'You are here'), make<HTMLElement>('strong', skill.name)); const after = column('Connected knowledge', connected, 'knowledge-map-after'); map.append(before, current, after); host.append(map);
}
async function renderAdaptivePathContext(skillId: string, host: HTMLElement) {
  if (!data) return;
  try {
    const model = await data.personalLearningModel();
    const capability = model.capabilities?.skills.find(candidate => candidate.skillId === skillId);
    if (capability) {
      const proof = make<HTMLElement>('section'); proof.className = 'capability-context';
      proof.append(make<HTMLHeadingElement>('h3', `Capability · ${capability.state}`), make<HTMLParagraphElement>('p', capability.explanation));
      const qualifying = capability.traces.filter(trace => trace.qualifies);
      if (qualifying.length) proof.append(make<HTMLParagraphElement>('p', `Evidence trace · ${qualifying[0].sources.map(source => `${source.table}: ${source.id}`).join(' · ')}`));
      if (capability.conflicts.length) proof.append(make<HTMLParagraphElement>('p', `Conflict · ${capability.conflicts[0].explanation}`));
      host.append(proof);
    }
    const path = model.adaptivePath;
    const step = path.orderedSteps.find(candidate => candidate.skillId === skillId);
    if (!step) return;
    const experiment = model.experimentSelection?.experiment;
    if (experiment?.skillId === skillId) {
      const section = make<HTMLElement>('section'); section.className = 'experiment-context';
      section.append(make<HTMLHeadingElement>('h3', 'Learning experiment'), make<HTMLHeadingElement>('h4', experiment.title), make<HTMLParagraphElement>('p', experiment.objective));
      section.append(make<HTMLParagraphElement>('p', `Success · ${experiment.successConditions.join(' ')}`), make<HTMLParagraphElement>('p', `Evidence · ${experiment.evidenceRequirements.filter(item => item.required).map(item => item.description).join(' ')}`), make<HTMLParagraphElement>('p', `Why this experiment · ${model.experimentSelection?.reason || 'Selected from the current eligible learning step.'}`));
      const currentAttempt = model.experimentOutcome?.current;
      if (!currentAttempt) {
        const start = make<HTMLButtonElement>('button', 'Start attempt'); start.type = 'button'; start.className = 'secondary'; const startStatus = make<HTMLParagraphElement>('p'); startStatus.setAttribute('role', 'status'); start.onclick = async () => { start.disabled = true; try { await data.createExperimentAttempt(experiment, { idempotencyKey: `skill-detail:${experiment.id}:${Date.now()}` }); await renderAdaptivePathContext(skillId, host); } catch (error) { start.disabled = false; startStatus.textContent = safeError(error).message; } }; section.append(start, startStatus);
      } else {
        const lifecycle = make<HTMLParagraphElement>('p', `Attempt status · ${currentAttempt.lifecycle.replaceAll('_', ' ')}`); section.append(lifecycle);
        const transition = make<HTMLButtonElement>('button', currentAttempt.lifecycle === 'PROPOSED' ? 'Mark ready' : currentAttempt.lifecycle === 'READY' ? 'Begin attempt' : currentAttempt.lifecycle === 'IN_PROGRESS' ? 'Mark completed' : '');
        if (transition.textContent) { transition.type = 'button'; transition.className = 'secondary'; transition.onclick = async () => { transition.disabled = true; try { const next = currentAttempt.lifecycle === 'PROPOSED' ? 'READY' : currentAttempt.lifecycle === 'READY' ? 'IN_PROGRESS' : 'COMPLETED'; await data.transitionExperimentAttempt(currentAttempt.attemptId, next); await renderAdaptivePathContext(skillId, host); } catch (error) { transition.disabled = false; lifecycle.textContent = safeError(error).message; } }; section.append(transition); }
        if (currentAttempt.lifecycle === 'COMPLETED') {
          const prompt = { id: `${experiment.templateKey}:assessment`, skillId: experiment.skillId, prompt: experiment.objective, expectedOutcome: experiment.successConditions.join(' '), evidenceTypes: experiment.evidenceRequirements.map(item => item.type) };
          const response = make<HTMLTextAreaElement>('textarea'); response.placeholder = 'What did you produce or learn?'; response.maxLength = 4000; response.setAttribute('aria-label', 'Assessment response');
          const status = make<HTMLSelectElement>('select'); status.setAttribute('aria-label', 'Assessment status'); for (const value of ['attempted', 'partial', 'passed', 'insufficient_evidence']) status.append(new Option(value.replaceAll('_', ' '), value));
          const feedback = make<HTMLInputElement>('input'); feedback.placeholder = 'Feedback (optional)'; feedback.maxLength = 4000; feedback.setAttribute('aria-label', 'Assessment feedback');
          const assess = make<HTMLButtonElement>('button', 'Record assessment'); assess.type = 'button'; assess.className = 'secondary'; const assessStatus = make<HTMLParagraphElement>('p'); assessStatus.setAttribute('role', 'status'); assess.onclick = async () => { assess.disabled = true; try { await data.recordAssessment(currentAttempt.attemptId, prompt, { response: response.value, status: status.value as 'attempted' | 'partial' | 'passed' | 'insufficient_evidence', feedback: feedback.value, idempotencyKey: `assessment:${currentAttempt.attemptId}:${Date.now()}` }); await renderAdaptivePathContext(skillId, host); } catch (error) { assess.disabled = false; assessStatus.textContent = safeError(error).message; } }; section.append(make<HTMLHeadingElement>('h4', 'Assessment'), response, status, feedback, assess, assessStatus);
          const resultSelect = make<HTMLSelectElement>('select'); resultSelect.setAttribute('aria-label', 'Experiment result'); for (const value of ['PASSED', 'PARTIAL', 'FAILED']) resultSelect.append(new Option(value.toLowerCase(), value));
          const resultButton = make<HTMLButtonElement>('button', 'Record experiment result'); resultButton.type = 'button'; resultButton.className = 'secondary'; const resultStatus = make<HTMLParagraphElement>('p'); resultStatus.setAttribute('role', 'status'); resultButton.onclick = async () => { resultButton.disabled = true; try { await data.recordExperimentResult(currentAttempt.attemptId, resultSelect.value as 'PASSED' | 'PARTIAL' | 'FAILED', { assessmentId: model.assessmentContext?.current?.id || null }); await renderAdaptivePathContext(skillId, host); } catch (error) { resultButton.disabled = false; resultStatus.textContent = safeError(error).message; } }; section.append(make<HTMLParagraphElement>('p', 'Experiment result is recorded separately from assessment.'), resultSelect, resultButton, resultStatus);
          if (model.assessmentContext?.history.length) section.append(make<HTMLParagraphElement>('p', `Previous assessments: ${model.assessmentContext.history.length}`), ...model.assessmentContext.history.map(item => make<HTMLParagraphElement>('p', `Assessment ${item.status.toLowerCase().replaceAll('_', ' ')} · Evaluator: ${item.evaluator}${item.feedback ? ` · ${item.feedback}` : ''}`)));
        }
      }
      const verification = model.evidenceVerification;
      if (verification) {
        section.append(make<HTMLParagraphElement>('p', `Verification · ${verification.state.replaceAll('_', ' ').toLowerCase()}`));
        for (const requirement of verification.requirements.filter(item => item.required)) section.append(make<HTMLParagraphElement>('p', `${requirement.state === 'SUFFICIENT' ? '✓' : '○'} ${requirement.explanation}`));
      }
      if (model.experimentOutcome) {
        const outcome = model.experimentOutcome;
        section.append(make<HTMLParagraphElement>('p', `Attempt outcome · ${outcome.reason}${outcome.history.length > 1 ? ` · ${outcome.history.length - 1} previous attempts` : ''}`));
        if (outcome.nextUnmetRequirement) section.append(make<HTMLParagraphElement>('p', `Next requirement · ${outcome.nextUnmetRequirement}`));
      }
      host.append(section);
    }
    const context = make<HTMLElement>('p'); context.className = 'adaptive-path-context';
    if (step.status === 'BLOCKED') context.textContent = `Blocked by: ${step.dependencies.filter(dependency => dependency.status !== 'COMPLETED').map(dependency => dependency.skillName).join(', ') || 'an unresolved prerequisite'}.`;
    else if (step.skillId === path.targetSkillId) context.textContent = step.status === 'COMPLETED' ? 'Target skill · prerequisite path complete.' : 'Target skill · destination of this learning path.';
    else if (step.status === 'COMPLETED') context.textContent = 'Prerequisite demonstrated.';
    else if (path.currentStep?.skillId === step.skillId) context.textContent = 'Current learning step.';
    else context.textContent = `Required for: ${path.orderedSteps.find(candidate => candidate.prerequisiteSkillIds.includes(step.skillId))?.skillName || 'the target skill'}.`;
    host.prepend(context);
  } catch { /* supplemental context should never hide the skill detail */ }
}
async function renderProjectProofContext(skillId: string, host: HTMLElement) {
  if (!data) return;
  try {
    const proofs = (await data.projectProofs()).filter(proof => proof.skillId === skillId);
    if (!proofs.length) return;
    const section = make<HTMLElement>('section'); section.className = 'project-proof-context'; section.append(make<HTMLHeadingElement>('h3', proofs.some(proof => proof.status === 'SUPPORTED') ? 'Demonstrated through' : 'Project association'));
    for (const proof of proofs) {
      const item = make<HTMLElement>('article'); item.append(make<HTMLHeadingElement>('h4', proof.projectTitle), make<HTMLParagraphElement>('p', `${proof.status} · ${proof.explanation}`));
      if (proof.artifact) item.append(make<HTMLParagraphElement>('p', `Artifact: ${proof.artifact.title}`), make<HTMLParagraphElement>('p', proof.artifact.reference || 'Evidence reference not provided.'));
      if (proof.claim) item.append(make<HTMLParagraphElement>('p', `Claim: ${proof.claim}`));
      section.append(item);
    }
    host.append(section);
  } catch { /* project proof is supplemental context */ }
}
async function renderSkillMastery(skillId: string, trackingId: string | undefined, ui: NonNullable<typeof skillUi>) {
  try {
    const result = await data!.skillMastery(skillId, trackingId);
    recordMilestone('first_mastery_viewed');
    const heading = make<HTMLHeadingElement>('h3', `${result.band} · ${result.score}/100`);
    const track = make<HTMLElement>('div'); track.className = 'mastery-track'; const fill = make<HTMLElement>('span'); fill.style.width = `${result.score}%`; track.append(fill);
    const explanation = make<HTMLParagraphElement>('p', result.explanation);
    const components = make<HTMLParagraphElement>('p', `State ${result.components.status} · Sessions ${result.components.sessions} · Actions ${result.components.actions} · Evidence ${result.components.evidence}`); components.className = 'mastery-components';
    const next = make<HTMLParagraphElement>('p', `Next step: ${result.nextStep.label} — ${result.nextStep.reason}`); next.className = 'mastery-next';
    ui.mastery.replaceChildren(heading, track, explanation, components, next);
  } catch (error) { ui.mastery.replaceChildren(make<HTMLParagraphElement>('p', safeError(error).message)); }
}
async function showSkillDetail(skill: CatalogSkill) {
  if (!data || !skillUi) return; recordMilestone('first_skill_selected'); selectedSkill = skill; const ui = skillUi; const tracked = trackedSkills.find(row => row.skill_id === skill.id); ui.tools.classList.add('detail-open'); ui.catalog.hidden = true; ui.detail.hidden = false; ui.detail.scrollIntoView({ block: 'start', behavior: 'auto' }); ui.detailName.textContent = skill.name; ui.detailDescription.textContent = skill.description || 'No description is available yet.'; ui.detailMeta.textContent = [skill.category || 'Uncategorised', skill.subcategory || '', skill.difficulty || 'Difficulty not set', skill.estimated_minutes ? `${skill.estimated_minutes} min estimated` : ''].filter(Boolean).join(' · '); ui.prerequisites.replaceChildren(); ui.related.replaceChildren(); ui.knowledgeMap.replaceChildren(); ui.resources.replaceChildren(); ui.resourceActivity.replaceChildren(); ui.resourceStatus.textContent = 'Loading resources…'; ui.actionStatus.textContent = ''; await renderSkillMastery(skill.id, tracked?.trackingId, ui); try { const relationships = await data.skillRelationships(skill.id) as SkillRelationship[]; for (const relation of relationships) { const targetSkill = relation.skill_id === skill.id ? relation.prerequisite : relation.skill; const label = relation.relationship_type === 'prerequisite' ? (relation.skill_id === skill.id ? 'prerequisite' : 'depends on this skill') : relation.relationship_type.replaceAll('_', ' '); (relation.relationship_type === 'prerequisite' && relation.skill_id === skill.id ? ui.prerequisites : ui.related).append(skillLink(targetSkill as CatalogSkill | undefined, label)); } if (!relationships.length) ui.prerequisites.append(make('li', 'No reviewed relationships recorded yet.')); renderKnowledgeMap(skill, relationships, ui.knowledgeMap); void renderProjectProofContext(skill.id, ui.knowledgeMap); } catch (error) { ui.actionStatus.textContent = safeError(error).message; ui.knowledgeMap.append(make<HTMLParagraphElement>('p', 'Connections are temporarily unavailable.')); }
  try { const resources = await data.skillResources(skill.id, ui.resourceFilter.value as ResourceType || undefined); ui.resourceStatus.textContent = resources.length ? `${resources.length} saved resource${resources.length === 1 ? '' : 's'}.` : 'No learning resources yet. Add a useful video, article, documentation page, course, or exercise for this skill.'; const labels: Record<string, string> = { watch: 'Video', read: 'Article / documentation', learn: 'Course / book', build: 'Exercise / project', research: 'Research', tool: 'Tool / reference' }; const usage = await data.resourceSessions((resources as ResourceRow[]).map(resource => resource.id)); const usageCount = new Map<string, number>(); const resourceNames = new Map((resources as ResourceRow[]).map(resource => [resource.id, resource.title])); for (const session of usage) if (session.resource_id) usageCount.set(session.resource_id, (usageCount.get(session.resource_id) || 0) + 1); for (const session of usage.slice(0, 6)) ui.resourceActivity.append(make<HTMLLIElement>('li', `${resourceNames.get(session.resource_id || '') || 'Learning resource'} · ${session.duration_minutes || 0} min · ${session.status === 'completed' ? 'Completed' : 'In progress'}`)); if (!usage.length) ui.resourceActivity.append(make<HTMLLIElement>('li', 'No resource sessions yet. Start a session when you are ready.')); for (const resource of resources as ResourceRow[]) { const item = make<HTMLLIElement>('li'); item.className = 'resource-item'; const heading = make<HTMLHeadingElement>('h4', resource.title); const meta = make<HTMLParagraphElement>('p', [labels[resource.type] || 'Resource', resource.provider || resource.source, usageCount.has(resource.id) ? `Used in ${usageCount.get(resource.id)} session${usageCount.get(resource.id) === 1 ? '' : 's'}` : 'Not studied yet'].filter(Boolean).join(' · ')); const open = make<HTMLAnchorElement>('a', 'Open resource ↗'); open.href = resource.url; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.setAttribute('aria-label', `Open ${resource.title} in a new tab`); const controls = make<HTMLElement>('div'); controls.className = 'resource-controls'; const start = make<HTMLButtonElement>('button', 'Start session'); start.type = 'button'; start.onclick = () => void startResourceSession(skill.id, resource.id); const edit = make<HTMLButtonElement>('button', 'Edit'); edit.type = 'button'; edit.onclick = () => { editingResourceId = resource.id; ui.resourceTitle.value = resource.title; ui.resourceUrl.value = resource.url; ui.resourceType.value = resource.type; ui.resourceSource.value = resource.source; ui.resourceProvider.value = resource.provider; ui.resourceError.textContent = ''; ui.resourceForm.hidden = false; ui.resourceTitle.focus(); }; const remove = make<HTMLButtonElement>('button', 'Remove'); remove.type = 'button'; remove.onclick = async () => { if (!window.confirm(`Remove “${resource.title}” from this skill?`)) return; try { await data.deleteResource(resource.id); await showSkillDetail(skill); } catch (error) { ui.actionStatus.textContent = safeError(error).message; } }; controls.append(start, edit, remove); item.append(heading, meta, open, controls); ui.resources.append(item); } } catch (error) { ui.resourceStatus.textContent = safeError(error).message; }
  const statusLabel = tracked?.status === 'completed' ? 'Completed' : tracked?.status === 'practicing' ? 'Practicing' : tracked?.status === 'paused' ? 'Paused' : tracked?.status === 'learning' ? 'Learning' : 'Not started'; ui.stateText.textContent = tracked ? `Tracked · ${statusLabel} · Mastery reflects current activity.` : 'Not tracked yet.'; ui.state.value = tracked?.status || 'learning'; ui.target.value = tracked?.target_mastery == null ? '' : String(tracked.target_mastery); ui.track.hidden = !!tracked; ui.save.hidden = !tracked; ui.remove.hidden = !tracked; revealEditorialSurface(ui.detail);
}
async function saveSkillState(create: boolean) {
  if (!data || !skillUi || !selectedSkill) return; const ui = skillUi; const target = ui.target.value.trim() === '' ? null : Number(ui.target.value); if (target !== null && (!Number.isInteger(target) || target < 0 || target > 100)) { ui.actionStatus.textContent = 'Target mastery must be a whole number from 0 to 100.'; return; } const tracked = trackedSkills.find(row => row.skill_id === selectedSkill!.id); if (ui.state.value === 'completed' && tracked?.status !== 'completed' && !window.confirm('Mark this skill as completed?')) return; ui.track.disabled = true; ui.save.disabled = true; ui.actionStatus.textContent = 'Saving…'; try { if (create) await data.trackSkill(selectedSkill.id, target); else if (tracked) await data.updateSkillState(tracked.trackingId, ui.state.value as TrackedSkill['status'], target); trackedSkills = (await data.skills()).rows.map(row => ({ trackingId: row.id, skill_id: row.skill_id, name: row.name, status: row.status, target_mastery: row.target_mastery })); await showSkillDetail(selectedSkill); ui.actionStatus.textContent = 'Skill state saved.'; } catch (error) { ui.actionStatus.textContent = safeError(error).message; } finally { ui.track.disabled = false; ui.save.disabled = false; }
}
async function removeTrackedSkill() {
  if (!data || !skillUi || !selectedSkill) return; const tracked = trackedSkills.find(row => row.skill_id === selectedSkill!.id); if (!tracked) return; skillUi.remove.disabled = true; try { await data.untrackSkill(tracked.trackingId); trackedSkills = trackedSkills.filter(row => row.trackingId !== tracked.trackingId); await showSkillDetail(selectedSkill); skillUi.actionStatus.textContent = 'Skill removed from My Skills.'; } catch (error) { skillUi.actionStatus.textContent = safeError(error).message; } finally { skillUi.remove.disabled = false; }
}
function setJourneyStep(step: number) {
  journeyStep = step;
  const optional = [goalMastery, goalDeadlineInput, goalStatusInput].map(input => input.parentElement).filter((element): element is HTMLElement => !!element);
  const skillField = goalSkill.parentElement;
  for (const field of optional) field.hidden = firstTimeJourney;
  if (skillField) skillField.hidden = firstTimeJourney && step === 1;
  discoveryFields.hidden = !firstTimeJourney;
  discoveryRecommendation.hidden = !(firstTimeJourney && step > 1);
  [discoveryExperience, discoveryMinutes, discoveryArea, discoveryOutcome].forEach(input => { const field = input.parentElement; if (field) field.hidden = firstTimeJourney && step > 1; });
  goalSkillContext.hidden = firstTimeJourney && step === 1;
  el('dialogTitle').textContent = firstTimeJourney ? step === 1 ? 'Step 1 of 2 · Choose a direction.' : 'Step 2 of 2 · Choose a skill.' : editingGoalId ? 'Edit your goal.' : 'Choose your direction.';
  el('goalHelp').textContent = firstTimeJourney ? step === 1 ? 'Name the capability or outcome you want to reach.' : 'Choose a skill from the catalog. SkillOS will build the prerequisite path for you.' : 'Your goal is saved privately to your account.';
  el('saveGoal').textContent = firstTimeJourney && step === 1 ? 'Continue to skills' : 'Save goal';
}
let discoveryCatalog: CatalogSkill[] = [];
async function runDiscovery() {
  if (!data) return;
  const answers: DiscoveryAnswers = { goal: goalInput.value, experience: discoveryExperience.value as DiscoveryAnswers['experience'], minutesPerDay: Number(discoveryMinutes.value), area: discoveryArea.value, outcome: discoveryOutcome.value };
  const context = await data.discoveryContext();
  discoveryCatalog = context.skills as CatalogSkill[];
  const results = recommendStartingSkills(answers, discoveryCatalog, context.relationships, context.tracked);
  if (!results.length) { discoveryRecommendation.textContent = 'SkillOS needs more reviewed catalog context before it can make a meaningful recommendation. Choose a skill directly or continue with your goal.'; return; }
  const best = results[0];
  goalSkill.value = best.skill.id;
  discoveryRecommendation.textContent = `Suggested starting point: ${best.skill.name}. ${best.reason}${best.prerequisites.length ? ` First, you may need: ${best.prerequisites.join(', ')}.` : ''}`;
  goalSkillContext.textContent = [best.skill.category, best.skill.difficulty, best.skill.description].filter(Boolean).join(' · ');
}
async function openGoalDialog(targetSkillId: string | null = null, row?: Record<string, unknown>, journey = false) {
  if (!userId || !data) return;
  firstTimeJourney = journey; journeyStep = 1;
  editingGoalId = typeof row?.id === 'string' ? row.id : null;
  goalInput.value = typeof row?.title === 'string' ? row.title : '';
  goalMastery.value = row?.target_mastery == null ? '' : String(row.target_mastery);
  goalDeadlineInput.value = typeof row?.deadline === 'string' ? row.deadline : '';
  goalStatusInput.value = typeof row?.status === 'string' ? row.status : 'active';
  el('goalError').textContent = '';
  try {
    const catalog = await data.catalogSkillsAll();
    discoveryCatalog = catalog as CatalogSkill[];
    goalSkill.replaceChildren(new Option('No target skill selected', ''));
    for (const skill of catalog) goalSkill.append(new Option(skill.name, skill.id));
    goalSkill.value = goalSkillId(typeof row?.target_skill_id === 'string' ? row.target_skill_id : targetSkillId) || '';
    const updateSkillContext = () => { const selected = catalog.find(skill => skill.id === goalSkill.value); goalSkillContext.textContent = selected ? [selected.category, selected.difficulty, selected.description].filter(Boolean).join(' · ') : 'Choose a skill to see its category, difficulty, and description.'; };
    goalSkill.onchange = () => { if (goalSkill.value) recordMilestone('first_skill_selected'); updateSkillContext(); }; updateSkillContext();
    discoveryExperience.value = 'new'; discoveryMinutes.value = '30'; discoveryArea.value = ''; discoveryOutcome.value = ''; discoveryRecommendation.textContent = ''; setJourneyStep(firstTimeJourney ? 1 : 0); dialog.showModal(); goalInput.focus();
  } catch (error) { el('goalError').textContent = safeError(error).message; }
}
async function loadSkills() {
  if (!data || !userId) return;
  const ui = ensureSkillUi();
  ui.tools.hidden = false;
  ui.tools.classList.remove('detail-open');
  ui.detail.hidden = true;
  ui.catalog.hidden = false;
  ui.status.textContent = 'Reading the knowledge atlas…';
  ui.catalog.replaceChildren();
  ui.tracked.replaceChildren();
  ui.atlasStats.replaceChildren();
  ui.categoryNav.replaceChildren();
  el('records').hidden = true;
  el('emptyTitle').hidden = true;
  el('emptyText').hidden = true;
  const recommendationCopy = ui.atlasRecommendation.querySelector<HTMLParagraphElement>('p');
  const recommendationButton = ui.atlasRecommendation.querySelector<HTMLButtonElement>('button');
  if (recommendationCopy) recommendationCopy.textContent = 'Reading your goals and reviewed learning context…';
  if (recommendationButton) recommendationButton.textContent = 'Open Intelligence';
  el('records').replaceChildren();
  el('loadMore').hidden = true;
  const formatMinutes = (minutes: number | null | undefined) => {
    if (!minutes) return '';
    return minutes >= 60 ? `${Math.round(minutes / 60 * 10) / 10}h` : `${minutes} min`;
  };
  try {
    const [catalog, tracked] = await Promise.all([
      data.catalogSkills({ query: ui.search.value, category: ui.category.value, difficulty: ui.difficulty.value }),
      data.skills(),
    ]);
    trackedSkills = tracked.rows.map(row => ({ trackingId: row.id, skill_id: row.skill_id, name: row.name, status: row.status, target_mastery: row.target_mastery }));
    const trackedCount = trackedSkills.length;
    const completedCount = trackedSkills.filter(row => row.status === 'completed').length;
    const activeCount = trackedSkills.filter(row => row.status !== 'completed').length;
    ui.atlasStats.replaceChildren();
    for (const [label, value, note] of [['Tracked', String(trackedCount), trackedCount ? 'skills you are following' : 'nothing tracked yet'], ['Completed', String(completedCount), completedCount ? 'marked complete' : 'no completed skills'], ['In progress', String(activeCount), activeCount ? 'learning or practicing' : 'space for a next step']] as const) {
      const item = make<HTMLElement>('div'); item.className = 'atlas-stat'; item.append(make<HTMLElement>('strong', value), make<HTMLElement>('span', label), make<HTMLElement>('small', note)); ui.atlasStats.append(item);
    }
    try {
      const next = await data.nextBestSkill();
      if (next.recommendation && recommendationCopy && recommendationButton) { recommendationCopy.textContent = `${next.recommendation.skill.name} · ${next.recommendation.reason}`; recommendationButton.textContent = 'Explore this skill'; recommendationButton.onclick = () => { pendingSkillId = next.recommendation!.skill.id; void showSkillDetail(next.recommendation!.skill); }; }
      else if (recommendationCopy) recommendationCopy.textContent = 'Your next recommendation will appear once your learning context is available.';
    } catch { if (recommendationCopy) recommendationCopy.textContent = 'Your next recommendation will appear once your learning context is available.'; }
    const categories = [...new Set(catalog.map(skill => skill.category).filter((value): value is string => !!value))].sort();
    const current = ui.category.value;
    ui.category.replaceChildren(new Option('All categories', ''));
    for (const item of categories) ui.category.append(new Option(item, item));
    ui.category.value = categories.includes(current) ? current : '';
    ui.categoryNav.replaceChildren();
    if (!categories.length) ui.categoryNav.append(make<HTMLParagraphElement>('p', 'Categories will appear once catalog records are available.'));
    else {
      const all = make<HTMLButtonElement>('button', 'All fields'); all.type = 'button'; all.className = ui.category.value ? '' : 'active'; all.setAttribute('aria-pressed', String(!ui.category.value)); all.onclick = () => { ui.category.value = ''; void loadSkills(); }; ui.categoryNav.append(all);
      for (const item of categories) { const button = make<HTMLButtonElement>('button', item); button.type = 'button'; button.className = ui.category.value === item ? 'active' : ''; button.setAttribute('aria-pressed', String(ui.category.value === item)); button.onclick = () => { ui.category.value = item; void loadSkills(); }; ui.categoryNav.append(button); }
    }
    ui.tracked.replaceChildren();
    ui.trackedStatus.textContent = trackedCount ? `${trackedCount} skill${trackedCount === 1 ? '' : 's'} in your personal atlas.` : 'Track a skill to keep it close to your learning route.';
    for (const row of trackedSkills.slice(0, 6)) {
      const item = make<HTMLLIElement>('li'); item.className = 'atlas-tracked-card';
      const state = row.status === 'completed' ? 'Completed' : row.status === 'practicing' ? 'Practicing' : row.status === 'paused' ? 'Paused' : 'Learning';
      const open = make<HTMLButtonElement>('button', row.name); open.type = 'button'; open.className = 'atlas-card-title'; const skill = catalog.find(candidate => candidate.id === row.skill_id) || { id: row.skill_id, name: row.name, slug: '', category: null, difficulty: null, description: null }; open.onclick = () => void showSkillDetail(skill); item.append(open, make<HTMLParagraphElement>('p', `${state} · Target mastery ${row.target_mastery == null ? 'not set' : row.target_mastery}`)); ui.tracked.append(item);
    }
    ui.catalog.replaceChildren();
    ui.status.textContent = catalog.length ? `${catalog.length} skill${catalog.length === 1 ? '' : 's'} in view.` : ui.search.value || ui.category.value || ui.difficulty.value ? 'No skills match this view.' : 'No catalog records are available in this environment yet.';
    if (!catalog.length) {
      const empty = make<HTMLLIElement>('li'); empty.className = 'atlas-empty-state';
      empty.append(make<HTMLElement>('span', ui.search.value || ui.category.value || ui.difficulty.value ? 'No match' : 'Atlas waiting'), make<HTMLHeadingElement>('h3', ui.search.value || ui.category.value || ui.difficulty.value ? 'Try a broader search.' : 'Your atlas is waiting for its catalog.'), make<HTMLParagraphElement>('p', ui.search.value || ui.category.value || ui.difficulty.value ? 'Clear a filter or search another capability.' : 'No public skill records are available here yet. Your private learning data is safe, and the atlas will fill in when an approved catalog is connected.'));
      ui.catalog.append(empty);
    } else for (const skill of catalog as CatalogSkill[]) {
      const item = make<HTMLLIElement>('li'); item.className = 'atlas-card';
      const marker = make<HTMLElement>('span', skill.category ? skill.category.slice(0, 2).toUpperCase() : '·'); marker.className = 'atlas-card-marker'; marker.setAttribute('aria-hidden', 'true');
      const body = make<HTMLElement>('div'); body.className = 'atlas-card-body'; const heading = make<HTMLHeadingElement>('h3'); const open = make<HTMLButtonElement>('button', skill.name); open.type = 'button'; open.className = 'atlas-card-title'; open.onclick = () => void showSkillDetail(skill); heading.append(open); body.append(heading);
      const description = skill.description?.trim() || 'A capability in the SkillOS knowledge catalog.'; body.append(make<HTMLParagraphElement>('p', description));
      const meta = make<HTMLElement>('div'); meta.className = 'atlas-card-meta'; for (const value of [skill.category || 'Uncategorised', skill.subcategory || '', skill.difficulty || 'Difficulty not set', formatMinutes(skill.estimated_minutes), trackedSkills.some(row => row.skill_id === skill.id) ? 'Tracked' : 'Not tracked'].filter(Boolean)) meta.append(make('span', value)); body.append(meta);
      const review = make<HTMLElement>('span', skill.review_status === 'reviewed' ? 'Reviewed' : skill.review_status ? String(skill.review_status).replaceAll('_', ' ') : 'Review status not recorded'); review.className = `atlas-review ${skill.review_status === 'reviewed' ? 'is-reviewed' : ''}`; item.append(marker, body, review); ui.catalog.append(item);
    }
    const linkedSkill = pendingSkillId ? catalog.find(skill => skill.id === pendingSkillId) : undefined;
    pendingSkillId = null;
    if (linkedSkill) await showSkillDetail(linkedSkill);
  } catch (error) {
    ui.status.textContent = 'The atlas is temporarily unavailable.';
    const empty = make<HTMLLIElement>('li'); empty.className = 'atlas-empty-state atlas-error-state'; empty.append(make<HTMLElement>('span', 'Connection interrupted'), make<HTMLHeadingElement>('h3', 'Your atlas is temporarily offline.'), make<HTMLParagraphElement>('p', 'We could not load the knowledge catalog. Your private learning data is safe.')); const details = make<HTMLDetailsElement>('details'); const summary = make<HTMLElement>('summary', 'Connection details'); details.append(summary, make<HTMLParagraphElement>('p', safeError(error).message)); empty.append(details); const retry = make<HTMLButtonElement>('button', 'Retry atlas'); retry.type = 'button'; retry.className = 'primary'; retry.onclick = () => void loadSkills(); empty.append(retry); ui.catalog.append(empty);
  }
}
function ensureHistoryUi() {
  if (historyUi) return historyUi;
  const host = document.querySelector<HTMLElement>('.wide-empty'); if (!host) throw new Error('Missing history host.');
  const panel = make<HTMLElement>('section'); panel.className = 'history-panel'; panel.setAttribute('aria-labelledby', 'historyTitle');
  const title = make<HTMLHeadingElement>('h2', 'What you learned'); title.id = 'historyTitle'; const intro = make<HTMLParagraphElement>('p', 'A chronological learning record, grounded in completed sessions, resources, goals, and actions.');
  const filters = make<HTMLElement>('div'); filters.className = 'history-filters'; const skillLabel = make<HTMLLabelElement>('label', 'Skill'); const skill = make<HTMLSelectElement>('select'); skillLabel.append(skill); const periodLabel = make<HTMLLabelElement>('label', 'Time period'); const period = make<HTMLSelectElement>('select'); period.append(new Option('All time', 'all'), new Option('Last 7 days', '7d'), new Option('Last 30 days', '30d')); periodLabel.append(period); filters.append(skillLabel, periodLabel);
  const status = make<HTMLElement>('p'); status.setAttribute('role', 'status'); const summary = make<HTMLElement>('p'); summary.className = 'history-summary'; const records = make<HTMLUListElement>('ul'); records.className = 'records history-records'; panel.append(title, intro, filters, summary, status, records); host.append(panel); historyUi = { panel, skill, period, status, summary, records }; skill.onchange = () => void loadHistory(); period.onchange = () => void loadHistory(); return historyUi;
}
async function loadHistory() {
  if (!data || !userId) return; recordMilestone('first_history_viewed'); const ui = ensureHistoryUi(); ui.panel.hidden = false; el('records').hidden = true; el('loadMore').hidden = true; el('retryData').hidden = true; el('otherGoal').hidden = true; el('emptyTitle').hidden = true; el('emptyText').hidden = true; ui.status.textContent = 'Loading learning history…'; ui.records.replaceChildren(); try { const [catalog, historyData] = await Promise.all([data.catalogSkills(), data.learningHistory({ skillId: ui.skill.value || undefined, period: ui.period.value as LearningHistoryPeriod })]); const selected = ui.skill.value; ui.skill.replaceChildren(new Option('All skills', '')); for (const skill of catalog) ui.skill.append(new Option(skill.name, skill.id)); ui.skill.value = catalog.some(skill => skill.id === selected) ? selected : ''; ui.summary.textContent = `${historyData.summary.totalSessions} completed session${historyData.summary.totalSessions === 1 ? '' : 's'} · ${historyData.summary.totalMinutes} min learning time`; ui.status.textContent = historyData.rows.length ? `${historyData.rows.length} session${historyData.rows.length === 1 ? '' : 's'} in this period.` : 'No completed learning sessions in this period.'; if (!historyData.rows.length) { const empty = make<HTMLLIElement>('li'); empty.className = 'history-empty'; empty.append(make<HTMLHeadingElement>('h3', 'Your learning record starts here.'), make<HTMLParagraphElement>('p', 'Finish a session from Today and the work you complete will appear here.'), (() => { const button = make<HTMLButtonElement>('button', 'Go to Today'); button.type = 'button'; button.className = 'primary'; button.onclick = () => { const url = new URL(location.href); url.searchParams.set('view', 'Today'); history.pushState({}, '', url); void navigate('Today'); }; return button; })()); ui.records.append(empty); return; } const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); for (const row of historyData.rows) { const item = make<HTMLLIElement>('li'); item.className = 'history-item'; const title = make<HTMLHeadingElement>('h3', row.skill?.name || 'Skill unavailable'); const date = make<HTMLParagraphElement>('p', `${fmt.format(new Date(row.started_at))} · ${row.duration_minutes ?? 0} min`); const context = make<HTMLParagraphElement>('p', [row.resource?.title, row.goal?.title ? `Goal: ${row.goal.title}` : null, row.action?.title ? `Action: ${row.action.title}` : null].filter(Boolean).join(' · ') || 'Independent learning session'); item.append(title, date, context); if (row.notes) item.append(make<HTMLParagraphElement>('p', row.notes)); const details = make<HTMLDetailsElement>('details'); const summary = make<HTMLElement>('summary', 'Session details'); summary.append(make('span', `Completed ${row.completed_at ? fmt.format(new Date(row.completed_at)) : 'recently'}`)); details.append(summary); item.append(details); ui.records.append(item); } } catch (error) { ui.status.textContent = safeError(error).message; }
}
function ensureRecommendationUi() {
  if (recommendationUi) return recommendationUi;
  const host = document.querySelector<HTMLElement>('.wide-empty'); if (!host) throw new Error('Missing recommendation host.');
  const panel = make<HTMLElement>('section'); panel.className = 'recommendation-panel'; panel.setAttribute('aria-labelledby', 'recommendationTitle');
  const title = make<HTMLHeadingElement>('h2', 'Next best skill'); title.id = 'recommendationTitle';
  const status = make<HTMLElement>('p'); status.className = 'recommendation-status'; status.setAttribute('role', 'status');
  const body = make<HTMLElement>('div'); body.className = 'recommendation-body'; panel.append(title, status, body); host.append(panel); recommendationUi = { panel, status, body }; return recommendationUi;
}
async function actOnLearning(next: NextBestAction) {
  if (!data || !userId) return;
  const identity = userId, service = data;
  const go = async (view: View) => { const url = new URL(location.href); url.searchParams.set('view', view); history.pushState({}, '', url); await navigate(view); };
  try {
    if (next.type === 'continue_session' && next.entityId) {
      const ui = ensureDailyUi(); ui.finish.dataset.sessionId = next.entityId; ui.sessionNotes.value = ''; ui.sessionDialog.showModal();
    } else if ((next.type === 'start_session' || next.type === 'resolve_prerequisite') && next.skillId) {
      const fresh = await service.personalLearningModel();
      if (identity !== userId) return;
      if (fresh.nextAction.type === 'continue_session') { await go('Today'); return; }
      if (fresh.nextAction.skillId !== next.skillId || fresh.nextAction.type !== next.type) { await go('Intelligence'); return; }
      await service.startSession(next.skillId, next.goalId); await go('Today');
    } else if (next.type === 'complete_action' || next.type === 'create_demonstration' || next.type === 'add_evidence') { pendingGoalId = next.goalId; await go(next.reasons.some(reason => reason.type === 'project_proof_gap') ? 'Projects' : 'Goals'); }
    else { await go(next.type === 'clarify_goal' ? 'Goals' : 'Skills'); }
  } catch (error) { message(safeError(error).message); }
}
async function loadRecommendation() {
  if (!data || !userId) return;
  const epoch = viewEpoch, identity = userId;
  const ui = ensureRecommendationUi(); ui.panel.hidden = false; el('records').hidden = true; el('loadMore').hidden = true; el('retryData').hidden = true; el('otherGoal').hidden = true; el('emptyTitle').hidden = true; el('emptyText').hidden = true;
  ui.status.textContent = 'Reading your learning evidence...'; ui.body.replaceChildren();
  try {
    const model = await data.personalLearningModel();
    if (epoch !== viewEpoch || identity !== userId || currentView !== 'Intelligence') return;
    ui.status.textContent = 'Derived from your saved records and reviewed skill graph.';
    renderLearningIntelligence(ui.body, model, actOnLearning);
  } catch (error) { if (identity === userId && epoch === viewEpoch) ui.status.textContent = safeError(error).message; }
}
function ensureRoadmapUi() {
  if (roadmapUi) return roadmapUi;
  const host = document.querySelector<HTMLElement>('.wide-empty'); if (!host) throw new Error('Missing roadmap host.');
  const panel = make<HTMLElement>('section'); panel.className = 'roadmap-panel'; panel.setAttribute('aria-labelledby', 'roadmapTitle');
  const title = make<HTMLHeadingElement>('h2', 'Map the route'); title.id = 'roadmapTitle'; const intro = make<HTMLParagraphElement>('p', 'Choose a destination, see what unlocks it, and move through the real prerequisite order.');
  const controls = make<HTMLElement>('div'); controls.className = 'roadmap-controls'; const label = make<HTMLLabelElement>('label', 'Target skill'); const target = make<HTMLSelectElement>('select'); target.append(new Option('Choose a skill', '')); label.append(target); const generate = make<HTMLButtonElement>('button', 'Generate roadmap'); generate.type = 'button'; generate.className = 'primary'; controls.append(label, generate);
  const status = make<HTMLParagraphElement>('p'); status.setAttribute('role', 'status'); const path = make<HTMLOListElement>('ol'); path.className = 'roadmap-path'; const context = make<HTMLElement>('section'); context.className = 'roadmap-context'; panel.append(title, intro, controls, status, path, context); host.append(panel);
  roadmapUi = { panel, target, generate, status, path, context };
  generate.onclick = () => void loadRoadmap(target.value);
  return roadmapUi;
}
async function loadRoadmap(targetId = '') {
  if (!data || !userId) return; recordMilestone('first_roadmap_viewed'); const ui = ensureRoadmapUi(); if (reviewUi) reviewUi.panel.hidden = true; ui.panel.hidden = false; el('records').hidden = true; el('emptyTitle').hidden = true; el('emptyText').hidden = true; el('loadMore').hidden = true; el('retryData').hidden = true; ui.status.textContent = 'Loading the prerequisite graph…'; ui.path.replaceChildren(); ui.context.replaceChildren();
  try {
    const catalog = await data.catalogSkillsAll(); const current = targetId || ui.target.value; ui.target.replaceChildren(new Option('Choose a skill', '')); for (const skill of catalog) ui.target.append(new Option(skill.name, skill.id)); ui.target.value = current;
    if (!current) { ui.status.textContent = 'Choose a target skill to generate its roadmap.'; return; }
    const roadmap = await data.roadmap(current);
    const adaptive = roadmap.adaptivePath;
    const progress = roadmap.progress;
    const currentStep = progress.current;
    const labelFor = (status: string) => status === 'not_started' ? 'Not started' : status === 'learning' ? 'Learning' : status === 'practicing' ? 'Practicing' : status === 'paused' ? 'Paused' : status === 'completed' || status === 'COMPLETED' ? 'Completed' : status === 'READY' ? 'Ready' : status === 'BLOCKED' ? 'Blocked' : status === 'IN_PROGRESS' ? 'In progress' : status === 'NEEDS_PRACTICE' ? 'Needs practice' : status === 'NEEDS_DEMONSTRATION' ? 'Needs demonstration' : status === 'NEEDS_EVIDENCE' ? 'Needs evidence' : 'Unknown state';
    const summary = make<HTMLElement>('section'); summary.className = 'roadmap-summary';
    const evidencedCount = adaptive ? adaptive.orderedSteps.filter(step => step.status === 'COMPLETED').length : progress.completed; const pathTotal = adaptive?.orderedSteps.length || progress.total; const pathCurrent = adaptive?.currentStep || currentStep;
    const summaryTitle = make<HTMLHeadingElement>('h2', evidencedCount === pathTotal && pathTotal > 0 ? 'Path ready' : `${evidencedCount} of ${pathTotal} path steps evidenced`); summary.append(summaryTitle);
    const pathCurrentName = adaptive?.currentStep?.skillName || currentStep?.name; const pathCurrentStatus = adaptive?.currentStep?.status || currentStep?.status;
    const summaryText = make<HTMLParagraphElement>('p', evidencedCount === pathTotal ? 'Every prerequisite currently has recorded demonstration or evidence.' : pathCurrent ? `${pathCurrentStatus === 'not_started' || pathCurrentStatus === 'READY' ? 'Start with' : 'Current'} · ${pathCurrentName}` : 'Track your skills to see your position on this roadmap.'); summary.append(summaryText);
    if (pathCurrent) { const focusId = adaptive?.currentStep?.skillId || currentStep?.id; const focus = make<HTMLParagraphElement>('p', `Focus now: ${pathCurrentName}`); focus.className = 'roadmap-focus'; const open = make<HTMLButtonElement>('button', 'Open skill'); open.type = 'button'; open.className = 'secondary'; open.onclick = () => { if (focusId) { pendingSkillId = focusId; void navigate('Skills'); } }; focus.append(' ', open); summary.append(focus); }
    ui.context.append(summary);
    if (adaptive) {
      const adaptiveSection = make<HTMLElement>('section'); adaptiveSection.className = 'adaptive-path-summary';
      adaptiveSection.append(make<HTMLHeadingElement>('h3', 'Adaptive learning path'), make<HTMLParagraphElement>('p', adaptive.explanation));
      const pathState = make<HTMLUListElement>('ul');
      const adaptiveLabel = (status: string) => status.replaceAll('_', ' ').toLowerCase();
      for (const step of adaptive.orderedSteps) { const item = make<HTMLLIElement>('li'); item.append(make<HTMLElement>('strong', `${String(step.position).padStart(2, '0')} · ${step.skillName}`), make<HTMLParagraphElement>('p', `${adaptiveLabel(step.status)} · ${step.reason}`)); pathState.append(item); }
      adaptiveSection.append(pathState); ui.context.append(adaptiveSection);
    }
    const experiment = roadmap.experimentSelection?.experiment;
    if (experiment && adaptive?.currentStep?.skillId === experiment.skillId) {
      const experimentSection = make<HTMLElement>('section'); experimentSection.className = 'experiment-context';
      experimentSection.append(make<HTMLHeadingElement>('h3', 'Learning experiment'), make<HTMLHeadingElement>('h4', experiment.title), make<HTMLParagraphElement>('p', experiment.objective), make<HTMLParagraphElement>('p', `Success · ${experiment.successConditions.join(' ')}`), make<HTMLParagraphElement>('p', `Evidence · ${experiment.evidenceRequirements.filter(item => item.required).map(item => item.description).join(' ')}`));
      const verification = roadmap.evidenceVerification;
      if (verification) {
        experimentSection.append(make<HTMLParagraphElement>('p', `Verification · ${verification.state.replaceAll('_', ' ').toLowerCase()}`));
        for (const requirement of verification.requirements.filter(item => item.required)) experimentSection.append(make<HTMLParagraphElement>('p', `${requirement.state === 'SUFFICIENT' ? '✓' : '○'} ${requirement.explanation}`));
      }
      if (roadmap.experimentOutcome) {
        const outcome = roadmap.experimentOutcome;
        experimentSection.append(make<HTMLParagraphElement>('p', `Attempt outcome · ${outcome.reason}${outcome.history.length > 1 ? ` · ${outcome.history.length - 1} previous attempts` : ''}`));
      }
      ui.context.append(experimentSection);
    }
    ui.path.replaceChildren();
    for (const step of roadmap.steps) {
      const item = make<HTMLLIElement>('li');
      const adaptiveStep = adaptive?.orderedSteps.find(candidate => candidate.skillId === step.id); const effectiveStatus = adaptiveStep?.status || step.status; const isCurrent = (adaptive?.currentStep?.skillId || currentStep?.id) === step.id;
      item.className = `${step.isTarget ? 'roadmap-target ' : ''}${isCurrent ? 'roadmap-current ' : ''}${effectiveStatus === 'completed' || effectiveStatus === 'COMPLETED' ? 'roadmap-completed' : 'roadmap-upcoming'}`;
      const stateMark = effectiveStatus === 'completed' || effectiveStatus === 'COMPLETED' ? '✓' : isCurrent ? '→' : '○';
      const stepButton = make<HTMLButtonElement>('button', `${stateMark}  ${String(step.step).padStart(2, '0')}  ${step.name}`); stepButton.type = 'button'; stepButton.setAttribute('aria-label', `Open ${step.name}, ${labelFor(effectiveStatus)}${isCurrent ? ', current focus' : ''}`); stepButton.onclick = () => { pendingSkillId = step.id; void navigate('Skills'); };
      const meta = make<HTMLParagraphElement>('p', `${labelFor(effectiveStatus)} · ${step.category || 'Uncategorised'} · ${step.difficulty || 'Difficulty not set'}`); const reason = make<HTMLParagraphElement>('p', adaptiveStep?.reason || step.reason); item.append(stepButton, meta, reason); ui.path.append(item);
    }
    ui.status.textContent = roadmap.steps.length === 1 ? 'No prerequisites found. You can start this skill directly.' : progress.complete ? 'This path is complete.' : `${roadmap.steps.length} steps from prerequisite to destination.`;
    if (!adaptive && !roadmap.steps.some(step => step.status !== 'not_started')) { const tracking = make<HTMLParagraphElement>('p', 'Track your skills to see your position on this roadmap.'); const open = make<HTMLButtonElement>('button', 'Open Skill Detail'); open.type = 'button'; open.className = 'inline-link'; open.onclick = () => { pendingSkillId = current; void navigate('Skills'); }; tracking.append(' ', open); ui.context.append(tracking); }
    const targetHeading = make<HTMLHeadingElement>('h3', roadmap.goals.length ? 'Goal context' : 'Connect this path to a goal'); ui.context.append(targetHeading); if (roadmap.goals.length) { for (const goal of roadmap.goals) { const goalLine = make<HTMLParagraphElement>('p', `${goal.title} · ${String(goal.status || 'active')}`); const open = make<HTMLButtonElement>('button', 'Open goal'); open.type = 'button'; open.className = 'inline-link'; open.onclick = () => { pendingGoalId = String(goal.id); void navigate('Goals'); }; goalLine.append(' ', open); ui.context.append(goalLine); } } else { ui.context.append(make<HTMLParagraphElement>('p', 'No goal targets this skill yet. Create one when you are ready to commit to the path.')); const create = make<HTMLButtonElement>('button', 'Create goal'); create.type = 'button'; create.className = 'secondary'; create.onclick = () => void openGoalDialog(current); ui.context.append(create); }
    if (roadmap.currentGoals.length) { const actionHeading = make<HTMLHeadingElement>('h3', `Current skill · ${currentStep?.name || 'Completed path'}`); ui.context.append(actionHeading); for (const goal of roadmap.currentGoals) { const p = goal.progress as { actionCount: number; completedActionCount: number } | undefined; const actionLine = make<HTMLParagraphElement>('p', `${p?.actionCount || 0} actions · ${p?.completedActionCount || 0} completed`); const open = make<HTMLButtonElement>('button', 'Open goal'); open.type = 'button'; open.className = 'inline-link'; open.onclick = () => { pendingGoalId = String(goal.id); void navigate('Goals'); }; actionLine.append(' ', open); ui.context.append(actionLine); } }
  } catch (error) { ui.status.textContent = safeError(error).message; }
}
function ensureGoalUi() {
  if (goalUi) return goalUi;
  const host = document.querySelector<HTMLElement>('.wide-empty');
  if (!host) throw new Error('Missing goal detail host.');
  const detail = make<HTMLElement>('section'); detail.className = 'goal-detail'; detail.hidden = true; detail.setAttribute('aria-labelledby', 'goalDetailTitle');
  const back = make<HTMLButtonElement>('button', 'Back to goals'); back.type = 'button'; back.className = 'back-link';
  const eyebrow = make<HTMLElement>('div', 'Goal detail'); eyebrow.className = 'eyebrow';
  const title = make<HTMLHeadingElement>('h2', ''); title.id = 'goalDetailTitle';
  const target = make<HTMLElement>('p'); const meta = make<HTMLElement>('p'); meta.className = 'goal-meta'; const goalControls = make<HTMLElement>('div'); goalControls.className = 'buttons'; const edit = make<HTMLButtonElement>('button', 'Edit goal'); edit.type = 'button'; const remove = make<HTMLButtonElement>('button', 'Delete goal'); remove.type = 'button'; goalControls.append(edit, remove);
  const progress = make<HTMLElement>('section'); progress.className = 'goal-progress'; progress.setAttribute('aria-labelledby', 'goalProgressTitle'); const progressTitle = make<HTMLHeadingElement>('h3', 'Activity progress'); progressTitle.id = 'goalProgressTitle'; const progressText = make<HTMLElement>('p', 'No actions yet. Add a concrete action to start tracking progress.'); const progressTrack = make<HTMLElement>('div'); progressTrack.className = 'progress-track'; progressTrack.setAttribute('role', 'progressbar'); progressTrack.setAttribute('aria-valuemin', '0'); progressTrack.setAttribute('aria-valuemax', '100'); const progressFill = make<HTMLElement>('span'); progressFill.className = 'progress-fill'; progressTrack.append(progressFill); progress.append(progressTitle, progressText, progressTrack);
  const reflection = make<HTMLElement>('section'); reflection.className = 'goal-reflection'; reflection.setAttribute('aria-labelledby', 'goalReflectionTitle'); const reflectionTitle = make<HTMLHeadingElement>('h3', 'Reflect on this goal'); reflectionTitle.id = 'goalReflectionTitle'; const reflectionPeriod = make<HTMLParagraphElement>('p'); reflectionPeriod.className = 'reflection-period'; const reflectionSummary = make<HTMLParagraphElement>('p', "You haven't reflected on this goal yet."); const reflectionNext = make<HTMLParagraphElement>('p'); reflectionNext.className = 'reflection-next'; const reflectionAction = make<HTMLButtonElement>('button', 'Turn into action'); reflectionAction.type = 'button'; reflectionAction.className = 'secondary'; reflectionAction.hidden = true; const reflectionStart = make<HTMLButtonElement>('button', 'Start reflection'); reflectionStart.type = 'button'; reflectionStart.className = 'secondary';
  const reflectionForm = make<HTMLFormElement>('form'); reflectionForm.className = 'goal-reflection-form'; reflectionForm.hidden = true;
  const reflectionFields: Array<[string, string]> = [['accomplishment', 'What did you accomplish?'], ['learning', 'What did you learn?'], ['blocker', 'What got in the way?'], ['nextStep', "What's next?"]];
  const reflectionInputs = reflectionFields.map(([key, label]) => { const field = make<HTMLLabelElement>('label', label); const input = make<HTMLTextAreaElement>('textarea'); input.name = key; input.rows = key === 'blocker' ? 3 : 4; input.maxLength = 4000; field.append(input); reflectionForm.append(field); return input; });
  const reflectionAccomplishment = reflectionInputs[0]; const reflectionLearning = reflectionInputs[1]; const reflectionBlocker = reflectionInputs[2]; const reflectionNextInput = reflectionInputs[3];
  const reflectionStatus = make<HTMLParagraphElement>('p'); reflectionStatus.setAttribute('role', 'status'); const reflectionCancel = make<HTMLButtonElement>('button', 'Cancel'); reflectionCancel.type = 'button'; const reflectionSave = make<HTMLButtonElement>('button', 'Save reflection'); reflectionSave.type = 'submit'; reflectionSave.className = 'primary'; const reflectionButtons = make<HTMLElement>('div'); reflectionButtons.className = 'buttons'; reflectionButtons.append(reflectionCancel, reflectionSave); reflectionForm.append(reflectionStatus, reflectionButtons); reflection.append(reflectionTitle, reflectionPeriod, reflectionSummary, reflectionNext, reflectionAction, reflectionStart, reflectionForm);
  const actionsHeading = make<HTMLHeadingElement>('h3', 'Actions'); const addAction = make<HTMLButtonElement>('button', 'Add action'); addAction.type = 'button'; addAction.className = 'primary';
  const actionHeader = make<HTMLElement>('div'); actionHeader.className = 'detail-sectionhead'; actionHeader.append(actionsHeading, addAction);
  const actionStatus = make<HTMLElement>('p'); actionStatus.setAttribute('role', 'status'); const actions = make<HTMLUListElement>('ul'); actions.className = 'records action-list';
  detail.append(back, eyebrow, title, target, meta, goalControls, progress, reflection, actionHeader, actionStatus, actions); host.append(detail);
  const actionDialog = make<HTMLDialogElement>('dialog'); actionDialog.setAttribute('aria-labelledby', 'actionDialogTitle');
  const form = make<HTMLFormElement>('form'); form.method = 'dialog'; const dialogTitle = make<HTMLHeadingElement>('h2', 'Add an action'); dialogTitle.id = 'actionDialogTitle';
  const titleLabel = make<HTMLLabelElement>('label', 'Action title'); const actionTitle = make<HTMLInputElement>('input'); actionTitle.required = true; actionTitle.maxLength = 180; titleLabel.append(actionTitle);
  const reasonLabel = make<HTMLLabelElement>('label', 'Description'); const actionReason = make<HTMLTextAreaElement>('textarea'); actionReason.maxLength = 1000; actionReason.rows = 3; reasonLabel.append(actionReason);
  const stateLabel = make<HTMLLabelElement>('label', 'Status'); const actionState = make<HTMLSelectElement>('select'); for (const [value, label] of [['todo', 'To do'], ['in_progress', 'In progress'], ['paused', 'Paused'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]) actionState.append(new Option(label, value)); stateLabel.append(actionState);
  const dueLabel = make<HTMLLabelElement>('label', 'Due date'); const actionDue = make<HTMLInputElement>('input'); actionDue.type = 'datetime-local'; dueLabel.append(actionDue);
  const actionError = make<HTMLElement>('p'); actionError.setAttribute('role', 'alert'); const actionButtons = make<HTMLElement>('div'); actionButtons.className = 'buttons'; const cancel = make<HTMLButtonElement>('button', 'Cancel'); cancel.type = 'button'; const save = make<HTMLButtonElement>('button', 'Save action'); save.type = 'submit'; save.className = 'primary'; actionButtons.append(cancel, save); form.append(dialogTitle, titleLabel, reasonLabel, stateLabel, dueLabel, actionError, actionButtons); actionDialog.append(form); document.body.append(actionDialog);
  const evidenceDialog = make<HTMLDialogElement>('dialog'); evidenceDialog.setAttribute('aria-labelledby', 'evidenceDialogTitle'); const evidenceForm = make<HTMLFormElement>('form'); evidenceForm.method = 'dialog'; const evidenceHeading = make<HTMLHeadingElement>('h2', 'Show your work'); evidenceHeading.id = 'evidenceDialogTitle'; const evidenceTitleLabel = make<HTMLLabelElement>('label', 'Evidence title'); const evidenceTitle = make<HTMLInputElement>('input'); evidenceTitle.required = true; evidenceTitle.maxLength = 180; evidenceTitleLabel.append(evidenceTitle); const evidenceTypeLabel = make<HTMLLabelElement>('label', 'Evidence type'); const evidenceType = make<HTMLSelectElement>('select'); for (const [value, label] of [['repository', 'Repository'], ['deployment', 'Deployed website'], ['demo', 'Demo'], ['screenshot', 'Screenshot link'], ['certificate', 'Certificate'], ['writing', 'Written reflection'], ['exercise', 'Exercise'], ['artifact', 'Other proof']]) evidenceType.append(new Option(label, value)); evidenceTypeLabel.append(evidenceType); const evidenceSkillLabel = make<HTMLLabelElement>('label', 'Skill demonstrated'); const evidenceSkill = make<HTMLSelectElement>('select'); evidenceSkillLabel.append(evidenceSkill); const evidenceUrlLabel = make<HTMLLabelElement>('label', 'Link (optional)'); const evidenceUrl = make<HTMLInputElement>('input'); evidenceUrl.type = 'url'; evidenceUrl.placeholder = 'https://…'; evidenceUrlLabel.append(evidenceUrl); const evidenceNotesLabel = make<HTMLLabelElement>('label', 'Reflection or notes'); const evidenceNotes = make<HTMLTextAreaElement>('textarea'); evidenceNotes.rows = 4; evidenceNotes.maxLength = 4000; evidenceNotes.placeholder = 'What did you build, learn, or complete?'; evidenceNotesLabel.append(evidenceNotes); const evidenceError = make<HTMLElement>('p'); evidenceError.setAttribute('role', 'alert'); const evidenceButtons = make<HTMLElement>('div'); evidenceButtons.className = 'buttons'; const evidenceCancel = make<HTMLButtonElement>('button', 'Cancel'); evidenceCancel.type = 'button'; const evidenceSave = make<HTMLButtonElement>('button', 'Save evidence'); evidenceSave.type = 'submit'; evidenceSave.className = 'primary'; evidenceButtons.append(evidenceCancel, evidenceSave); evidenceForm.append(evidenceHeading, make<HTMLParagraphElement>('p', 'Evidence turns completed actions into a record of what you actually accomplished.'), evidenceTitleLabel, evidenceTypeLabel, evidenceSkillLabel, evidenceUrlLabel, evidenceNotesLabel, evidenceError, evidenceButtons); evidenceDialog.append(evidenceForm); document.body.append(evidenceDialog);
  goalUi = { detail, title, target, meta, progress, progressText, progressFill, reflection, reflectionPeriod, reflectionSummary, reflectionNext, reflectionAction, reflectionStart, reflectionForm, reflectionAccomplishment: reflectionInputs[0], reflectionLearning: reflectionInputs[1], reflectionBlocker: reflectionInputs[2], reflectionNextInput: reflectionInputs[3], reflectionStatus, reflectionSave, reflectionCancel, reflectionId: null, actions, actionStatus, addAction, edit, remove, back, actionDialog, actionForm: form, actionTitle, actionReason, actionState, actionDue, actionError, evidenceDialog, evidenceForm, evidenceTitle, evidenceType, evidenceSkill, evidenceUrl, evidenceNotes, evidenceError };
  back.onclick = () => { detail.hidden = true; el('records').hidden = false; void loadView(); };
  edit.onclick = () => { if (selectedGoal) void openGoalDialog(null, selectedGoal); };
  remove.onclick = async () => { if (!selectedGoal || !data || !window.confirm(`Permanently delete “${String(selectedGoal.title)}”? This cannot be undone.`)) return; remove.disabled = true; edit.disabled = true; try { await data.deleteGoal(String(selectedGoal.id)); detail.hidden = true; el('records').hidden = false; await loadView(); message('Goal deleted.'); } catch (error) { actionStatus.textContent = safeError(error).message; remove.disabled = false; edit.disabled = false; } };
  addAction.onclick = () => void openActionDialog(); cancel.onclick = () => { if (!save.disabled) closeEditorialDialog(actionDialog); }; evidenceCancel.onclick = () => { if (!evidenceSave.disabled) closeEditorialDialog(evidenceDialog); };
  reflectionStart.onclick = () => { reflectionForm.hidden = false; reflectionStart.hidden = true; reflectionAccomplishment.focus(); };
  reflectionAction.onclick = () => { const nextStep = reflectionNextInput.value.trim(); if (nextStep) void openActionDialog(undefined, nextStep); };
  reflectionCancel.onclick = () => { reflectionForm.hidden = true; reflectionStart.hidden = false; };
  form.onsubmit = async event => { event.preventDefault(); if (!selectedGoal || !data || !userId || save.disabled) return; const identity = userId; const wasReflectionAction = actionFromReflection; const completingAction = actionState.value === 'completed' && (!editingActionId || editingActionInitialStatus !== 'completed'); save.disabled = true; cancel.disabled = true; actionError.textContent = ''; save.textContent = 'Saving…'; try { const input = { title: actionTitle.value, reason: actionReason.value, status: actionState.value as Row<'actions'>['status'], dueAt: actionDue.value ? new Date(actionDue.value).toISOString() : null }; if (editingActionId) await data.updateAction(editingActionId, input); else await data.createAction(String(selectedGoal.id), input); if (completingAction) recordMilestone('first_action_completed'); if (identity === userId) { closeEditorialDialog(actionDialog); await showGoalDetail(selectedGoal); goalUi!.actionStatus.textContent = editingActionId ? 'Action updated.' : wasReflectionAction ? 'Action created.' : 'Action added.'; } editingActionId = null; editingActionInitialStatus = null; actionFromReflection = false; } catch (error) { if (identity === userId) actionError.textContent = safeError(error).message; } finally { save.disabled = false; cancel.disabled = false; save.textContent = 'Save action'; } };
  evidenceForm.onsubmit = async event => { event.preventDefault(); if (!data || !userId || !selectedEvidenceActionId || evidenceSave.disabled) return; const identity = userId; const addingEvidence = !editingEvidenceId; evidenceSave.disabled = true; evidenceCancel.disabled = true; evidenceError.textContent = ''; evidenceSave.textContent = 'Saving…'; try { const input = { title: evidenceTitle.value, type: evidenceType.value, skillId: evidenceSkill.value || null, url: evidenceUrl.value, notes: evidenceNotes.value }; if (editingEvidenceId) await data.updateEvidence(editingEvidenceId, input); else await data.createEvidence(selectedEvidenceActionId, input); if (addingEvidence) recordMilestone('first_evidence_added'); if (identity === userId && selectedGoal) { closeEditorialDialog(evidenceDialog); await showGoalDetail(selectedGoal); goalUi!.actionStatus.textContent = editingEvidenceId ? 'Evidence updated.' : 'Evidence attached.'; } editingEvidenceId = null; } catch (error) { if (identity === userId) evidenceError.textContent = safeError(error).message; } finally { evidenceSave.disabled = false; evidenceCancel.disabled = false; evidenceSave.textContent = 'Save evidence'; } };
  reflectionForm.onsubmit = async event => { event.preventDefault(); if (!data || !userId || !selectedGoal || reflectionSave.disabled) return; const identity = userId; const periodValue = currentWeekPeriod(); reflectionSave.disabled = true; reflectionStatus.textContent = 'Saving…'; try { const input = { goalId: String(selectedGoal.id), periodStart: periodValue.start, periodEnd: periodValue.end, accomplishment: reflectionAccomplishment.value, learning: reflectionLearning.value, blocker: reflectionBlocker.value, nextStep: reflectionNextInput.value }; if (goalUi?.reflectionId) await data.updateReflection(goalUi.reflectionId, input); else await data.createReflection(input); if (identity === userId && selectedGoal) { await showGoalDetail(selectedGoal); goalUi!.reflectionStatus.textContent = 'Saved ✓'; } } catch (error) { if (identity === userId) reflectionStatus.textContent = safeError(error).message; } finally { reflectionSave.disabled = false; } };
  return goalUi;
}
async function openActionDialog(action?: Row<'actions'>, nextStep?: string) {
  if (!goalUi || !selectedGoal) return; editingActionId = action?.id || null; editingActionInitialStatus = action?.status || null; actionFromReflection = !action && !!nextStep; goalUi.actionDialog.querySelector('h2')!.textContent = editingActionId ? 'Edit action' : actionFromReflection ? 'Turn next step into action' : 'Add an action'; goalUi.actionDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent = actionFromReflection ? 'Create action' : 'Save action'; goalUi.actionTitle.value = action?.title || nextStep || ''; goalUi.actionReason.value = action?.reason || ''; goalUi.actionState.value = action?.status || 'todo'; goalUi.actionDue.value = action?.due_at ? new Date(action.due_at).toISOString().slice(0, 16) : ''; goalUi.actionError.textContent = ''; goalUi.actionDialog.showModal(); goalUi.actionTitle.focus();
}
async function openEvidenceDialog(actionId: string, evidence?: Row<'evidence'>) {
  if (!goalUi || !data || !selectedGoal) return; const targetSkillId = typeof selectedGoal.target_skill_id === 'string' ? selectedGoal.target_skill_id : ''; selectedEvidenceActionId = actionId; editingEvidenceId = evidence?.id || null; goalUi.evidenceDialog.querySelector('h2')!.textContent = editingEvidenceId ? 'Edit evidence' : 'Show your work'; goalUi.evidenceTitle.value = evidence?.title || ''; goalUi.evidenceType.value = evidence?.type || 'artifact'; goalUi.evidenceUrl.value = evidence?.url || ''; goalUi.evidenceNotes.value = evidence?.notes || ''; goalUi.evidenceError.textContent = ''; goalUi.evidenceSkill.replaceChildren(); try { const roadmap = targetSkillId ? await data.roadmap(targetSkillId) : null; for (const step of roadmap?.steps || []) goalUi.evidenceSkill.append(new Option(String(step.name), String(step.id))); goalUi.evidenceSkill.value = String(roadmap?.steps.at(-1)?.id || ''); } catch { goalUi.evidenceSkill.append(new Option('Selected goal skill', targetSkillId)); } goalUi.evidenceDialog.showModal(); goalUi.evidenceTitle.focus();
}
async function renderGoalActions(actions: Row<'actions'>[], evidenceByAction?: Map<string, Row<'evidence'>[]>) {
  if (!goalUi || !data) return; goalUi.actions.replaceChildren();
  if (!actions.length) { const empty = make<HTMLLIElement>('li'); empty.className = 'action-empty'; empty.append(make<HTMLHeadingElement>('h3', 'Turn this goal into progress.'), make<HTMLParagraphElement>('p', 'Add your first action and make the next step concrete.')); goalUi.actions.append(empty); return; }
  const evidenceResults = evidenceByAction ? actions.map(action => evidenceByAction.get(action.id) || []) : await Promise.all(actions.map(action => data.actionEvidence(action.id)));
  for (const [index, action] of actions.entries()) { const item = make<HTMLLIElement>('li'); item.className = action.status === 'completed' ? 'action-complete' : ''; const heading = make<HTMLHeadingElement>('h3', action.title); const detail = make<HTMLParagraphElement>('p', `${action.status.replaceAll('_', ' ')} · ${action.due_at ? `Due ${new Date(action.due_at).toLocaleString()}` : 'No due date'}`); if (action.reason) item.append(heading, make<HTMLParagraphElement>('p', action.reason)); else item.append(heading); item.append(detail);
    const evidence = evidenceResults[index]; const evidenceSection = make<HTMLElement>('section'); evidenceSection.className = 'evidence-section'; const evidenceHeading = make<HTMLHeadingElement>('h4', evidence.length ? 'Evidence attached' : 'No evidence yet'); evidenceSection.append(evidenceHeading);
    if (action.status !== 'completed') evidenceSection.append(make<HTMLParagraphElement>('p', 'Complete the action first, then document the result.'));
    else if (!evidence.length) { evidenceSection.append(make<HTMLParagraphElement>('p', 'Add a link, note, or proof of what you completed.')); const addEvidence = make<HTMLButtonElement>('button', 'Add evidence'); addEvidence.type = 'button'; addEvidence.className = 'secondary'; addEvidence.onclick = () => void openEvidenceDialog(action.id); evidenceSection.append(addEvidence); }
    else for (const proof of evidence) { const card = make<HTMLElement>('article'); card.className = 'evidence-card'; card.append(make<HTMLHeadingElement>('h4', proof.title), make<HTMLParagraphElement>('p', proof.type.replaceAll('_', ' '))); if (proof.url) { const link = make<HTMLAnchorElement>('a', 'Open evidence ↗'); link.href = proof.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); } if (proof.notes) card.append(make<HTMLParagraphElement>('p', proof.notes)); const proofControls = make<HTMLElement>('div'); proofControls.className = 'buttons'; const editProof = make<HTMLButtonElement>('button', 'Edit evidence'); editProof.type = 'button'; editProof.onclick = () => void openEvidenceDialog(action.id, proof); const deleteProof = make<HTMLButtonElement>('button', 'Remove evidence'); deleteProof.type = 'button'; deleteProof.onclick = async () => { if (!data || !window.confirm(`Remove “${proof.title}”?`)) return; deleteProof.disabled = true; try { await data.deleteEvidence(proof.id); if (selectedGoal) await showGoalDetail(selectedGoal); } catch (error) { if (goalUi) goalUi.actionStatus.textContent = safeError(error).message; deleteProof.disabled = false; } }; proofControls.append(editProof, deleteProof); card.append(proofControls); evidenceSection.append(card); }
    item.append(evidenceSection); const controls = make<HTMLElement>('div'); controls.className = 'buttons'; const edit = make<HTMLButtonElement>('button', 'Edit action'); edit.type = 'button'; edit.onclick = () => void openActionDialog(action); const remove = make<HTMLButtonElement>('button', 'Delete action'); remove.type = 'button'; remove.onclick = async () => { if (!data || !window.confirm(`Delete “${action.title}”?`)) return; remove.disabled = true; try { await data.deleteAction(action.id); if (selectedGoal && goalUi) await showGoalDetail(selectedGoal); } catch (error) { if (goalUi) goalUi.actionStatus.textContent = safeError(error).message; remove.disabled = false; } }; controls.append(edit, remove); if (action.status === 'completed' && evidence.length) { const proofTag = make<HTMLElement>('span', 'Proof attached'); proofTag.className = 'proof-tag'; controls.append(proofTag); } item.append(controls); goalUi.actions.append(item); }
}
function renderGoalReflection(ui: NonNullable<typeof goalUi>, review: Awaited<ReturnType<NonNullable<typeof data>['goalReviewActivity']>>, reflections: Row<'reflections'>[]) {
  const period = review.period; ui.reflectionPeriod.textContent = `Week of ${period.start} — ${period.end}`;
  ui.reflectionSummary.textContent = review.actionCount ? `This week: ${review.completedActionCount} action${review.completedActionCount === 1 ? '' : 's'} completed · ${review.evidenceCount} evidence item${review.evidenceCount === 1 ? '' : 's'} · ${review.completedActionCount} of ${review.actionCount} actions completed overall.` : 'Not enough activity to summarize this period yet.';
  const existing = reflections.find(reflection => reflection.goal_id === String(selectedGoal?.id) && reflection.period_start === period.start && reflection.period_end === period.end);
  ui.reflectionId = existing?.id || null; ui.reflectionAccomplishment.value = existing?.accomplishment || ''; ui.reflectionLearning.value = existing?.learning || ''; ui.reflectionBlocker.value = existing?.blocker || ''; ui.reflectionNextInput.value = existing?.next_step || '';
  ui.reflectionNext.replaceChildren(); if (existing?.next_step) { const label = make<HTMLElement>('strong', 'Next step'); ui.reflectionNext.append(label, document.createTextNode(` ${existing.next_step}`)); } else ui.reflectionNext.textContent = 'Your next step will appear here after you reflect.';
  ui.reflectionAction.hidden = !existing?.next_step; ui.reflectionSummary.classList.toggle('reflection-saved', !!existing); ui.reflectionForm.hidden = true; ui.reflectionStart.hidden = !!existing; ui.reflectionStart.textContent = existing ? 'Edit reflection' : 'Start reflection'; ui.reflectionStatus.textContent = existing ? 'Your reflection is saved for this goal and week.' : '';
}
async function showGoalDetail(goal: Record<string, unknown>) {
  if (!data || !userId) return; const ui = ensureGoalUi(); selectedGoal = goal; ui.detail.hidden = false; el('records').hidden = true; el('emptyTitle').hidden = true; el('emptyText').hidden = true; el('loadMore').hidden = true; el('retryData').hidden = true; ui.title.textContent = String(goal.title); ui.target.textContent = goal.targetSkill && typeof goal.targetSkill === 'object' && 'name' in goal.targetSkill ? `Target skill: ${(goal.targetSkill as { name: string }).name}` : 'No target skill selected'; ui.meta.textContent = `${String(goal.status || 'active')} · ${goal.deadline ? `Target date: ${goal.deadline}` : 'No target date'} · ${goal.target_mastery == null ? 'Target mastery not set' : `Target mastery ${goal.target_mastery}`}`; ui.progressText.textContent = 'Loading activity…'; ui.progressFill.style.width = '0%'; ui.progressFill.parentElement?.setAttribute('aria-valuenow', '0'); ui.actionStatus.textContent = 'Loading actions…'; try { const [activity, review, reflections] = await Promise.all([data.goalActivity(String(goal.id)), data.goalReviewActivity(String(goal.id)), data.reflections()]); const { progress } = activity; const ratio = progress.completionRatio == null ? 0 : Math.round(progress.completionRatio * 100); ui.progressText.textContent = progress.actionCount ? `${progress.completedActionCount} of ${progress.actionCount} actions completed · ${progress.evidenceCount} evidence item${progress.evidenceCount === 1 ? '' : 's'} · Action completion ratio ${Math.round((progress.completionRatio || 0) * 100)}%` : 'No actions yet. Add a concrete action to start tracking progress.'; ui.progressFill.style.width = `${ratio}%`; ui.progressFill.parentElement?.setAttribute('aria-valuenow', String(ratio)); renderGoalReflection(ui, review, reflections); await renderGoalActions(activity.actions, activity.evidenceByAction); ui.actionStatus.textContent = activity.actions.length ? `${activity.actions.length} action${activity.actions.length === 1 ? '' : 's'}` : ''; } catch (error) { ui.actionStatus.textContent = `Actions unavailable: ${safeError(error).message}`; }
}
function ensureReviewUi() {
  if (reviewUi) return reviewUi;
  const host = document.querySelector<HTMLElement>('.wide-empty');
  if (!host) throw new Error('Missing review host.');
  const panel = make<HTMLElement>('section'); panel.className = 'review-panel'; panel.hidden = true; panel.setAttribute('aria-labelledby', 'reviewTitle');
  const hero = make<HTMLElement>('header'); hero.className = 'review-hero';
  const heroCopy = make<HTMLElement>('div'); heroCopy.className = 'review-hero-copy';
  const kicker = make<HTMLParagraphElement>('p', 'Weekly field report'); kicker.className = 'section-label';
  const title = make<HTMLHeadingElement>('h2', 'Read the week, then redirect'); title.id = 'reviewTitle';
  const introduction = make<HTMLParagraphElement>('p', 'A quiet record of what moved, what became proof, and what deserves your attention next.');
  const period = make<HTMLParagraphElement>('p'); period.className = 'review-period';
  heroCopy.append(kicker, title, introduction, period);
  const visual = make<HTMLElement>('div'); visual.className = 'review-visual'; visual.setAttribute('aria-hidden', 'true');
  const orbit = make<HTMLElement>('div'); orbit.className = 'review-orbit';
  const orbitSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); orbitSvg.setAttribute('viewBox', '0 0 520 320');
  const orbitNode = (name: 'path' | 'circle', attributes: Record<string, string>) => { const node = document.createElementNS('http://www.w3.org/2000/svg', name); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); return node; };
  orbitSvg.append(
    orbitNode('path', { d: 'M20 254 C128 126 222 286 330 142 S454 54 502 92' }),
    orbitNode('path', { d: 'M66 292 C142 220 244 238 288 164 S396 36 484 74' }),
    orbitNode('circle', { cx: '20', cy: '254', r: '7' }), orbitNode('circle', { cx: '184', cy: '214', r: '7' }),
    orbitNode('circle', { cx: '330', cy: '142', r: '9' }), orbitNode('circle', { cx: '502', cy: '92', r: '12' }),
  ); orbit.append(orbitSvg);
  const pulse = make<HTMLParagraphElement>('p', 'Reading this week…'); pulse.className = 'review-pulse';
  const signal = make<HTMLParagraphElement>('p', 'Your real activity becomes the shape of this report.'); signal.className = 'review-signal';
  visual.append(orbit, pulse, signal); hero.append(heroCopy, visual);
  const metrics = make<HTMLUListElement>('ul'); metrics.className = 'review-metrics';
  const accomplishments = make<HTMLUListElement>('ul'); accomplishments.className = 'review-list';
  const accomplishmentsHeading = make<HTMLHeadingElement>('h3', 'What you accomplished');
  const evidence = make<HTMLUListElement>('ul'); evidence.className = 'review-list';
  const evidenceHeading = make<HTMLHeadingElement>('h3', 'Your proof');
  const ledger = make<HTMLElement>('div'); ledger.className = 'review-ledger';
  const accomplishmentChapter = make<HTMLElement>('section'); accomplishmentChapter.className = 'review-chapter'; accomplishmentChapter.append(accomplishmentsHeading, accomplishments);
  const evidenceChapter = make<HTMLElement>('section'); evidenceChapter.className = 'review-chapter'; evidenceChapter.append(evidenceHeading, evidence); ledger.append(accomplishmentChapter, evidenceChapter);
  const form = make<HTMLFormElement>('form'); form.className = 'reflection-form';
  const goalLabel = make<HTMLLabelElement>('label', 'Goal (optional)'); const goal = make<HTMLSelectElement>('select'); goal.append(new Option('General review', '')); goalLabel.append(goal);
  const fields: Array<[string, string]> = [['accomplishment', 'What are you most proud of completing?'], ['learning', 'What did you learn while working on this goal?'], ['blocker', 'What slowed you down or blocked you?'], ['nextStep', "What's the most important thing to do next?"]];
  const textareas = fields.map(([key, label]) => { const wrapper = make<HTMLElement>('label', label); const area = make<HTMLTextAreaElement>('textarea'); area.name = key; area.rows = key === 'blocker' ? 3 : 4; area.maxLength = 4000; wrapper.append(area); form.append(wrapper); return area; });
  const status = make<HTMLParagraphElement>('p'); status.setAttribute('role', 'status'); const save = make<HTMLButtonElement>('button', 'Save reflection'); save.type = 'submit'; save.className = 'primary'; form.append(status, save);
  const reflectionChapter = make<HTMLElement>('section'); reflectionChapter.className = 'review-reflection'; reflectionChapter.append(make<HTMLHeadingElement>('h3', 'Your reflection'), form);
  panel.append(hero, metrics, ledger, reflectionChapter); host.append(panel);
  reviewUi = { panel, period, pulse, signal, metrics, accomplishments, evidence, form, goal, accomplishment: textareas[0], learning: textareas[1], blocker: textareas[2], nextStep: textareas[3], status, save, editId: null };
  form.onsubmit = async event => { event.preventDefault(); if (!data || !reviewUi || reviewUi.save.disabled) return; const ui = reviewUi; const periodValue = currentWeekPeriod(); ui.save.disabled = true; ui.status.textContent = 'Saving…'; try { const input = { goalId: ui.goal.value || null, periodStart: periodValue.start, periodEnd: periodValue.end, accomplishment: ui.accomplishment.value, learning: ui.learning.value, blocker: ui.blocker.value, nextStep: ui.nextStep.value }; if (ui.editId) await data.updateReflection(ui.editId, input); else await data.createReflection(input); ui.status.textContent = 'Saved ✓'; await loadReview(); } catch (error) { ui.status.textContent = safeError(error).message; } finally { ui.save.disabled = false; } };
  return reviewUi;
}
async function loadReview() {
  if (!data || !userId) return;
  const ui = ensureReviewUi(); if (roadmapUi) roadmapUi.panel.hidden = true; ui.panel.hidden = false; el('records').hidden = true; el('emptyTitle').hidden = true; el('emptyText').hidden = true; el('loadMore').hidden = true; el('retryData').hidden = true; ui.period.textContent = '';
  const period = currentWeekPeriod();
  try {
    const [activity, goals, reflections] = await Promise.all([data.reviewActivity(period), data.goals(), data.reflections()]);
    ui.period.textContent = `Review period: ${period.label}`;
    ui.pulse.textContent = `${activity.completedActionCount} completed · ${activity.evidenceCount} proof item${activity.evidenceCount === 1 ? '' : 's'}`;
    ui.signal.textContent = activity.completionRatio == null ? 'Complete an action to establish this week’s first measurable signal.' : `Action completion ratio: ${Math.round(activity.completionRatio * 100)}%.`;
    ui.metrics.replaceChildren();
    for (const label of [`${activity.completedActionCount} actions completed`, `${activity.evidenceCount} evidence item${activity.evidenceCount === 1 ? '' : 's'} added`, `${activity.activeGoalCount} active goal${activity.activeGoalCount === 1 ? '' : 's'}`, `${activity.completedGoalCount} completed goal${activity.completedGoalCount === 1 ? '' : 's'}`, `Action completion ratio ${activity.completionRatio == null ? 'not available' : `${Math.round(activity.completionRatio * 100)}%`}`]) { const item = make<HTMLLIElement>('li', label); ui.metrics.append(item); }
    ui.accomplishments.replaceChildren(); if (!activity.completedActions.length) ui.accomplishments.append(make<HTMLLIElement>('li', 'Not enough activity to summarize this period yet.')); else for (const action of activity.completedActions) { const item = make<HTMLLIElement>('li', `✓ ${action.title}`); if (activity.evidenceItems.some(evidence => evidence.action_id === action.id)) item.append(make<HTMLSpanElement>('span', 'Evidence attached')); ui.accomplishments.append(item); }
    ui.evidence.replaceChildren(); if (!activity.evidenceItems.length) ui.evidence.append(make<HTMLLIElement>('li', 'No proof added yet. Document your work when you\'re ready.')); else for (const proof of activity.evidenceItems) ui.evidence.append(make<HTMLLIElement>('li', `${proof.title} · ${String(proof.type).replaceAll('_', ' ')}`));
    ui.goal.replaceChildren(new Option('General review', '')); for (const goal of goals.rows) ui.goal.append(new Option(String(goal.title), String(goal.id)));
    const existing = reflections.find(reflection => reflection.period_start === period.start && reflection.period_end === period.end && reflection.goal_id == null); ui.editId = existing?.id || null; ui.goal.value = existing?.goal_id || ''; ui.accomplishment.value = existing?.accomplishment || ''; ui.learning.value = existing?.learning || ''; ui.blocker.value = existing?.blocker || ''; ui.nextStep.value = existing?.next_step || ''; if (existing) ui.status.textContent = 'Edit your saved reflection or keep it as a record.';
  } catch (error) { ui.status.textContent = `Review unavailable: ${safeError(error).message}`; }
}

async function synchronizeAuth(session: Session | null) {
  if (!auth) return;
  if (session?.user.id === userId && !el('workspace').hidden) return;
  const epoch = ++authEpoch;
  clearPrivateState();
  el('authError').textContent = '';
  el('authRetry').hidden = true;
  if (!session) { showAuth(); return; }
  el('authForm').hidden = true;
  el('authHeading').textContent = 'Opening your workspace…';
  el('authDescription').textContent = 'Verifying your session and profile.';
  try {
    const user = await auth.verifyUser();
    await auth.profile(user.id);
    if (epoch !== authEpoch) return;
    userId = user.id;
    el('authPanel').hidden = true;
    el('workspace').hidden = false;
    el('connectionStatus').textContent = import.meta.env.VITE_SKILLOS_LOCAL_E2E === 'true' ? 'Local development' : 'Supabase connected';
    password.value = '';
    await navigate(routeFromUrl());
  } catch (error) {
    if (epoch !== authEpoch) return;
    showAuth('Your workspace could not be opened. No private data has been loaded.');
    el('authError').textContent = safeError(error).message;
    el('authRetry').hidden = false;
  }
}
function routeFromUrl(): View {
  const requested = new URLSearchParams(location.search).get('view');
  const aliases: Record<string, View> = { Atlas: 'Skills', History: 'Learning history' };
  const resolved = requested ? aliases[requested] || requested : null;
  return resolved === 'Today' || (resolved && resolved in views) ? resolved as View : 'Today';
}
function renderRows(rows: Record<string, unknown>[]) {
  for (const [rowIndex, row] of rows.entries()) {
    const li = document.createElement('li');
    li.className = 'record-row';
    const marker = document.createElement('span');
    marker.className = 'record-marker';
    marker.textContent = String(rowIndex + 1).padStart(2, '0');
    marker.setAttribute('aria-hidden', 'true');
    li.append(marker);
    const heading = document.createElement('h3');
    if (currentView === 'Goals' && typeof row.id === 'string') { const open = document.createElement('button'); open.type = 'button'; open.className = 'goal-title-link'; open.textContent = String(row.title ?? 'Saved goal'); open.onclick = () => void showGoalDetail(row); heading.append(open); } else heading.textContent = String(row.title ?? row.name ?? 'Saved record');
    li.append(heading);
    const detail = document.createElement('p');
    const state = row.status ? String(row.status).replaceAll('_', ' ') : '';
    const progress = row.progress as { actionCount: number; completedActionCount: number; evidenceCount: number; completionRatio: number | null } | undefined;
    detail.textContent = currentView === 'Goals'
      ? `${state || 'active'} · ${progress?.actionCount ? `${progress.completedActionCount} of ${progress.actionCount} actions completed` : 'No actions yet'} · ${progress?.evidenceCount ?? 0} evidence · Action completion ratio ${progress?.completionRatio == null ? 'not available' : `${Math.round(progress.completionRatio * 100)}%`}`
      : currentView === 'Skills'
      ? `${state === 'completed' ? 'Completed' : state === 'practicing' ? 'Practicing' : state === 'paused' ? 'Paused' : 'Learning'} · Target mastery: ${row.target_mastery ?? 'not set'} · Current mastery: not calculated`
      : state || 'Saved to your account';
    li.append(detail);
    if (currentView === 'Goals') {
      const target = row.targetSkill as { id: string; name: string } | null | undefined;
      const targetLine = document.createElement('p');
      if (target) {
        const label = document.createElement('span'); label.textContent = 'Target skill: ';
        const link = document.createElement('button'); link.textContent = target.name; link.type = 'button'; link.className = 'inline-link'; link.onclick = () => { pendingSkillId = target.id; void navigate('Skills'); };
        targetLine.append(label, link);
      } else targetLine.textContent = 'Target skill: none selected';
      li.append(targetLine);
      if (typeof row.deadline === 'string' && row.deadline) { const deadline = document.createElement('p'); deadline.textContent = `Target date: ${row.deadline}`; li.append(deadline); }
    }
    if (typeof row.description === 'string' && row.description) {
      const description = document.createElement('p'); description.textContent = row.description; li.append(description);
    }
    if (typeof row.url === 'string') {
      try {
        const url = new URL(row.url);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          const link = document.createElement('a'); link.href = url.href; link.textContent = 'View source'; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link);
        }
      } catch { /* Invalid historical links are never activated. */ }
    }
    el('records').append(li);
    if (currentView === 'Goals' && typeof row.id === 'string') {
      const controls = document.createElement('div'); controls.className = 'buttons';
      const edit = document.createElement('button'); edit.textContent = 'Edit goal';
      edit.onclick = () => void openGoalDialog(null, row);
      const remove = document.createElement('button'); remove.textContent = 'Delete goal';
      remove.onclick = async () => {
        if (!data || !userId || !window.confirm(`Permanently delete “${String(row.title)}”? This cannot be undone.`)) return;
        const identity = userId;
        remove.disabled = true; edit.disabled = true;
        try {
          await data.deleteGoal(row.id as string);
          if (identity !== userId) return;
          await loadView(); message('Goal deleted.');
        } catch (error) {
          if (identity === userId) handleFailure(error, 'status');
          remove.disabled = false; edit.disabled = false;
        }
      };
      controls.append(edit, remove); li.append(controls);
    }
    if (currentView === 'Evidence') {
      const sourceLine = document.createElement('p'); sourceLine.textContent = row.project_id ? `Source: Project · ${String(row.project_id)}` : row.action_id ? `Source: Action · ${String(row.action_id)}` : 'Source: Standalone evidence'; li.append(sourceLine);
    }
  }
  const linkedGoal = pendingGoalId ? rows.find(row => row.id === pendingGoalId) : undefined;
  pendingGoalId = null;
  if (linkedGoal) void showGoalDetail(linkedGoal);
}
function ensureProjectsUi() {
  if (projectUi) return projectUi;
  const wide = document.querySelector<HTMLElement>('#other .wide-empty'); if (!wide) throw new Error('Missing projects host.');
  const panel = make<HTMLElement>('section'); panel.className = 'project-workshop'; panel.setAttribute('aria-labelledby', 'projectsWorkshopTitle');
  const heading = make<HTMLHeadingElement>('h2', 'Build log'); heading.id = 'projectsWorkshopTitle';
  const intro = make<HTMLParagraphElement>('p', 'Projects create opportunities to demonstrate a skill. Project completion alone is never proof.');
  const create = make<HTMLButtonElement>('button', 'Create project'); create.type = 'button'; create.className = 'primary';
  const body = make<HTMLElement>('div'); body.className = 'project-workshop-body'; panel.append(heading, intro, create, body); wide.prepend(panel);
  const dialog = make<HTMLDialogElement>('dialog'); dialog.setAttribute('aria-labelledby', 'projectDialogTitle'); const form = make<HTMLFormElement>('form'); form.method = 'dialog'; const title = make<HTMLHeadingElement>('h2', 'Start a project'); title.id = 'projectDialogTitle'; const titleInput = make<HTMLInputElement>('input'); titleInput.required = true; titleInput.maxLength = 180; const titleLabel = make<HTMLLabelElement>('label', 'Project title'); titleLabel.append(titleInput); const description = make<HTMLTextAreaElement>('textarea'); description.rows = 4; description.maxLength = 4000; const descriptionLabel = make<HTMLLabelElement>('label', 'What are you building?'); descriptionLabel.append(description); const status = make<HTMLSelectElement>('select'); for (const value of ['planned', 'active', 'paused', 'completed']) status.append(new Option(value[0].toUpperCase() + value.slice(1), value)); const statusLabel = make<HTMLLabelElement>('label', 'Project status'); statusLabel.append(status); const error = make<HTMLElement>('p'); error.setAttribute('role', 'alert'); const buttons = make<HTMLElement>('div'); buttons.className = 'buttons'; const cancel = make<HTMLButtonElement>('button', 'Cancel'); cancel.type = 'button'; const save = make<HTMLButtonElement>('button', 'Save project'); save.type = 'submit'; save.className = 'primary'; buttons.append(cancel, save); form.append(title, make<HTMLParagraphElement>('p', 'A project is a workshop record. Add artifacts and explicit skill proof as you build.'), titleLabel, descriptionLabel, statusLabel, error, buttons); dialog.append(form); document.body.append(dialog);
  const artifactDialog = make<HTMLDialogElement>('dialog'); artifactDialog.setAttribute('aria-labelledby', 'artifactDialogTitle'); const artifactForm = make<HTMLFormElement>('form'); artifactForm.method = 'dialog'; const artifactHeading = make<HTMLHeadingElement>('h2', 'Add an artifact'); artifactHeading.id = 'artifactDialogTitle'; const artifactTitle = make<HTMLInputElement>('input'); artifactTitle.required = true; artifactTitle.maxLength = 180; const artifactTitleLabel = make<HTMLLabelElement>('label', 'Artifact title'); artifactTitleLabel.append(artifactTitle); const artifactType = make<HTMLSelectElement>('select'); for (const [value, label] of [['repository', 'GitHub repository'], ['deployment', 'Deployed website'], ['screenshot', 'Screenshot'], ['demo', 'Demo'], ['writing', 'Document or report'], ['artifact', 'Other output']]) artifactType.append(new Option(label, value)); const artifactTypeLabel = make<HTMLLabelElement>('label', 'Artifact type'); artifactTypeLabel.append(artifactType); const artifactReference = make<HTMLInputElement>('input'); artifactReference.type = 'url'; artifactReference.placeholder = 'https://…'; const artifactReferenceLabel = make<HTMLLabelElement>('label', 'URL or reference'); artifactReferenceLabel.append(artifactReference); const artifactNotes = make<HTMLTextAreaElement>('textarea'); artifactNotes.rows = 4; artifactNotes.maxLength = 4000; const artifactNotesLabel = make<HTMLLabelElement>('label', 'Description'); artifactNotesLabel.append(artifactNotes); const artifactError = make<HTMLElement>('p'); artifactError.setAttribute('role', 'alert'); const artifactButtons = make<HTMLElement>('div'); artifactButtons.className = 'buttons'; const artifactCancel = make<HTMLButtonElement>('button', 'Cancel'); artifactCancel.type = 'button'; const artifactSave = make<HTMLButtonElement>('button', 'Save artifact'); artifactSave.type = 'submit'; artifactSave.className = 'primary'; artifactButtons.append(artifactCancel, artifactSave); artifactForm.append(artifactHeading, make<HTMLParagraphElement>('p', 'Use a real repository, deployment, document, design, video, dataset, or code reference.'), artifactTitleLabel, artifactTypeLabel, artifactReferenceLabel, artifactNotesLabel, artifactError, artifactButtons); artifactDialog.append(artifactForm); document.body.append(artifactDialog);
  const proofDialog = make<HTMLDialogElement>('dialog'); proofDialog.setAttribute('aria-labelledby', 'proofDialogTitle'); const proofForm = make<HTMLFormElement>('form'); proofForm.method = 'dialog'; const proofHeading = make<HTMLHeadingElement>('h2', 'Record skill proof'); proofHeading.id = 'proofDialogTitle'; const proofSkill = make<HTMLSelectElement>('select'); const proofSkillLabel = make<HTMLLabelElement>('label', 'Skill demonstrated'); proofSkillLabel.append(proofSkill); const proofTitle = make<HTMLInputElement>('input'); proofTitle.required = true; proofTitle.maxLength = 180; const proofTitleLabel = make<HTMLLabelElement>('label', 'Artifact or evidence title'); proofTitleLabel.append(proofTitle); const proofType = make<HTMLSelectElement>('select'); for (const [value, label] of [['repository', 'GitHub repository'], ['deployment', 'Deployed website'], ['demo', 'Demonstration'], ['exercise', 'Exercise'], ['artifact', 'Other artifact']]) proofType.append(new Option(label, value)); const proofTypeLabel = make<HTMLLabelElement>('label', 'Evidence type'); proofTypeLabel.append(proofType); const proofReference = make<HTMLInputElement>('input'); proofReference.type = 'url'; proofReference.placeholder = 'https://…'; const proofReferenceLabel = make<HTMLLabelElement>('label', 'Artifact reference'); proofReferenceLabel.append(proofReference); const proofClaim = make<HTMLTextAreaElement>('textarea'); proofClaim.required = true; proofClaim.rows = 4; proofClaim.maxLength = 4000; proofClaim.placeholder = 'What did this artifact demonstrate?'; const proofClaimLabel = make<HTMLLabelElement>('label', 'Demonstration claim'); proofClaimLabel.append(proofClaim); const proofError = make<HTMLElement>('p'); proofError.setAttribute('role', 'alert'); const proofButtons = make<HTMLElement>('div'); proofButtons.className = 'buttons'; const proofCancel = make<HTMLButtonElement>('button', 'Cancel'); proofCancel.type = 'button'; const proofSave = make<HTMLButtonElement>('button', 'Save skill proof'); proofSave.type = 'submit'; proofSave.className = 'primary'; proofButtons.append(proofCancel, proofSave); proofForm.append(proofHeading, make<HTMLParagraphElement>('p', 'Select one skill and explain why this specific artifact supports it.'), proofSkillLabel, proofTitleLabel, proofTypeLabel, proofReferenceLabel, proofClaimLabel, proofError, proofButtons); proofDialog.append(proofForm); document.body.append(proofDialog);
  const state = { panel, body, create, dialog, form, title: titleInput, description, status, error, save, cancel, artifactDialog, artifactForm, artifactProject: null as string | null, artifactTitle, artifactType, artifactReference, artifactNotes, artifactError, artifactSave, artifactCancel, proofDialog, proofForm, proofProject: null as string | null, proofSkill, proofTitle, proofType, proofReference, proofClaim, proofError, proofSave, proofCancel };
  projectUi = state;
  create.onclick = () => { state.title.value = ''; state.description.value = ''; state.status.value = 'planned'; state.error.textContent = ''; state.dialog.showModal(); state.title.focus(); };
  cancel.onclick = () => closeEditorialDialog(dialog); artifactCancel.onclick = () => closeEditorialDialog(artifactDialog); proofCancel.onclick = () => closeEditorialDialog(proofDialog);
  form.onsubmit = async event => { event.preventDefault(); if (!data || !userId || state.save.disabled) return; state.save.disabled = true; state.error.textContent = ''; try { await data.createProject(state.title.value, crypto.randomUUID(), { description: state.description.value, status: state.status.value as 'planned' | 'active' | 'paused' | 'completed' }); closeEditorialDialog(dialog); await loadProjects(); message('Project saved.'); } catch (caught) { state.error.textContent = safeError(caught).message; } finally { state.save.disabled = false; } };
  artifactForm.onsubmit = async event => { event.preventDefault(); if (!data || !userId || !state.artifactProject || state.artifactSave.disabled) return; state.artifactSave.disabled = true; state.artifactError.textContent = ''; try { await data.addProjectArtifact(state.artifactProject, { title: state.artifactTitle.value, type: state.artifactType.value, url: state.artifactReference.value, notes: state.artifactNotes.value }); closeEditorialDialog(artifactDialog); await loadProjects(); message('Artifact added to the project.'); } catch (caught) { state.artifactError.textContent = safeError(caught).message; } finally { state.artifactSave.disabled = false; } };
  proofForm.onsubmit = async event => { event.preventDefault(); if (!data || !userId || !state.proofProject || state.proofSave.disabled || !state.proofSkill.value) return; state.proofSave.disabled = true; state.proofError.textContent = ''; try { await data.createProjectProof(state.proofProject, state.proofSkill.value, { artifactTitle: state.proofTitle.value, artifactType: state.proofType.value, reference: state.proofReference.value, claim: state.proofClaim.value }); closeEditorialDialog(proofDialog); await loadProjects(); message('Explicit skill proof saved.'); } catch (caught) { state.proofError.textContent = safeError(caught).message; } finally { state.proofSave.disabled = false; } };
  return state;
}
async function loadProjects() {
  if (!data || !userId) return; const ui = ensureProjectsUi(); ui.panel.hidden = false; el('records').hidden = true; el('emptyTitle').hidden = true; el('emptyText').hidden = true; el('loadMore').hidden = true; el('retryData').hidden = true; ui.body.replaceChildren(make<HTMLParagraphElement>('p', 'Loading your workshop…'));
  try {
    const projects = await data.projectWorkspace(); ui.body.replaceChildren();
    if (!projects.length) { ui.body.append(make<HTMLParagraphElement>('p', 'No projects yet. Start a build log, then attach a real artifact when there is something to show.')); return; }
    const matrix = make<HTMLElement>('section'); matrix.className = 'project-proof-matrix'; matrix.append(make<HTMLHeadingElement>('h3', 'Project → skill matrix'));
    const matrixList = make<HTMLUListElement>('ul'); matrixList.className = 'records';
    for (const project of projects) {
      const article = make<HTMLElement>('article'); article.className = 'project-workshop-project'; const title = make<HTMLHeadingElement>('h3', project.title); article.append(title, make<HTMLParagraphElement>('p', `${project.status} · ${project.artifacts.length} artifact${project.artifacts.length === 1 ? '' : 's'}`)); if (project.description) article.append(make<HTMLParagraphElement>('p', project.description)); if (project.status === 'completed') article.append(make<HTMLParagraphElement>('p', 'Project completion is not proof. Add an explicit skill claim and supporting artifact.'));
      const artifactsHeading = make<HTMLHeadingElement>('h4', 'Artifacts'); article.append(artifactsHeading); const artifacts = make<HTMLUListElement>('ul'); for (const artifact of project.artifacts) { const item = make<HTMLLIElement>('li'); item.append(make<HTMLElement>('strong', artifact.title), make<HTMLParagraphElement>('p', artifact.url || 'Evidence reference not provided.')); if (artifact.notes) item.append(make<HTMLParagraphElement>('p', artifact.notes)); artifacts.append(item); } if (!project.artifacts.length) artifacts.append(make<HTMLLIElement>('li', 'No artifacts yet.')); article.append(artifacts);
      const proofHeading = make<HTMLHeadingElement>('h4', 'Skills demonstrated'); article.append(proofHeading); const proofs = make<HTMLUListElement>('ul'); for (const proof of project.proofs) { const item = make<HTMLLIElement>('li'); item.append(make<HTMLElement>('strong', `${proof.skillName} · ${proof.status}`), make<HTMLParagraphElement>('p', proof.explanation)); proofs.append(item); const row = make<HTMLLIElement>('li'); row.append(make<HTMLElement>('strong', project.title), make<HTMLParagraphElement>('p', `${proof.skillName} · ${proof.status}`)); matrixList.append(row); } if (!project.proofs.length) proofs.append(make<HTMLLIElement>('li', 'No skills explicitly attributed to this project.')); article.append(proofs);
      const controls = make<HTMLElement>('div'); controls.className = 'buttons'; const artifact = make<HTMLButtonElement>('button', 'Add artifact'); artifact.type = 'button'; artifact.className = 'secondary'; artifact.onclick = () => { ui.artifactProject = project.id; ui.artifactTitle.value = ''; ui.artifactReference.value = ''; ui.artifactNotes.value = ''; ui.artifactError.textContent = ''; ui.artifactDialog.showModal(); ui.artifactTitle.focus(); }; const proof = make<HTMLButtonElement>('button', 'Add skill proof'); proof.type = 'button'; proof.className = 'secondary'; proof.onclick = async () => { ui.proofProject = project.id; ui.proofError.textContent = ''; ui.proofSkill.replaceChildren(); try { for (const skill of await data.catalogSkillsAll()) ui.proofSkill.append(new Option(skill.name, skill.id)); } catch (caught) { ui.proofError.textContent = safeError(caught).message; return; } ui.proofTitle.value = ''; ui.proofReference.value = ''; ui.proofClaim.value = ''; ui.proofDialog.showModal(); ui.proofSkill.focus(); }; controls.append(artifact, proof); article.append(controls); ui.body.append(article);
    }
    if (!matrixList.childElementCount) matrixList.append(make<HTMLLIElement>('li', 'No project proof claims yet.')); matrix.append(matrixList); ui.body.append(matrix);
  } catch (caught) { ui.body.replaceChildren(make<HTMLParagraphElement>('p', safeError(caught).message)); }
}
async function loadView(append = false) {
  if (!data || !userId || currentView === 'Today') return;
  const view = currentView;
  const definition = views[view];
  if (goalUi) goalUi.detail.hidden = true;
  if (view === 'Weekly review') { await loadReview(); return; }
  if (view === 'Roadmap') { await loadRoadmap(); return; }
  if (view === 'Projects') { await loadProjects(); return; }
  const epoch = ++viewEpoch;
  const identity = userId;
  if (!append) {
    page = 0;
    el('records').replaceChildren();
    el('records').hidden = false;
    el('emptyTitle').hidden = false;
    el('emptyText').hidden = false;
  }
  if (reviewUi) reviewUi.panel.hidden = true;
  if (roadmapUi) roadmapUi.panel.hidden = true;
  if (recommendationUi) recommendationUi.panel.hidden = true;
  if (view === 'Goals') { ensureGoalUi(); selectedGoal = null; }
  el('retryData').hidden = true;
  el('loadMore').hidden = true;
  if (view === 'Intelligence') { await loadRecommendation(); return; }
  if (!definition.table) {
    el('emptyTitle').textContent = definition.empty;
    el('emptyText').textContent = definition.note;
    return;
  }
  dataBusy = true;
  el('records').setAttribute('aria-busy', 'true');
  el('emptyTitle').textContent = 'Loading your records…';
  el('emptyText').textContent = '';
  try {
    const result = view === 'Goals' ? await data.goals(page) : await data.list(definition.table, page);
    if (epoch !== viewEpoch || userId !== identity) return;
    renderRows(result.rows);
    el('emptyTitle').textContent = el('records').childElementCount ? `Your ${view.toLowerCase()}` : definition.empty;
    el('emptyText').textContent = el('records').childElementCount ? 'Showing saved records, newest first.' : definition.note;
    el('loadMore').hidden = !result.hasMore;
  } catch (error) {
    if (epoch !== viewEpoch || userId !== identity) return;
    el('emptyTitle').textContent = 'Records could not be loaded.';
    handleFailure(error, 'emptyText');
    el('retryData').hidden = false;
  } finally {
    if (epoch === viewEpoch) { dataBusy = false; el('records').setAttribute('aria-busy', 'false'); }
  }
}
function renderActions(actions: Row<'actions'>[]) {
  el('todayActions').replaceChildren();
  el('actionsState').textContent = actions.length ? 'Recent saved actions' : 'No actions yet';
  if (!actions.length) {
    for (const [i, title] of ['Must do', 'Should do', 'Optional'].entries()) {
      const row = document.createElement('div'); row.className = 'empty';
      const number = document.createElement('span'); number.className = 'number'; number.textContent = `0${i + 1}`;
      const body = document.createElement('div'); const heading = document.createElement('h3'); heading.textContent = title;
      const note = document.createElement('p'); note.textContent = 'No actions saved in your workspace.';
      body.append(heading, note); row.append(number, body); el('todayActions').append(row);
    }
    return;
  }
  for (const [index, action] of actions.slice(0, 8).entries()) {
    const row = document.createElement('div'); row.className = 'empty';
    const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 1).padStart(2, '0');
    const body = document.createElement('div'); const heading = document.createElement('h3'); heading.textContent = action.title;
    const note = document.createElement('p'); note.textContent = action.status.replaceAll('_', ' ');
    body.append(heading, note); row.append(number, body); el('todayActions').append(row);
  }
}
function renderTodayProgress(summary: Awaited<ReturnType<NonNullable<typeof data>['progressSummary']>>) {
  const quiet = el('today').querySelector<HTMLElement>('.quiet');
  if (!quiet) return;
  quiet.replaceChildren();
  const heading = make<HTMLHeadingElement>('h3', 'Activity so far');
  const copy = make<HTMLParagraphElement>('p', summary.goalCount ? `${summary.completedActionCount} of ${summary.actionCount} actions completed · ${summary.actionsWithEvidenceCount} with evidence · ${summary.activeGoalCount} active goal${summary.activeGoalCount === 1 ? '' : 's'}.` : 'Start with one meaningful goal, then turn it into concrete actions.');
  quiet.append(heading, copy);
}
function ensureFirstJourneyUi() {
  if (firstJourneyPanel) return firstJourneyPanel;
  const host = el('today').querySelector<HTMLElement>('.mission-flow');
  if (!host) throw new Error('Missing Today content host.');
  const panel = make<HTMLElement>('section'); panel.className = 'first-journey'; panel.setAttribute('aria-labelledby', 'firstJourneyTitle');
  const eyebrow = make<HTMLElement>('div', 'I don\'t know what to learn'); eyebrow.className = 'eyebrow';
  const heading = make<HTMLHeadingElement>('h2', 'I don\'t know what to learn'); heading.id = 'firstJourneyTitle';
  const copy = make<HTMLParagraphElement>('p', 'Choose a goal, pick a skill, and SkillOS will map the first useful step for today.');
  const steps = make<HTMLOListElement>('ol'); steps.append(make('li', 'Choose a goal'), make('li', 'Select a skill'), make('li', 'Start on Today'));
  const start = make<HTMLButtonElement>('button', 'Start with a goal'); start.type = 'button'; start.className = 'primary'; start.onclick = () => void openGoalDialog(null, undefined, true);
  panel.append(eyebrow, heading, copy, steps, start); host.prepend(panel); firstJourneyPanel = panel; return panel;
}
function renderFirstJourney(state: Awaited<ReturnType<NonNullable<typeof data>['dailyLearningPlan']>>['entry']) {
  ensureFirstJourneyUi().hidden = !shouldShowFirstTimeJourney(state);
}
function ensureDailyUi() {
  if (dailyUi) return dailyUi;
  const host = el('today').querySelector<HTMLElement>('.mission-flow');
  if (!host) throw new Error('Missing Today content host.');
  const panel = make<HTMLElement>('section'); panel.className = 'daily-plan'; panel.setAttribute('aria-labelledby', 'dailyPlanTitle');
  const heading = make<HTMLHeadingElement>('h2', 'Daily learning'); heading.id = 'dailyPlanTitle';
  const gap = make<HTMLElement>('section'); gap.className = 'skill-gap'; gap.setAttribute('aria-labelledby', 'skillGapTitle');
  const focus = make<HTMLElement>('div'); focus.className = 'daily-focus';
  const goal = make<HTMLElement>('p'); goal.className = 'daily-goal';
  const summary = make<HTMLElement>('p'); summary.className = 'daily-summary'; summary.setAttribute('role', 'status');
  const resources = make<HTMLUListElement>('ul'); resources.className = 'daily-resources'; const items = make<HTMLUListElement>('ul'); items.className = 'daily-items'; const sessions = make<HTMLUListElement>('ul'); sessions.className = 'daily-sessions';
  const form = make<HTMLFormElement>('form'); form.className = 'daily-add'; const title = make<HTMLInputElement>('input'); title.required = true; title.maxLength = 180; title.placeholder = 'Add a learning item for today'; title.setAttribute('aria-label', 'Learning item'); const add = make<HTMLButtonElement>('button', 'Add item'); add.type = 'submit'; add.className = 'secondary'; form.append(title, add);
  const sessionBox = make<HTMLElement>('div'); sessionBox.className = 'daily-session'; const sessionStatus = make<HTMLElement>('p', 'No learning sessions yet today. Start a session when you\'re ready.'); sessionStatus.setAttribute('role', 'status'); const session = make<HTMLButtonElement>('button', 'Start session'); session.type = 'button'; session.className = 'primary'; sessionBox.append(sessionStatus, session);
  const sessionDialog = make<HTMLDialogElement>('dialog'); sessionDialog.setAttribute('aria-labelledby', 'sessionDialogTitle'); const sessionForm = make<HTMLFormElement>('form'); sessionForm.method = 'dialog'; const sessionTitle = make<HTMLHeadingElement>('h2', 'Finish learning session'); sessionTitle.id = 'sessionDialogTitle'; const sessionNotes = make<HTMLTextAreaElement>('textarea'); sessionNotes.rows = 4; sessionNotes.maxLength = 4000; sessionNotes.placeholder = 'What did you learn or complete?'; sessionNotes.setAttribute('aria-label', 'Session notes'); const finish = make<HTMLButtonElement>('button', 'Finish session'); finish.type = 'submit'; finish.className = 'primary'; sessionForm.append(sessionTitle, make<HTMLParagraphElement>('p', 'Add an optional outcome before saving this session.'), sessionNotes, finish); sessionDialog.append(sessionForm); document.body.append(sessionDialog);
  const resourcesHeading = make<HTMLHeadingElement>('h3', 'Resources for this focus'); panel.append(heading, gap, focus, goal, summary, resourcesHeading, resources, items, form, sessionBox, make<HTMLHeadingElement>('h3', 'Today\'s sessions'), sessions); host.append(panel);
  dailyUi = { panel, gap, focus, goal, summary, resources, items, sessions, title, add, session, sessionStatus, sessionDialog, sessionNotes, finish };
  form.onsubmit = event => { event.preventDefault(); void addDailyItem(); };
  session.onclick = () => void startDailySession();
  sessionForm.onsubmit = event => { event.preventDefault(); void finishDailySession(); };
  return dailyUi;
}
function renderDailyPlan(plan: Awaited<ReturnType<NonNullable<typeof data>['dailyLearningPlan']>>) {
  const ui = ensureDailyUi(); ui.items.replaceChildren(); ui.sessions.replaceChildren(); ui.resources.replaceChildren();
  if (!plan.focus) { ui.focus.textContent = plan.roadmap?.progress.complete ? 'Roadmap complete. Choose another skill to continue learning.' : 'No active learning path yet. Create a goal with a target skill to decide what to focus on.'; ui.goal.textContent = ''; ui.title.disabled = true; ui.add.disabled = true; ui.session.disabled = true; ui.items.append(make<HTMLLIElement>('li', 'No current learning focus.')); ui.resources.append(make<HTMLLIElement>('li', 'No resources added for today\'s focus yet.')); ui.sessions.append(make<HTMLLIElement>('li', 'No learning sessions yet today.')); ui.summary.textContent = plan.roadmap?.progress.complete ? 'This path is complete.' : 'No current roadmap skill is available.'; ui.sessionStatus.textContent = 'No learning sessions yet today. Start a session when you\'re ready.'; return; }
  ui.title.disabled = false; ui.add.disabled = false; ui.session.disabled = false; ui.focus.replaceChildren(make<HTMLHeadingElement>('h3', `Current focus · ${plan.focus.name}`), make<HTMLParagraphElement>('p', `${plan.focus.status === 'not_started' ? 'Not started' : plan.focus.status === 'learning' ? 'Learning' : plan.focus.status === 'practicing' ? 'Practicing' : plan.focus.status === 'paused' ? 'Paused' : 'Completed'} · Roadmap step ${plan.focus.step}`)); ui.goal.textContent = plan.focusGoal ? `Goal · ${plan.focusGoal.title}` : 'No goal attached. You can still learn this skill.';
  if (!plan.resources.length) { const empty = make<HTMLLIElement>('li', 'No resources saved for this focus yet.'); const open = make<HTMLButtonElement>('button', 'Add a resource'); open.type = 'button'; open.className = 'inline-link'; open.onclick = () => { pendingSkillId = plan.focus!.id; void navigate('Skills'); }; empty.append(' ', open); ui.resources.append(empty); } else for (const resource of plan.resources as ResourceRow[]) { const item = make<HTMLLIElement>('li'); const body = make<HTMLElement>('span'); body.append(make<HTMLElement>('strong', resource.title), make<HTMLElement>('small', ` · ${resource.provider || resource.source}`)); const open = make<HTMLAnchorElement>('a', 'Open ↗'); open.href = resource.url; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.setAttribute('aria-label', `Open ${resource.title} in a new tab`); const start = make<HTMLButtonElement>('button', 'Start session'); start.type = 'button'; start.onclick = () => void startResourceSession(plan.focus!.id, resource.id); item.append(body, open, start); ui.resources.append(item); }
  for (const action of plan.actions) { const item = make<HTMLLIElement>('li'); item.className = action.status === 'completed' ? 'daily-item-complete' : ''; const toggle = make<HTMLButtonElement>('button', action.status === 'completed' ? `✓ ${action.title} · Completed` : `□ ${action.title}`); toggle.type = 'button'; toggle.className = 'daily-item-toggle'; toggle.onclick = () => void toggleDailyItem(action); const remove = make<HTMLButtonElement>('button', 'Remove'); remove.type = 'button'; remove.className = 'inline-link'; remove.onclick = async () => { if (!data || !window.confirm(`Remove “${action.title}” from today’s plan?`)) return; try { await data.deleteAction(action.id); await refreshToday(); } catch (error) { ui.summary.textContent = safeError(error).message; } }; item.append(toggle, remove); ui.items.append(item); }
  if (!plan.actions.length) ui.items.append(make<HTMLLIElement>('li', 'No learning items yet. Add one when you\'re ready.'));
  if (!plan.sessions.length) ui.sessions.append(make<HTMLLIElement>('li', 'No learning sessions yet today.'));
  else for (const session of plan.sessions) { const item = make<HTMLLIElement>('li', `${session.status === 'completed' ? 'Completed' : 'In progress'} · ${session.duration_minutes || 0} min${session.notes ? ` · ${session.notes}` : ''}`); ui.sessions.append(item); }
  ui.summary.textContent = `Today\'s progress · Plan items ${plan.summary.completedPlanItems} / ${plan.summary.planItems} · Sessions ${plan.summary.sessions} · Learning time ${plan.summary.learningMinutes} min · Evidence ${plan.summary.evidence}`;
  const active = plan.sessions.find(session => session.status === 'active'); ui.session.disabled = false; ui.session.textContent = active ? 'Finish session' : 'Start session'; ui.sessionStatus.textContent = active ? 'Learning session in progress. Finish it when you\'re done.' : plan.summary.sessions ? `${plan.summary.sessions} session${plan.summary.sessions === 1 ? '' : 's'} today.` : 'No learning sessions yet today. Start a session when you\'re ready.'; ui.session.onclick = active ? () => { ui.sessionNotes.value = ''; ui.sessionDialog.showModal(); ui.sessionNotes.focus(); } : () => void startDailySession(); ui.finish.dataset.sessionId = active?.id || '';
}
async function refreshToday() { await loadToday(); }
async function addDailyItem() { if (!data || !dailyUi) return; const plan = await data.dailyLearningPlan(); if (!plan.focus) return; dailyUi.add.disabled = true; try { await data.createAction(plan.focusGoal?.id || null, { title: dailyUi.title.value, type: 'learn', dueAt: new Date().toISOString(), userSkillId: plan.trackedFocusId }); dailyUi.title.value = ''; await refreshToday(); } catch (error) { dailyUi.summary.textContent = safeError(error).message; } finally { dailyUi.add.disabled = false; } }
async function toggleDailyItem(action: Row<'actions'>) { if (!data) return; try { const completing = action.status !== 'completed'; await data.updateAction(action.id, { title: action.title, reason: action.reason, status: completing ? 'completed' : 'todo', dueAt: action.due_at }); if (completing) recordMilestone('first_action_completed'); await refreshToday(); } catch (error) { if (dailyUi) dailyUi.summary.textContent = safeError(error).message; } }
async function startResourceSession(skillId: string, resourceId: string) { if (!data) return; try { await data.startSession(skillId, null, null, resourceId); recordMilestone('first_session_started'); message('Learning session started. Finish it from Today when you are done.'); if (currentView === 'Today') await refreshToday(); } catch (error) { message(safeError(error).message); } }
async function startDailySession() { if (!data || !dailyUi) return; try { const plan = await data.dailyLearningPlan(); if (!plan.focus) return; const action = plan.actions.find(item => item.status !== 'completed' && item.status !== 'cancelled'); await data.startSession(plan.focus.id, plan.focusGoal?.id || null, action?.id || null); recordMilestone('first_session_started'); await refreshToday(); } catch (error) { dailyUi.sessionStatus.textContent = safeError(error).message; } }
async function finishDailySession() { if (!data || !dailyUi) return; const id = dailyUi.finish.dataset.sessionId; if (!id) return; dailyUi.finish.disabled = true; try { await data.finishSession(id, dailyUi.sessionNotes.value); recordMilestone('first_session_completed'); closeEditorialDialog(dailyUi.sessionDialog); if (currentView === 'Intelligence') await loadRecommendation(); else await refreshToday(); } catch (error) { dailyUi.sessionStatus.textContent = safeError(error).message; } finally { dailyUi.finish.disabled = false; } }
async function loadToday() {
  if (!data || !userId) return;
  const dailyUiState = ensureDailyUi();
  dailyUiState.gap.replaceChildren(make<HTMLHeadingElement>('h3', 'Next best step'), make<HTMLParagraphElement>('p', 'Finding the most useful focus from your current plan…'));
  const epoch = ++viewEpoch;
  const identity = userId;
  el('north').textContent = 'Loading goals…';
  el('northNote').textContent = '';
  el('actionsState').textContent = 'Loading actions';
  el('todayActions').replaceChildren();
  // These are stored records, not recommendation outputs.
  const modelRequest = data.personalLearningModel();
  const service = data;
  const results = await Promise.allSettled([data.goals(), data.list('actions'), data.progressSummary(), modelRequest.then(model => service.dailyLearningPlan(new Date(), model)), modelRequest]);
  if (epoch !== viewEpoch || identity !== userId) return;
  const [goals, actions, summary, daily, intelligence] = results;
  if (goals.status === 'fulfilled') {
    const latest = goals.value.rows[0];
    el('north').textContent = latest?.title ?? 'A direction worth pursuing.';
    el('northNote').textContent = latest?.targetSkill ? `Most recently saved goal · Target skill: ${latest.targetSkill.name}` : goals.value.rows.length ? 'Most recently saved goal' : 'Start with one meaningful goal.';
  } else { el('north').textContent = 'Goals could not be loaded.'; handleFailure(goals.reason, 'northNote'); }
  if (!userId) return;
  if (actions.status === 'fulfilled') renderActions(actions.value.rows);
  else { el('actionsState').textContent = 'Actions unavailable'; handleFailure(actions.reason, 'status'); }
  if (goals.status === 'rejected' || actions.status === 'rejected') {
    const retry = document.createElement('button'); retry.textContent = 'Retry Today'; retry.onclick = () => void loadToday(); el('todayActions').append(retry);
  }
  if (summary.status === 'fulfilled') renderTodayProgress(summary.value);
  else handleFailure(summary.reason, 'status');
  if (daily.status === 'fulfilled') { renderFirstJourney(daily.value.entry); renderDailyPlan(daily.value); }
  else if (dailyUi) dailyUi.summary.textContent = safeError(daily.reason).message;
  if (intelligence.status === 'fulfilled') renderLearningIntelligence(dailyUiState.gap, intelligence.value, actOnLearning);
  else dailyUiState.gap.replaceChildren(make<HTMLParagraphElement>('p', safeError(intelligence.reason).message));
}
async function navigate(view: View) {
  if (!userId && !publicPreview) return;
  currentView = view;
  message('');
  window.scrollTo({ top: 0, behavior: 'auto' });
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  el('breadcrumb').textContent = view;
  el('main').dataset.surface = view.toLowerCase().replaceAll(' ', '-');
  el('viewSection').textContent = viewSections[view];
  document.title = `SkillOS — ${view}`;
  el('today').classList.toggle('active', view === 'Today');
  el('other').classList.toggle('active', view !== 'Today');
  const artwork = document.querySelector<HTMLImageElement>('#surfaceArtwork');
  const artworkSource = surfaceArtwork[view];
  if (artwork && artworkSource) {
    artwork.loading = 'eager';
    if (artwork.getAttribute('src') !== artworkSource) artwork.src = artworkSource;
  }
  revealEditorialSurface(el(view === 'Today' ? 'today' : 'other'));
  if (skillUi) skillUi.tools.hidden = view !== 'Skills';
  if (historyUi) historyUi.panel.hidden = view !== 'Learning history';
  if (roadmapUi) roadmapUi.panel.hidden = view !== 'Roadmap';
  if (projectUi) projectUi.panel.hidden = view !== 'Projects';
  if (reviewUi) reviewUi.panel.hidden = view !== 'Weekly review';
  if (goalUi && view !== 'Goals') goalUi.detail.hidden = true;
  if (publicPreview) { renderPublicPreview(view); return; }
  if (view === 'Today') { el('main').focus(); await loadToday(); }
  else {
    el('viewTitle').textContent = view;
    el('viewSubtitle').textContent = views[view].subtitle;
    el('otherGoal').hidden = view !== 'Goals';
    el('viewTitle').focus();
    if (view === 'Skills') { if (pendingSkillId && skillUi) { skillUi.search.value = ''; skillUi.category.value = ''; skillUi.difficulty.value = ''; } await loadSkills(); } else if (view === 'Learning history') { await loadHistory(); } else await loadView();
  }
}
function navigateWithTransition(view: View) {
  const startViewTransition = (document as Document & { startViewTransition?: (update: () => void) => void }).startViewTransition;
  if (startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return new Promise<void>(resolve => {
      startViewTransition.call(document, () => { void navigate(view).finally(resolve); });
    });
  }
  return navigate(view);
}
function closeNavigationLibrary(restoreFocus = false) {
  const library = document.querySelector<HTMLDetailsElement>('.nav-library');
  if (!library?.open) return;
  const finish = () => {
    library.removeAttribute('open');
    library.classList.remove('is-closing');
    if (restoreFocus) library.querySelector('summary')?.focus();
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth > 760) finish();
  else {
    library.classList.add('is-closing');
    window.setTimeout(finish, 180);
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.onclick = () => {
  if (!userId && !publicPreview) return;
  const view = button.dataset.view as View;
  closeNavigationLibrary();
  const url = new URL(location.href); url.searchParams.set('view', view); history.pushState({}, '', url);
  navigateWithTransition(view);
});
window.addEventListener('popstate', () => navigateWithTransition(routeFromUrl()));
const navLibrary = document.querySelector<HTMLDetailsElement>('.nav-library');
navLibrary?.addEventListener('toggle', () => {
  if (navLibrary.open) navLibrary.querySelector<HTMLButtonElement>('.nav-group button')?.focus();
});
navLibrary?.querySelector('summary')?.addEventListener('click', event => {
  if (!navLibrary.open) return;
  event.preventDefault();
  closeNavigationLibrary(true);
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && navLibrary?.open) {
    closeNavigationLibrary(true);
    return;
  }
  const target = event.target as HTMLElement | null;
  if (event.key !== '/' || target?.matches('input, textarea, select, [contenteditable="true"]')) return;
  event.preventDefault();
  const url = new URL(location.href); url.searchParams.set('view', 'Skills'); history.pushState({}, '', url);
  void navigateWithTransition('Skills').then(() => skillUi?.search.focus());
});
el('loadMore').onclick = () => { if (!dataBusy) { page++; void loadView(true); } };
el('retryData').onclick = () => void loadView();
if (!publicPreview) el('date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
document.querySelectorAll<HTMLButtonElement>('[data-goal]').forEach(button => button.onclick = () => {
  if (!userId) return;
  void openGoalDialog();
});
el('cancel').onclick = () => { if (!goalBusy) closeEditorialDialog(dialog); };
dialog.addEventListener('cancel', event => { if (goalBusy) event.preventDefault(); });
el<HTMLFormElement>('goalForm').onsubmit = async event => {
  event.preventDefault();
  if (goalBusy || !data || !userId) return;
  const identity = userId;
  try {
    const title = goalTitle(goalInput.value);
    if (firstTimeJourney && journeyStep === 1) { await runDiscovery(); setJourneyStep(2); goalSkill.focus(); return; }
    if (firstTimeJourney && !goalSkill.value) { el('goalError').textContent = 'Choose a target skill to continue.'; goalSkill.focus(); return; }
    if (!pendingGoal || pendingGoal.title !== title) pendingGoal = { id: crypto.randomUUID(), title };
    goalBusy = true;
    el<HTMLButtonElement>('saveGoal').disabled = true;
    el<HTMLButtonElement>('cancel').disabled = true;
    goalInput.disabled = true;
    el('saveGoal').textContent = 'Saving…';
    el('goalError').textContent = '';
    const input = { targetSkillId: goalSkill.value || null, targetMastery: goalMastery.value || null, deadline: goalDeadlineInput.value || null, status: goalStatusInput.value as 'active' | 'paused' | 'completed' | 'archived' };
    if (editingGoalId) await data.updateGoal(editingGoalId, title, input);
    else { await data.createGoal(title, pendingGoal.id, input); recordMilestone('first_goal_created'); }
    if (identity !== userId) return;
    pendingGoal = null; editingGoalId = null; goalInput.value = ''; const journeyCompleted = firstTimeJourney; firstTimeJourney = false; closeEditorialDialog(dialog);
    if (journeyCompleted) { await navigate('Today'); message('Your first learning plan is ready.'); }
    else if (currentView === 'Goals') await loadView(); else if (currentView === 'Today') await loadToday();
    if (identity === userId && !journeyCompleted) message('Goal saved to your account.');
  } catch (error) {
    if (identity === userId) handleFailure(error, 'goalError');
  } finally {
    goalBusy = false; el<HTMLButtonElement>('saveGoal').disabled = false; el<HTMLButtonElement>('cancel').disabled = false; goalInput.disabled = false; el('saveGoal').textContent = 'Save goal';
  }
};
async function submitAuth(signUp: boolean) {
  if (authBusy || !auth) return;
  const form = el<HTMLFormElement>('authForm');
  if (!form.reportValidity()) return;
  authBusy = true;
  el<HTMLButtonElement>('signIn').disabled = true;
  el<HTMLButtonElement>('signUp').disabled = true;
  el('authError').textContent = '';
  el('authDescription').textContent = signUp ? 'Creating your account…' : 'Signing in…';
  try {
    if (signUp) {
      const result = await auth.signUp(el<HTMLInputElement>('email').value, password.value);
      if (result.confirmationRequired) el('authDescription').textContent = 'Check your email to confirm your account, then sign in. If you already have an account, use Sign in.';
    } else await auth.signIn(el<HTMLInputElement>('email').value, password.value);
    password.value = '';
  } catch (error) {
    el('authDescription').textContent = 'Your workspace has not been opened.';
    el('authError').textContent = safeError(error).message;
  } finally {
    authBusy = false; el<HTMLButtonElement>('signIn').disabled = false; el<HTMLButtonElement>('signUp').disabled = false;
  }
}
el<HTMLFormElement>('authForm').onsubmit = event => { event.preventDefault(); void submitAuth(false); };
el('signUp').onclick = () => void submitAuth(true);
el('signOut').onclick = async () => {
  if (!auth) return;
  el<HTMLButtonElement>('signOut').disabled = true;
  try { await auth.signOut(); authEpoch++; showAuth('You have signed out on this device.'); }
  catch (error) { message(safeError(error).message); }
  finally { el<HTMLButtonElement>('signOut').disabled = false; }
};
el('authRetry').onclick = () => location.reload();
initializeEditorialMotion();
if (publicPreview) {
  void navigate(routeFromUrl());
  document.querySelectorAll<HTMLButtonElement>('button:not([data-view]):not([data-preview-allow])').forEach(button => { button.disabled = true; button.title = 'This is a read-only SkillOS Preview.'; });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([data-preview-allow]), select:not([data-preview-allow]), textarea:not([data-preview-allow])').forEach(control => { control.disabled = true; });
  document.querySelectorAll<HTMLFormElement>('form').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); message('This is a read-only SkillOS Preview.'); }, true));
} else if (!auth) {
  clearPrivateState();
  el('authHeading').textContent = 'Connect your workspace.';
  el('authDescription').textContent = configError || 'Supabase configuration is required. Add the project URL and public publishable key to .env.local, then restart the app.';
  el('authForm').hidden = true;
  el('authRetry').hidden = false;
} else {
  auth.subscribe(session => {
    // Defer outside the SDK lock. This is event-driven, not polling.
    setTimeout(() => void synchronizeAuth(session), 0);
  });
}
