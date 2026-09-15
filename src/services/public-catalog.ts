import skillsJson from '../data/public-preview/skills.json';
import relationshipsJson from '../data/public-preview/skill-relationships.json';
import metadataJson from '../data/public-preview/catalog-metadata.json';
import type { CatalogSkill, SkillDifficulty, SkillRelationshipType } from './skills';
import { resolveRoadmap, type RoadmapRelationship, type RoadmapResult } from './roadmap';

export type PublicCatalogRelationship = {
  id: string;
  skill_id: string;
  prerequisite_id: string;
  relationship_type: SkillRelationshipType;
  source_name?: string | null;
  source_url?: string | null;
  external_id?: string | null;
  review_status?: string | null;
  review_reason?: string | null;
  reviewed_at?: string | null;
};

export type PublicCatalogFilters = {
  query?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  page?: number;
  pageSize?: number;
};

export const publicCatalogSkills = skillsJson as CatalogSkill[];
export const publicCatalogRelationships = relationshipsJson as PublicCatalogRelationship[];
export const publicCatalogMetadata = metadataJson;

const skillIds = new Set(publicCatalogSkills.map(skill => skill.id));
const byId = new Map(publicCatalogSkills.map(skill => [skill.id, skill]));

if (publicCatalogSkills.length !== publicCatalogMetadata.skillsCount || publicCatalogRelationships.length !== publicCatalogMetadata.relationshipsCount) {
  throw new Error('The public preview catalog metadata does not match its contents.');
}
if (new Set(publicCatalogSkills.map(skill => skill.id)).size !== publicCatalogSkills.length) throw new Error('The public preview catalog contains duplicate skill IDs.');
if (publicCatalogRelationships.some(link => !skillIds.has(link.skill_id) || !skillIds.has(link.prerequisite_id))) throw new Error('The public preview catalog contains a relationship with a missing endpoint.');
if (new Set(publicCatalogRelationships.map(link => `${link.skill_id}:${link.prerequisite_id}:${link.relationship_type}`)).size !== publicCatalogRelationships.length) throw new Error('The public preview catalog contains duplicate relationships.');

function compareSkills(left: CatalogSkill, right: CatalogSkill) {
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function publicCatalogSearch(filters: PublicCatalogFilters = {}) {
  const query = filters.query?.trim().toLocaleLowerCase() || '';
  const category = filters.category?.trim() || '';
  const subcategory = filters.subcategory?.trim() || '';
  const difficulty = filters.difficulty?.trim() || '';
  const page = Number.isInteger(filters.page) && (filters.page || 0) >= 0 ? filters.page || 0 : 0;
  const pageSize = Number.isInteger(filters.pageSize) && (filters.pageSize || 0) > 0 ? Math.min(filters.pageSize || 24, 100) : 24;
  const filtered = publicCatalogSkills.filter(skill => {
    if (category && skill.category !== category) return false;
    if (subcategory && skill.subcategory !== subcategory) return false;
    if (difficulty && skill.difficulty !== difficulty) return false;
    if (!query) return true;
    const haystack = [skill.name, skill.slug, skill.description, skill.category, skill.subcategory, ...(skill.tags || [])].filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  }).sort(compareSkills);
  const from = page * pageSize;
  return { rows: filtered.slice(from, from + pageSize), total: filtered.length, page, pageSize, hasMore: from + pageSize < filtered.length };
}

export function publicSkill(id: string) {
  return byId.get(id);
}

export function publicSkillRelationships(id: string) {
  return publicCatalogRelationships.filter(link => link.skill_id === id || link.prerequisite_id === id).map(link => ({
    ...link,
    skill: byId.get(link.skill_id),
    prerequisite: byId.get(link.prerequisite_id),
  }));
}

export function publicRoadmap(targetId: string): RoadmapResult {
  const skills = publicCatalogSkills.map(skill => ({ id: skill.id, name: skill.name, category: skill.category, difficulty: skill.difficulty }));
  const relationships = publicCatalogRelationships.map(link => ({ skill_id: link.skill_id, prerequisite_id: link.prerequisite_id, relationship_type: link.relationship_type })) as RoadmapRelationship[];
  return resolveRoadmap(targetId, skills, relationships);
}

export function publicCatalogCategories() {
  return [...new Set(publicCatalogSkills.map(skill => skill.category).filter((value): value is string => !!value))].sort();
}

export function publicCatalogSubcategories() {
  return [...new Set(publicCatalogSkills.map(skill => skill.subcategory).filter((value): value is string => !!value))].sort();
}

export function publicCatalogDifficulty(value: string | null | undefined): value is SkillDifficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}
