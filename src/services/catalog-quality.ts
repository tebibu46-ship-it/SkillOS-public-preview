import { detectRelationshipCycles, normalizeSkillName } from './skill-ingestion';

export type CatalogSkillSnapshot = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  difficulty?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  masteryCriteria?: string | null;
  assessmentType?: string | null;
  parentSkillId?: string | null;
  reviewStatus?: string | null;
};

export type CatalogRelationshipSnapshot = {
  skillId: string;
  prerequisiteId: string;
  relationshipType: string;
};

export type CatalogCoverage = {
  totalSkills: number;
  categories: number;
  subcategories: number;
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
  byDifficulty: Record<string, number>;
  withPrerequisites: number;
  withRelatedSkills: number;
  withProvenance: number;
  needingReview: number;
  potentialDuplicates: number;
  orphanSkills: number;
  graphCycles: number;
  missingTaxonomy: number;
};

export type CatalogQuality = {
  name: boolean;
  description: boolean;
  taxonomy: boolean;
  provenance: boolean;
  relationships: boolean;
  masteryCriteria: boolean;
  assessment: boolean;
  completedChecks: number;
  status: 'accepted' | 'needs_review' | 'rejected';
};

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] || 0) + 1;
}

export function assessCatalogQuality(skill: CatalogSkillSnapshot, relationships: CatalogRelationshipSnapshot[]): CatalogQuality {
  const checks = {
    name: skill.name.trim().length >= 2 && skill.name.trim().length <= 160,
    description: Boolean(skill.description && skill.description.trim().length >= 20),
    taxonomy: Boolean(skill.category?.trim() && skill.subcategory?.trim()),
    provenance: Boolean(skill.sourceName?.trim() && skill.sourceUrl?.startsWith('https://')),
    relationships: relationships.some(link => link.skillId === skill.id || link.prerequisiteId === skill.id),
    masteryCriteria: Boolean(skill.masteryCriteria?.trim() && skill.masteryCriteria.trim().length >= 20),
    assessment: Boolean(skill.assessmentType?.trim()),
  };
  const completedChecks = Object.values(checks).filter(Boolean).length;
  return { ...checks, completedChecks, status: completedChecks === 7 ? 'accepted' : completedChecks >= 5 ? 'needs_review' : 'rejected' };
}

export function buildCatalogCoverage(skills: CatalogSkillSnapshot[], relationships: CatalogRelationshipSnapshot[]): CatalogCoverage {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const relationshipIds = new Map<string, Set<string>>();
  const normalizedNames = new Map<string, number>();
  for (const skill of skills) {
    if (skill.category) increment(byCategory, skill.category);
    if (skill.subcategory) increment(bySubcategory, skill.subcategory);
    if (skill.difficulty) increment(byDifficulty, skill.difficulty);
    const key = `${normalizeSkillName(skill.name)}|${normalizeSkillName(skill.category || '')}`;
    normalizedNames.set(key, (normalizedNames.get(key) || 0) + 1);
  }
  for (const link of relationships) {
    if (!relationshipIds.has(link.skillId)) relationshipIds.set(link.skillId, new Set());
    relationshipIds.get(link.skillId)!.add(link.relationshipType);
    if (!relationshipIds.has(link.prerequisiteId)) relationshipIds.set(link.prerequisiteId, new Set());
  }
  const prerequisiteLinks = relationships.filter(link => link.relationshipType === 'prerequisite');
  const relatedLinks = relationships.filter(link => link.relationshipType === 'related');
  const cycleDecisions = skills.map(skill => ({ candidate: { slug: skill.id, relationships: prerequisiteLinks.filter(link => link.skillId === skill.id).map(link => ({ targetSlug: link.prerequisiteId, type: 'prerequisite' as const })) } }));
  const cycles = detectRelationshipCycles(cycleDecisions);
  return {
    totalSkills: skills.length,
    categories: Object.keys(byCategory).length,
    subcategories: Object.keys(bySubcategory).length,
    byCategory,
    bySubcategory,
    byDifficulty,
    withPrerequisites: new Set(prerequisiteLinks.map(link => link.skillId)).size,
    withRelatedSkills: new Set(relatedLinks.map(link => link.skillId)).size,
    withProvenance: skills.filter(skill => skill.sourceName && skill.sourceUrl).length,
    needingReview: skills.filter(skill => ['unreviewed', 'in_review', 'needs_revision'].includes(skill.reviewStatus || '')).length,
    potentialDuplicates: [...normalizedNames.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0),
    orphanSkills: skills.filter(skill => !relationshipIds.has(skill.id) && !skill.parentSkillId).length,
    graphCycles: cycles.length,
    missingTaxonomy: skills.filter(skill => !skill.category || !skill.subcategory).length,
  };
}
