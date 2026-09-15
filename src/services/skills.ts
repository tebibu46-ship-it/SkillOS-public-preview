import { ServiceError } from './errors';

export const skillDifficulties = ['beginner', 'intermediate', 'advanced'] as const;
export type SkillDifficulty = typeof skillDifficulties[number];
export const skillRelationshipTypes = ['prerequisite', 'related', 'specialization', 'part_of', 'alternative', 'transferable'] as const;
export type SkillRelationshipType = typeof skillRelationshipTypes[number];
export const skillCatalogSorts = ['name_asc', 'name_desc', 'newest'] as const;
export type SkillCatalogSort = typeof skillCatalogSorts[number];

export type SkillCatalogFilters = {
  query?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
};

export type CatalogSkill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  subcategory?: string | null;
  difficulty: SkillDifficulty | null;
  description?: string | null;
  estimated_minutes?: number | null;
  tags?: string[];
  source_name?: string | null;
  source_url?: string | null;
  external_id?: string | null;
  assessment_type?: string | null;
  mastery_criteria?: string | null;
  parent_skill_id?: string | null;
  review_status?: string;
  reviewed_at?: string | null;
  imported_at?: string | null;
  normalized_name?: string;
  catalog_classification?: string;
};

export function skillFilters(filters: { query?: string; category?: string; difficulty?: string } = {}) {
  const query = filters.query?.trim() || '';
  const category = filters.category?.trim() || '';
  const difficulty = filters.difficulty?.trim() || '';
  if ([query, category].some(value => [...value].length > 80)) throw new ServiceError('validation', 'Skill filters are too long.');
  if (difficulty && !skillDifficulties.includes(difficulty as SkillDifficulty)) throw new ServiceError('validation', 'Choose a supported skill difficulty.');
  return { query, category, difficulty: difficulty as SkillDifficulty | '' };
}

export function skillCatalogFilters(filters: SkillCatalogFilters = {}) {
  const query = filters.query?.trim() || '';
  const category = filters.category?.trim() || '';
  const subcategory = filters.subcategory?.trim() || '';
  const difficulty = filters.difficulty?.trim() || '';
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 25;
  const sort = filters.sort?.trim() || 'name_asc';
  if ([query, category, subcategory].some(value => [...value].length > 80)) throw new ServiceError('validation', 'Skill catalog filters are too long.');
  if (difficulty && !skillDifficulties.includes(difficulty as SkillDifficulty)) throw new ServiceError('validation', 'Choose a supported skill difficulty.');
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ServiceError('validation', 'Choose a catalog page between 1 and 100 items.');
  if (!skillCatalogSorts.includes(sort as SkillCatalogSort)) throw new ServiceError('validation', 'Choose a supported skill catalog sort.');
  return { query, category, subcategory, difficulty: difficulty as SkillDifficulty | '', page, pageSize, sort: sort as SkillCatalogSort };
}

export function catalogPageRange(filters: SkillCatalogFilters = {}) {
  const clean = skillCatalogFilters(filters);
  return { ...clean, from: clean.page * clean.pageSize, to: (clean.page + 1) * clean.pageSize };
}
