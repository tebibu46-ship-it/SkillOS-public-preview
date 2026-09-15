import { ServiceError } from './errors';
export function goalTitle(value: string): string {
  const clean = value.trim();
  if (!clean || [...clean].length > 180) throw new ServiceError('validation', 'Enter a goal between 1 and 180 characters.');
  return clean;
}
export function goalSkillId(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)) throw new ServiceError('validation', 'Choose a valid target skill.');
  return clean;
}
export function goalTargetMastery(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const clean = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(clean) || clean < 0 || clean > 100) throw new ServiceError('validation', 'Target mastery must be a whole number from 0 to 100.');
  return clean;
}
export function goalDeadline(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(Date.parse(`${clean}T00:00:00Z`))) throw new ServiceError('validation', 'Choose a valid target date.');
  return clean;
}
export function goalStatus(value: string | null | undefined): 'active' | 'paused' | 'completed' | 'archived' {
  if (value === 'active' || value === 'paused' || value === 'completed' || value === 'archived') return value;
  throw new ServiceError('validation', 'Choose a valid goal status.');
}
export function projectTitle(value: string): string {
  const clean = value.trim();
  if (!clean || [...clean].length > 180) throw new ServiceError('validation', 'Enter a project title between 1 and 180 characters.');
  return clean;
}
export function projectDescription(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if ([...clean].length > 4000) throw new ServiceError('validation', 'Keep the project description under 4,000 characters.');
  return clean;
}
export function projectStatus(value: string | null | undefined): 'planned' | 'active' | 'paused' | 'completed' | 'archived' {
  if (value === 'planned' || value === 'active' || value === 'paused' || value === 'completed' || value === 'archived') return value;
  throw new ServiceError('validation', 'Choose a valid project status.');
}
export type SkillStatus = 'learning' | 'practicing' | 'paused' | 'completed';
export function skillStatus(value: string | null | undefined): SkillStatus {
  if (value === 'learning' || value === 'practicing' || value === 'paused' || value === 'completed') return value;
  throw new ServiceError('validation', 'Choose a valid skill status.');
}
export function sessionNotes(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if ([...clean].length > 4000) throw new ServiceError('validation', 'Keep session notes under 4,000 characters.');
  return clean;
}
export function actionTitle(value: string): string {
  const clean = value.trim();
  if (!clean || [...clean].length > 180) throw new ServiceError('validation', 'Enter an action between 1 and 180 characters.');
  return clean;
}
export function actionStatus(value: string | null | undefined): 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled' {
  if (value === 'todo' || value === 'in_progress' || value === 'paused' || value === 'completed' || value === 'cancelled') return value;
  throw new ServiceError('validation', 'Choose a valid action status.');
}
export function actionDueAt(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if (Number.isNaN(Date.parse(clean))) throw new ServiceError('validation', 'Choose a valid action due date.');
  return new Date(clean).toISOString();
}
export type EvidenceType = 'repository' | 'deployment' | 'screenshot' | 'demo' | 'certificate' | 'writing' | 'exercise' | 'artifact';
export function evidenceTitle(value: string): string {
  const clean = value.trim();
  if (!clean || [...clean].length > 180) throw new ServiceError('validation', 'Enter an evidence title between 1 and 180 characters.');
  return clean;
}
export function evidenceType(value: string | null | undefined): EvidenceType {
  if (value === 'repository' || value === 'deployment' || value === 'screenshot' || value === 'demo' || value === 'certificate' || value === 'writing' || value === 'exercise' || value === 'artifact') return value;
  throw new ServiceError('validation', 'Choose a supported evidence type.');
}
export function evidenceUrl(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  let parsed: URL;
  try { parsed = new URL(clean); } catch { throw new ServiceError('validation', 'Enter a valid http or https evidence link.'); }
  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || clean.length > 2048) throw new ServiceError('validation', 'Enter a valid http or https evidence link.');
  return parsed.href;
}
export function evidenceNotes(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if ([...clean].length > 4000) throw new ServiceError('validation', 'Keep evidence notes under 4,000 characters.');
  return clean;
}
export function evidenceContent(url: string | null, notes: string | null): void {
  if (!url && !notes) throw new ServiceError('validation', 'Add a link or a note so this evidence contains proof.');
}
export function reflectionDate(value: string, label: string): string {
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(Date.parse(`${clean}T00:00:00Z`))) throw new ServiceError('validation', `Choose a valid ${label}.`);
  return clean;
}
export function reflectionText(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return null;
  const clean = value.trim();
  if ([...clean].length > 4000) throw new ServiceError('validation', 'Keep reflection answers under 4,000 characters.');
  return clean;
}
export function reflectionContent(fields: Array<string | null>): void {
  if (!fields.some(Boolean)) throw new ServiceError('validation', 'Write at least one reflection answer before saving.');
}
export function pageBounds(page = 0, size = 25) {
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100) throw new ServiceError('validation', 'Invalid page size.');
  return { from: page * size, to: (page + 1) * size - 1, size };
}
export type ResourceType = 'learn' | 'read' | 'watch' | 'research' | 'build' | 'tool';
export function resourceTitle(value: string): string {
  const clean = value.trim();
  if (!clean || [...clean].length > 180) throw new ServiceError('validation', 'Enter a resource title between 1 and 180 characters.');
  return clean;
}
export function resourceUrl(value: string): string {
  const clean = value.trim();
  let parsed: URL;
  try { parsed = new URL(clean); } catch { throw new ServiceError('validation', 'Enter a valid HTTPS resource URL.'); }
  if (parsed.protocol !== 'https:' || clean.length > 2048) throw new ServiceError('validation', 'Enter a valid HTTPS resource URL.');
  return parsed.href;
}
export function resourceSource(value: string | null | undefined): string {
  const clean = (value || '').trim();
  if ([...clean].length > 120) throw new ServiceError('validation', 'Keep the resource source under 120 characters.');
  return clean;
}
export function resourceProvider(value: string | null | undefined): string {
  const clean = (value || '').trim();
  if ([...clean].length > 120) throw new ServiceError('validation', 'Keep the resource provider under 120 characters.');
  return clean;
}
export function resourceType(value: string | null | undefined): ResourceType {
  if (value === 'learn' || value === 'read' || value === 'watch' || value === 'research' || value === 'build' || value === 'tool') return value;
  throw new ServiceError('validation', 'Choose a supported resource type.');
}
