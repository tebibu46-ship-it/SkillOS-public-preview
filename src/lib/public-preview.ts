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
