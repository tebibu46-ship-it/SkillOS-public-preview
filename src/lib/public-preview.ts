import {
  publicCatalogCategories,
  publicCatalogMetadata,
  publicCatalogRelationships,
  publicCatalogSearch,
  publicCatalogSkills,
  publicCatalogSubcategories,
  publicRoadmap,
  publicSkill,
  publicSkillRelationships,
} from '../services/public-catalog';
import type { CatalogSkill } from '../services/skills';

export type PreviewView = 'Today' | 'Learning history' | 'Intelligence' | 'Skills' | 'Roadmap' | 'Goals' | 'Projects' | 'Actions' | 'Evidence' | 'Opportunities' | 'Decisions' | 'Weekly review';

type PreviewRecord = { title: string; detail: string; description?: string };

const freeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value as Readonly<T>;
};

export const previewLabel = 'SkillOS Preview';
export const previewNotice = 'Read-only sample content. No account, database, or progress is connected.';

export const previewRecords = freeze<Record<Exclude<PreviewView, 'Today'>, PreviewRecord[]>>({
  'Learning history': [{ title: 'Sample learning session', detail: 'Preview · 35 min · completed sample session', description: 'A demonstration of how completed learning can be presented.' }],
  Intelligence: [{ title: 'Sample learning signal', detail: 'Preview · derived direction', description: 'A read-only example of a source-linked learning insight.' }],
  Skills: [{ title: 'CSV data workflows', detail: 'Preview skill · intermediate · reviewed', description: 'Read structured data, transform it deliberately, and produce a useful artifact.' }, { title: 'Automation foundations', detail: 'Preview skill · beginner · reviewed', description: 'Connect repeatable steps into a dependable workflow.' }],
  Roadmap: [{ title: 'Sample roadmap', detail: 'Preview · prerequisites → practice → proof', description: 'A static route showing how SkillOS can make dependencies visible.' }],
  Goals: [{ title: 'Build a useful data tool', detail: 'Preview goal · sample direction', description: 'Sample goal content; no learner or account is attached.' }],
  Projects: [{ title: 'CSV command-line workshop', detail: 'Preview project · proof-oriented', description: 'A sample project showing how work can connect to evidence.' }],
  Actions: [{ title: 'Write the first parser', detail: 'Preview action · sample next step', description: 'Sample action content; it cannot be completed here.' }],
  Evidence: [{ title: 'Representative output CSV', detail: 'Preview evidence · sample artifact', description: 'Sample proof description; no file is stored or submitted.' }],
  Opportunities: [{ title: 'Opportunity signals', detail: 'Preview empty state', description: 'External opportunity providers are not connected in this preview.' }],
  Decisions: [{ title: 'Choose a focused first artifact', detail: 'Preview decision · sample reasoning', description: 'Sample decision content; nothing is persisted.' }],
  'Weekly review': [{ title: 'Weekly review preview', detail: 'Preview · reflection surface', description: 'A sample reflection surface without personal activity.' }],
});

export function previewRows(view: Exclude<PreviewView, 'Today'>): readonly PreviewRecord[] {
  return previewRecords[view];
}

type PublicAtlasState = {
  section: HTMLElement;
  search: HTMLInputElement;
  category: HTMLSelectElement;
  subcategory: HTMLSelectElement;
  difficulty: HTMLSelectElement;
  status: HTMLElement;
  results: HTMLUListElement;
  pagination: HTMLElement;
  detail: HTMLElement;
};
let publicAtlasState: PublicAtlasState | null = null;
let publicRoadmapSection: HTMLElement | null = null;

const publicNode = <T extends HTMLElement>(tag: string, text = '') => {
  const node = document.createElement(tag) as T;
  if (text) node.textContent = text;
  return node;
};

function openPublicSkill(id: string) {
  const url = new URL(location.href);
  url.searchParams.set('view', 'Skills');
  url.searchParams.set('skill', id);
  history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function publicSkillButton(skill: CatalogSkill, relation = '') {
  const button = publicNode<HTMLButtonElement>('button', relation ? `${skill.name} · ${relation}` : skill.name);
  button.type = 'button';
  button.dataset.previewAllow = 'true';
  button.className = 'inline-link';
  button.onclick = () => openPublicSkill(skill.id);
  return button;
}

function renderPublicSkillDetail(state: PublicAtlasState, skill: CatalogSkill) {
  state.detail.replaceChildren();
  state.detail.hidden = false;
  state.results.hidden = true;
  state.pagination.hidden = true;
  const back = publicNode<HTMLButtonElement>('button', '← Back to atlas'); back.type = 'button'; back.className = 'back-link'; back.dataset.previewAllow = 'true'; back.onclick = () => { const url = new URL(location.href); url.searchParams.delete('skill'); history.pushState({}, '', url); renderPublicAtlas(); };
  state.detail.append(back, publicNode<HTMLElement>('p', 'Public catalog skill'));
  const heading = publicNode<HTMLHeadingElement>('h2', skill.name); state.detail.append(heading);
  state.detail.append(publicNode<HTMLParagraphElement>('p', skill.description || 'No description is available for this catalog skill.'));
  const meta = [skill.category, skill.subcategory, skill.difficulty, skill.estimated_minutes ? `${skill.estimated_minutes} min estimated` : null].filter(Boolean).join(' · ');
  state.detail.append(publicNode<HTMLParagraphElement>('p', meta));
  state.detail.append(publicNode<HTMLParagraphElement>('p', 'Public Preview — learning progress is not stored.'));
  if (skill.source_name) {
    const provenance = publicNode<HTMLParagraphElement>('p', `Source: ${skill.source_name}`);
    if (skill.source_url) { const link = publicNode<HTMLAnchorElement>('a', 'Open source ↗'); link.href = skill.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; provenance.append(' · ', link); }
    state.detail.append(provenance);
  }
  const relationships = publicSkillRelationships(skill.id);
  const prerequisites = relationships.filter(link => link.relationship_type === 'prerequisite' && link.skill_id === skill.id && link.prerequisite).map(link => link.prerequisite!);
  const connected = relationships.filter(link => link.relationship_type !== 'prerequisite' && (link.skill_id === skill.id || link.prerequisite_id === skill.id)).map(link => ({ skill: link.skill_id === skill.id ? link.prerequisite : link.skill, type: link.relationship_type })).filter(item => item.skill);
  const columns = publicNode<HTMLElement>('div'); columns.className = 'skill-detail-grid';
  const listColumn = (title: string, rows: Array<{ skill: CatalogSkill; type?: string }>) => { const section = publicNode<HTMLElement>('section'); section.className = 'knowledge-column'; section.append(publicNode<HTMLHeadingElement>('h3', title)); const list = publicNode<HTMLUListElement>('ul'); list.className = 'records'; if (!rows.length) list.append(publicNode<HTMLLIElement>('li', 'No reviewed connections recorded.')); for (const row of rows) { const item = publicNode<HTMLLIElement>('li'); item.append(publicSkillButton(row.skill, row.type ? row.type.replaceAll('_', ' ') : 'prerequisite')); list.append(item); } section.append(list); return section; };
  columns.append(listColumn('Prerequisites', prerequisites.map(item => ({ skill: item }))), listColumn('Connected skills', connected.map(item => ({ skill: item.skill!, type: item.type }))));
  state.detail.append(columns);
}

function renderPublicAtlas() {
  const host = document.querySelector<HTMLElement>('.wide-empty');
  if (!host) return;
  if (!publicAtlasState) {
    const section = publicNode<HTMLElement>('section'); section.id = 'publicPreviewAtlas'; section.className = 'skill-tools public-preview-atlas';
    const header = publicNode<HTMLElement>('header'); header.className = 'atlas-header'; const copy = publicNode<HTMLElement>('div'); copy.append(publicNode<HTMLElement>('p', 'Knowledge atlas'), publicNode<HTMLHeadingElement>('h2', 'Explore the verified SkillOS catalog')); copy.firstElementChild!.className = 'section-label'; header.append(copy); section.append(header);
    const stats = publicNode<HTMLElement>('div'); stats.className = 'atlas-stats'; for (const [value, label] of [[publicCatalogMetadata.skillsCount, 'skills'], [publicCatalogMetadata.subcategoriesCount, 'subcategories'], [publicCatalogMetadata.relationshipsCount, 'connections']] as const) { const item = publicNode<HTMLElement>('div'); item.className = 'atlas-stat'; item.append(publicNode<HTMLElement>('strong', String(value)), publicNode<HTMLElement>('span', label), publicNode<HTMLElement>('small', 'verified catalog')); stats.append(item); } section.append(stats);
    const controls = publicNode<HTMLElement>('div'); controls.className = 'atlas-search-band';
    const searchLabel = publicNode<HTMLLabelElement>('label', 'Search the catalog'); const search = publicNode<HTMLInputElement>('input'); search.type = 'search'; search.maxLength = 80; search.placeholder = 'Search 619 skills'; search.dataset.previewAllow = 'true'; searchLabel.append(search);
    const category = publicNode<HTMLSelectElement>('select'); category.dataset.previewAllow = 'true'; category.setAttribute('aria-label', 'Category'); category.append(new Option('All categories', '')); for (const value of publicCatalogCategories()) category.append(new Option(value, value));
    const subcategory = publicNode<HTMLSelectElement>('select'); subcategory.dataset.previewAllow = 'true'; subcategory.setAttribute('aria-label', 'Subcategory'); subcategory.append(new Option('All subcategories', '')); for (const value of publicCatalogSubcategories()) subcategory.append(new Option(value, value));
    const difficulty = publicNode<HTMLSelectElement>('select'); difficulty.dataset.previewAllow = 'true'; difficulty.setAttribute('aria-label', 'Difficulty'); for (const [value, label] of [['', 'All levels'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]) difficulty.append(new Option(label, value));
    const clear = publicNode<HTMLButtonElement>('button', 'Clear filters'); clear.type = 'button'; clear.className = 'secondary'; clear.dataset.previewAllow = 'true'; controls.append(searchLabel, category, subcategory, difficulty, clear); section.append(controls);
    const status = publicNode<HTMLElement>('p'); status.setAttribute('role', 'status'); const results = publicNode<HTMLUListElement>('ul'); results.className = 'records'; const pagination = publicNode<HTMLElement>('div'); pagination.className = 'buttons'; const detail = publicNode<HTMLElement>('section'); detail.className = 'skill-detail atlas-detail'; detail.hidden = true; section.append(status, results, pagination, detail); host.prepend(section);
    publicAtlasState = { section, search, category, subcategory, difficulty, status, results, pagination, detail };
    const refresh = () => renderPublicAtlas(); search.oninput = refresh; category.onchange = refresh; subcategory.onchange = refresh; difficulty.onchange = refresh; clear.onclick = () => { search.value = ''; category.value = ''; subcategory.value = ''; difficulty.value = ''; refresh(); };
  }
  const state = publicAtlasState; state.section.hidden = false; state.detail.hidden = true; state.results.hidden = false; state.pagination.hidden = false;
  const result = publicCatalogSearch({ query: state.search.value, category: state.category.value, subcategory: state.subcategory.value, difficulty: state.difficulty.value, page: Number(state.section.dataset.page || '0'), pageSize: 24 });
  state.section.dataset.page = String(result.page); state.status.textContent = `${result.total} matching skill${result.total === 1 ? '' : 's'} · showing ${result.rows.length} · read-only catalog`;
  state.results.replaceChildren(); for (const skill of result.rows) { const item = publicNode<HTMLLIElement>('li'); item.className = 'atlas-card'; const body = publicNode<HTMLElement>('div'); body.className = 'atlas-card-body'; body.append(publicSkillButton(skill), publicNode<HTMLParagraphElement>('p', skill.description || 'Catalog skill')); const meta = publicNode<HTMLElement>('div'); meta.className = 'atlas-card-meta'; for (const value of [skill.category, skill.subcategory, skill.difficulty].filter(Boolean)) meta.append(publicNode('span', String(value))); body.append(meta); item.append(body); state.results.append(item); }
  state.pagination.replaceChildren(); const previous = publicNode<HTMLButtonElement>('button', 'Previous'); previous.type = 'button'; previous.dataset.previewAllow = 'true'; previous.disabled = result.page === 0; previous.onclick = () => { state.section.dataset.page = String(result.page - 1); renderPublicAtlas(); }; const next = publicNode<HTMLButtonElement>('button', 'Next'); next.type = 'button'; next.dataset.previewAllow = 'true'; next.disabled = !result.hasMore; next.onclick = () => { state.section.dataset.page = String(result.page + 1); renderPublicAtlas(); }; state.pagination.append(previous, next);
  const requestedSkill = new URLSearchParams(location.search).get('skill'); const selected = requestedSkill ? publicSkill(requestedSkill) : undefined; if (selected) renderPublicSkillDetail(state, selected);
}

function renderPublicRoadmap() {
  const host = document.querySelector<HTMLElement>('.wide-empty'); if (!host) return;
  if (!publicRoadmapSection) { const section = publicNode<HTMLElement>('section'); section.id = 'publicPreviewRoadmap'; section.className = 'roadmap-panel'; section.append(publicNode<HTMLHeadingElement>('h2', 'Read-only skill roadmap'), publicNode<HTMLParagraphElement>('p', 'Choose a real catalog skill to see its reviewed prerequisite path. Nothing is saved.')); const controls = publicNode<HTMLElement>('div'); controls.className = 'roadmap-controls'; const select = publicNode<HTMLSelectElement>('select'); select.dataset.previewAllow = 'true'; select.setAttribute('aria-label', 'Target skill'); for (const skill of publicCatalogSkills) select.append(new Option(skill.name, skill.id)); const generate = publicNode<HTMLButtonElement>('button', 'Show roadmap'); generate.type = 'button'; generate.className = 'primary'; generate.dataset.previewAllow = 'true'; const status = publicNode<HTMLParagraphElement>('p'); status.setAttribute('role', 'status'); const path = publicNode<HTMLOListElement>('ol'); path.className = 'roadmap-path'; controls.append(select, generate); section.append(controls, status, path); host.prepend(section); publicRoadmapSection = section; const target = publicCatalogRelationships.find(link => link.relationship_type === 'prerequisite')?.skill_id || publicCatalogSkills[0]?.id || ''; select.value = target; generate.onclick = () => { const roadmap = publicRoadmap(select.value); status.textContent = `${roadmap.steps.length} real skill${roadmap.steps.length === 1 ? '' : 's'} in this prerequisite path.`; path.replaceChildren(); for (const step of roadmap.steps) { const item = publicNode<HTMLLIElement>('li'); item.append(publicNode<HTMLElement>('strong', `${String(step.step).padStart(2, '0')} · ${step.name}`), publicNode<HTMLParagraphElement>('p', `${step.category || 'Catalog'} · ${step.difficulty || 'level not set'} · ${step.reason}`)); const open = publicNode<HTMLButtonElement>('button', 'Open skill'); open.type = 'button'; open.dataset.previewAllow = 'true'; open.onclick = () => openPublicSkill(step.id); item.append(open); path.append(item); } }; }
  publicRoadmapSection.hidden = false; const select = publicRoadmapSection.querySelector<HTMLSelectElement>('select'); if (select && !publicRoadmapSection.dataset.initialized) { publicRoadmapSection.dataset.initialized = 'true'; publicRoadmapSection.querySelector<HTMLButtonElement>('button')?.click(); }
}

export function renderPublicPreview(view: PreviewView): void {
  const authPanel = document.getElementById('authPanel');
  const workspace = document.getElementById('workspace');
  if (!authPanel || !workspace) return;
  authPanel.hidden = true;
  workspace.hidden = false;
  const status = document.getElementById('connectionStatus');
  if (status) { status.textContent = previewLabel; status.classList.add('preview-status'); }
  let banner = document.getElementById('previewBanner');
  if (!banner) { banner = document.createElement('div'); banner.id = 'previewBanner'; banner.className = 'preview-banner'; banner.textContent = `${previewLabel} · ${previewNotice}`; document.querySelector('.utility-bar')?.prepend(banner); }
  const records = document.getElementById('records');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyText = document.getElementById('emptyText');
  const otherGoal = document.getElementById('otherGoal') as HTMLButtonElement | null;
  const today = document.getElementById('today');
  const other = document.getElementById('other');
  if (today && other) { today.classList.toggle('active', view === 'Today'); other.classList.toggle('active', view !== 'Today'); }
  if (otherGoal) otherGoal.hidden = true;
  if (publicAtlasState) publicAtlasState.section.hidden = view !== 'Skills';
  if (publicRoadmapSection) publicRoadmapSection.hidden = view !== 'Roadmap';
  if (view === 'Skills') { renderPublicAtlas(); return; }
  if (view === 'Roadmap') { renderPublicRoadmap(); return; }
  if (view === 'Today') {
    const heading = document.getElementById('missionTitle'); if (heading) heading.textContent = 'A sample learning day, made visible.';
    const copy = document.querySelector<HTMLElement>('.hero-copy p:last-of-type'); if (copy) copy.textContent = 'Preview content demonstrates focus, practice, and proof without claiming real learner activity.';
    const actions = document.getElementById('todayActions'); if (actions) { actions.replaceChildren(); for (const [index, item] of ['Choose a sample capability', 'Practice with a small artifact', 'Record proof when work is ready'].entries()) { const card = document.createElement('div'); card.className = 'empty'; card.innerHTML = `<span class="number">${String(index + 1).padStart(2, '0')}</span><div><h3>${item}</h3><p>Preview guidance · read-only</p></div>`; actions.append(card); } }
    return;
  }
  const title = document.getElementById('viewTitle'); if (title) title.textContent = view;
  if (emptyTitle) emptyTitle.textContent = `${view} · Preview`;
  if (emptyText) emptyText.textContent = previewNotice;
  if (records) { records.replaceChildren(); for (const [index, row] of previewRows(view).entries()) { const item = document.createElement('li'); item.className = 'record-row'; item.innerHTML = `<span class="record-marker" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><h3>${row.title}</h3><p>${row.detail}</p>${row.description ? `<p>${row.description}</p>` : ''}`; records.append(item); } }
}
