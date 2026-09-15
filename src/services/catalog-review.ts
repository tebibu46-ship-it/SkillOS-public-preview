import type { CatalogRelationshipSnapshot, CatalogSkillSnapshot } from './catalog-quality';

export type ReviewClassification = 'enriched' | 'standalone' | 'needs_review';

export type CatalogReviewReport = {
  connectedSkills: number;
  enrichedSkills: number;
  legitimateStandalone: number;
  needsReview: number;
  duplicateRelationships: number;
  invalidRelationships: number;
  prerequisiteCycles: number;
  contradictions: number;
  provenanceCoverage: number;
  missingTaxonomy: number;
  depth: number;
  roots: number;
  connectedComponents: number;
  nonIsolatedComponents: number;
  foundationSkills: string[];
  clusters: Record<string, number>;
};

export type ReviewSkill = CatalogSkillSnapshot & { catalogClassification?: ReviewClassification | null };

export function classifyCatalogSkill(skill: ReviewSkill, relationships: CatalogRelationshipSnapshot[]): ReviewClassification {
  if (skill.catalogClassification) return skill.catalogClassification;
  if (!skill.category || !skill.subcategory || !skill.sourceName || !skill.sourceUrl) return 'needs_review';
  return relationships.some(link => link.skillId === skill.id || link.prerequisiteId === skill.id) ? 'enriched' : 'standalone';
}

function edgeKey(link: CatalogRelationshipSnapshot) {
  return `${link.skillId}:${link.prerequisiteId}:${link.relationshipType}`;
}

function pairKey(left: string, right: string, type: string) {
  return `${left}:${right}:${type}`;
}

export function auditCatalogRelationships(skills: ReviewSkill[], relationships: CatalogRelationshipSnapshot[]) {
  const known = new Set(skills.map(skill => skill.id));
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  let invalidRelationships = 0;
  for (const link of relationships) {
    const key = edgeKey(link);
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
    if (!known.has(link.skillId) || !known.has(link.prerequisiteId) || link.skillId === link.prerequisiteId) invalidRelationships += 1;
  }
  const contradictoryPairs = new Set<string>();
  const directional = new Set(relationships.map(edgeKey));
  for (const link of relationships) {
    if (['prerequisite', 'specialization', 'part_of'].includes(link.relationshipType)) {
      const reverse = pairKey(link.prerequisiteId, link.skillId, link.relationshipType);
      if (directional.has(reverse)) contradictoryPairs.add([edgeKey(link), reverse].sort().join('|'));
    }
  }
  const graph = new Map<string, string[]>();
  for (const link of relationships.filter(link => link.relationshipType === 'prerequisite')) {
    const edges = graph.get(link.skillId) || [];
    edges.push(link.prerequisiteId);
    graph.set(link.skillId, edges);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleKeys = new Set<string>();
  const walk = (id: string, path: string[]) => {
    if (visiting.has(id)) {
      const index = path.indexOf(id);
      cycleKeys.add(path.slice(index).concat(id).sort().join('|'));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) || []) walk(next, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const skill of skills) walk(skill.id, []);
  const prerequisiteCycles = cycleKeys.size;
  const classifications = new Map(skills.map(skill => [skill.id, classifyCatalogSkill(skill, relationships)]));
  const relatedIds = new Set(relationships.flatMap(link => [link.skillId, link.prerequisiteId]));
  const undirected = new Map<string, Set<string>>();
  for (const skill of skills) undirected.set(skill.id, new Set());
  for (const link of relationships) {
    if (!known.has(link.skillId) || !known.has(link.prerequisiteId) || link.skillId === link.prerequisiteId) continue;
    undirected.get(link.skillId)!.add(link.prerequisiteId);
    undirected.get(link.prerequisiteId)!.add(link.skillId);
  }
  const componentVisited = new Set<string>();
  let connectedComponents = 0;
  let nonIsolatedComponents = 0;
  for (const skill of skills) {
    if (componentVisited.has(skill.id)) continue;
    connectedComponents += 1;
    const stack = [skill.id];
    let size = 0;
    while (stack.length) {
      const id = stack.pop()!;
      if (componentVisited.has(id)) continue;
      componentVisited.add(id);
      size += 1;
      for (const neighbor of undirected.get(id) || []) if (!componentVisited.has(neighbor)) stack.push(neighbor);
    }
    if (size > 1) nonIsolatedComponents += 1;
  }
  const depthMemo = new Map<string, number>();
  const depthOf = (id: string, path = new Set<string>()): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (path.has(id)) return 0;
    const next = graph.get(id) || [];
    const depth = next.length ? 1 + Math.max(...next.map(parent => depthOf(parent, new Set([...path, id])))) : 0;
    depthMemo.set(id, depth);
    return depth;
  };
  const depth = Math.max(0, ...skills.map(skill => depthOf(skill.id)));
  const downstream = new Map<string, number>();
  for (const link of relationships.filter(link => link.relationshipType === 'prerequisite')) downstream.set(link.prerequisiteId, (downstream.get(link.prerequisiteId) || 0) + 1);
  const foundationSkills = [...downstream.entries()].sort((left, right) => right[1] - left[1]).slice(0, 10).map(([id]) => skills.find(skill => skill.id === id)?.name || id);
  const clusters: Record<string, number> = {};
  for (const skill of skills) if (skill.category) clusters[skill.category] = (clusters[skill.category] || 0) + 1;
  return {
    classifications,
    duplicateRelationships: duplicates.size,
    invalidRelationships,
    prerequisiteCycles,
    contradictions: contradictoryPairs.size,
    connectedSkills: relatedIds.size,
    enrichedSkills: [...classifications.values()].filter(value => value === 'enriched').length,
    legitimateStandalone: [...classifications.values()].filter(value => value === 'standalone').length,
    needsReview: [...classifications.values()].filter(value => value === 'needs_review').length,
    provenanceCoverage: skills.filter(skill => Boolean(skill.sourceName && skill.sourceUrl)).length,
    missingTaxonomy: skills.filter(skill => !skill.category || !skill.subcategory).length,
    depth,
    roots: skills.filter(skill => !graph.has(skill.id)).length,
    connectedComponents,
    nonIsolatedComponents,
    foundationSkills,
    clusters,
  };
}

export function reviewReport(skills: ReviewSkill[], relationships: CatalogRelationshipSnapshot[]): CatalogReviewReport {
  const audit = auditCatalogRelationships(skills, relationships);
  return {
    connectedSkills: audit.connectedSkills,
    enrichedSkills: audit.enrichedSkills,
    legitimateStandalone: audit.legitimateStandalone,
    needsReview: audit.needsReview,
    duplicateRelationships: audit.duplicateRelationships,
    invalidRelationships: audit.invalidRelationships,
    prerequisiteCycles: audit.prerequisiteCycles,
    contradictions: audit.contradictions,
    provenanceCoverage: audit.provenanceCoverage,
    missingTaxonomy: audit.missingTaxonomy,
    depth: audit.depth,
    roots: audit.roots,
    connectedComponents: audit.connectedComponents,
    nonIsolatedComponents: audit.nonIsolatedComponents,
    foundationSkills: audit.foundationSkills,
    clusters: audit.clusters,
  };
}
