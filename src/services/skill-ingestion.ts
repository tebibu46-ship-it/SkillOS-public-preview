import { ServiceError } from './errors';
import { skillDifficulties, skillRelationshipTypes, type SkillDifficulty, type SkillRelationshipType } from './skills';

const assessmentTypes = ['practice', 'project', 'quiz', 'reflection', 'portfolio', 'mixed'] as const;

export const ingestionStatuses = ['accepted', 'rejected', 'needs_review'] as const;
export type IngestionStatus = typeof ingestionStatuses[number];

export type SkillCandidate = {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  difficulty: SkillDifficulty;
  estimatedMinutes: number;
  tags: string[];
  sourceName: string;
  sourceUrl: string;
  externalId: string;
  assessmentType: 'practice' | 'project' | 'quiz' | 'reflection' | 'portfolio' | 'mixed';
  masteryCriteria: string;
  parentSlug?: string;
  relationships?: Array<{ targetSlug: string; type: SkillRelationshipType }>;
};

export type ExistingSkill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  sourceName?: string | null;
  externalId?: string | null;
};

export type NormalizedSkillCandidate = SkillCandidate & {
  slug: string;
  normalizedName: string;
  normalizedCategory: string;
  importedAt: string;
};

export type QualityAssessment = {
  status: IngestionStatus;
  checks: {
    name: boolean;
    description: boolean;
    taxonomy: boolean;
    provenance: boolean;
    mastery: boolean;
    assessment: boolean;
    relationships: boolean;
  };
  completedChecks: number;
  reason?: string;
};

export type DuplicateMatch = {
  kind: 'exact' | 'source' | 'near';
  existing: ExistingSkill;
  similarity?: number;
};

export type IngestionDecision = {
  candidate: NormalizedSkillCandidate;
  status: IngestionStatus;
  operation: 'insert' | 'update' | 'skip';
  quality: QualityAssessment;
  duplicates: DuplicateMatch[];
  errors: string[];
};

export type ImportReport = {
  candidatesDiscovered: number;
  candidatesNormalized: number;
  candidatesAccepted: number;
  candidatesRejected: number;
  duplicates: number;
  needsReview: number;
  skillsInserted: number;
  skillsUpdated: number;
  relationshipsInserted: number;
  relationshipsRejected: number;
  validationFailures: number;
  sourceFailures: number;
};

export type ImportPlan = {
  decisions: IngestionDecision[];
  batches: IngestionDecision[][];
  report: ImportReport;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function normalizeSkillName(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFKC').replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeTaxonomy(value: string) {
  return value.trim().normalize('NFKC').replace(/\s+/g, ' ');
}

export function skillSlug(value: string) {
  const normalized = normalizeSkillName(value);
  return normalized.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toLocaleLowerCase();
}

export function normalizeSkillCandidate(candidate: SkillCandidate, importedAt: string) : NormalizedSkillCandidate {
  if (!isoDate.test(importedAt)) throw new ServiceError('validation', 'Skill import dates must be ISO timestamps.');
  return {
    ...candidate,
    name: candidate.name.trim().normalize('NFKC').replace(/\s+/g, ' '),
    description: candidate.description.trim().normalize('NFKC').replace(/\s+/g, ' '),
    category: normalizeTaxonomy(candidate.category),
    subcategory: normalizeTaxonomy(candidate.subcategory),
    tags: [...new Set(candidate.tags.map(tag => normalizeSkillName(tag)).filter(Boolean))].sort(),
    sourceName: normalizeTaxonomy(candidate.sourceName),
    sourceUrl: candidate.sourceUrl.trim(),
    externalId: candidate.externalId.trim(),
    masteryCriteria: candidate.masteryCriteria.trim().normalize('NFKC').replace(/\s+/g, ' '),
    slug: skillSlug(candidate.name),
    normalizedName: normalizeSkillName(candidate.name),
    normalizedCategory: normalizeSkillName(candidate.category),
    importedAt,
  };
}

export function validateSkillCandidate(candidate: NormalizedSkillCandidate) {
  const errors: string[] = [];
  if (candidate.name.length < 2 || candidate.name.length > 160) errors.push('name must be between 2 and 160 characters');
  if (!candidate.slug || !slugPattern.test(candidate.slug)) errors.push('name must produce a URL-safe slug');
  if (!candidate.description || candidate.description.length > 2000) errors.push('description is required and must be at most 2,000 characters');
  if (!candidate.category || candidate.category.length > 120 || !candidate.subcategory || candidate.subcategory.length > 120) errors.push('category and subcategory are required and bounded');
  if (!skillDifficulties.includes(candidate.difficulty)) errors.push('difficulty is unsupported');
  if (!Number.isInteger(candidate.estimatedMinutes) || candidate.estimatedMinutes < 1 || candidate.estimatedMinutes > 100000) errors.push('estimated learning time is invalid');
  if (!candidate.sourceName || candidate.sourceName.length > 160 || !/^https:\/\//.test(candidate.sourceUrl) || candidate.sourceUrl.length > 2048 || !candidate.externalId) errors.push('source provenance is incomplete');
  if (!candidate.masteryCriteria || candidate.masteryCriteria.length > 4000) errors.push('mastery criteria are required and bounded');
  if (!assessmentTypes.includes(candidate.assessmentType)) errors.push('assessment type is unsupported');
  if (!isoDate.test(candidate.importedAt)) errors.push('import timestamp is invalid');
  return errors;
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(normalizeSkillName(left).split(' ').filter(Boolean));
  const b = new Set(normalizeSkillName(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(token => b.has(token)).length;
  return intersection / Math.max(a.size, b.size);
}

export function findDuplicateMatches(candidate: NormalizedSkillCandidate, existing: ExistingSkill[]) {
  const matches: DuplicateMatch[] = [];
  for (const skill of existing) {
    const similarity = tokenSimilarity(candidate.name, skill.name);
    const sameCategory = normalizeSkillName(skill.category || '') === candidate.normalizedCategory;
    if (skill.slug === candidate.slug && sameCategory) matches.push({ kind: 'exact', existing: skill, similarity: 1 });
    else if (candidate.sourceName === skill.sourceName && candidate.externalId === skill.externalId) matches.push({ kind: 'source', existing: skill, similarity });
    else if (sameCategory && similarity >= 0.66) matches.push({ kind: 'near', existing: skill, similarity });
  }
  return matches;
}

export function assessSkillQuality(candidate: NormalizedSkillCandidate, hasRelationships = true): QualityAssessment {
  const checks = {
    name: candidate.name.length >= 2 && candidate.name.length <= 160,
    description: candidate.description.length >= 20 && candidate.description.length <= 2000,
    taxonomy: Boolean(candidate.category && candidate.subcategory),
    provenance: Boolean(candidate.sourceName && candidate.sourceUrl && candidate.externalId),
    mastery: candidate.masteryCriteria.length >= 20,
    assessment: Boolean(candidate.assessmentType),
    relationships: hasRelationships,
  };
  const completedChecks = Object.values(checks).filter(Boolean).length;
  const status: IngestionStatus = completedChecks === 7 ? 'accepted' : completedChecks >= 5 ? 'needs_review' : 'rejected';
  return { status, checks, completedChecks, ...(status === 'needs_review' ? { reason: 'Candidate needs editorial review before publication.' } : {}) };
}

export function detectRelationshipCycles(decisions: ReadonlyArray<{ candidate: Pick<NormalizedSkillCandidate, 'slug' | 'relationships'> }>) {
  const graph = new Map<string, string[]>();
  for (const decision of decisions) {
    for (const relationship of decision.candidate.relationships || []) {
      if (relationship.type !== 'prerequisite') continue;
      const edges = graph.get(decision.candidate.slug) || [];
      edges.push(relationship.targetSlug);
      graph.set(decision.candidate.slug, edges);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  const walk = (slug: string, path: string[]) => {
    if (visiting.has(slug)) {
      const index = path.indexOf(slug);
      cycles.push(path.slice(index).concat(slug));
      return;
    }
    if (visited.has(slug)) return;
    visiting.add(slug);
    for (const next of graph.get(slug) || []) walk(next, [...path, slug]);
    visiting.delete(slug);
    visited.add(slug);
  };
  for (const slug of graph.keys()) walk(slug, []);
  return cycles;
}

export function planSkillImport(candidates: SkillCandidate[], existing: ExistingSkill[], importedAt: string, batchSize = 100): ImportPlan {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new ServiceError('validation', 'Import batch size must be between 1 and 500.');
  const normalized = candidates.map(candidate => normalizeSkillCandidate(candidate, importedAt));
  const known = [...existing];
  const decisions: IngestionDecision[] = normalized.map(candidate => {
    const errors = validateSkillCandidate(candidate);
    const duplicates = findDuplicateMatches(candidate, known);
    // An explicit empty list means relationship analysis was completed and no
    // defensible edge was found; an omitted list still needs review.
    const quality = assessSkillQuality(candidate, candidate.relationships !== undefined);
    const blockedByNearDuplicate = duplicates.some(match => match.kind === 'near');
    const rejected = errors.length > 0;
    const status: IngestionStatus = rejected ? 'rejected' : blockedByNearDuplicate ? 'needs_review' : quality.status;
    const exact = duplicates.find(match => match.kind === 'exact' || match.kind === 'source');
    const operation = status === 'accepted' ? exact ? 'update' : 'insert' : 'skip';
    if (!exact && status === 'accepted') known.push({ id: `planned:${candidate.slug}`, name: candidate.name, slug: candidate.slug, category: candidate.category, sourceName: candidate.sourceName, externalId: candidate.externalId });
    return { candidate, status, operation, quality: errors.length ? { ...quality, status: 'rejected', reason: errors.join('; ') } : quality, duplicates, errors };
  });
  const knownSlugs = new Set([...existing.map(skill => skill.slug), ...normalized.map(skill => skill.slug)]);
  for (const decision of decisions) {
    for (const relationship of decision.candidate.relationships || []) {
      if (!skillRelationshipTypes.includes(relationship.type)) decision.errors.push(`unsupported relationship type: ${relationship.type}`);
      if (relationship.targetSlug === decision.candidate.slug) decision.errors.push('relationship cannot target the same skill');
      if (!knownSlugs.has(relationship.targetSlug)) decision.errors.push(`relationship target is unknown: ${relationship.targetSlug}`);
    }
    if (decision.errors.length > 0) {
      decision.status = 'rejected';
      decision.operation = 'skip';
      decision.quality = { ...decision.quality, status: 'rejected', reason: decision.errors.join('; ') };
    }
  }
  const cycles = detectRelationshipCycles(decisions.filter(decision => decision.status === 'accepted'));
  for (const decision of decisions) {
    if (cycles.some(cycle => cycle.includes(decision.candidate.slug))) {
      decision.status = 'rejected';
      decision.operation = 'skip';
      decision.errors.push('prerequisite relationship would create a cycle');
      decision.quality = { ...decision.quality, status: 'rejected', reason: 'Prerequisite cycle detected.' };
    }
  }
  const report: ImportReport = {
    candidatesDiscovered: candidates.length,
    candidatesNormalized: normalized.length,
    candidatesAccepted: decisions.filter(d => d.status === 'accepted').length,
    candidatesRejected: decisions.filter(d => d.status === 'rejected').length,
    duplicates: decisions.filter(d => d.duplicates.length > 0).length,
    needsReview: decisions.filter(d => d.status === 'needs_review').length,
    skillsInserted: decisions.filter(d => d.operation === 'insert').length,
    skillsUpdated: decisions.filter(d => d.operation === 'update').length,
    relationshipsInserted: decisions.filter(d => d.status === 'accepted').reduce((total, d) => total + (d.candidate.relationships?.length || 0), 0),
    relationshipsRejected: decisions.filter(d => d.status !== 'accepted').reduce((total, d) => total + (d.candidate.relationships?.length || 0), 0),
    validationFailures: decisions.filter(d => d.errors.length > 0).length,
    sourceFailures: decisions.filter(d => !d.candidate.sourceName || !/^https:\/\//.test(d.candidate.sourceUrl) || !d.candidate.externalId).length,
  };
  const accepted = decisions.filter(decision => decision.status === 'accepted');
  const batches: IngestionDecision[][] = [];
  for (let index = 0; index < accepted.length; index += batchSize) batches.push(accepted.slice(index, index + batchSize));
  return { decisions, batches, report };
}

export function summarizeImportReport(report: ImportReport) {
  return `discovered ${report.candidatesDiscovered}, accepted ${report.candidatesAccepted}, rejected ${report.candidatesRejected}, needs review ${report.needsReview}, duplicates ${report.duplicates}, batches ${report.skillsInserted + report.skillsUpdated}`;
}
