export type SkillRelationshipType = 'prerequisite' | 'related' | 'specialization' | 'part_of' | 'alternative' | 'transferable';

type RelationshipRef = {
  from: string;
  to: string;
  type: SkillRelationshipType;
};

export type FinalRelationshipDecision = {
  original: RelationshipRef;
  outcome: 'accepted' | 'corrected' | 'rejected';
  final: RelationshipRef | null;
  sourceName: string | null;
  sourceUrl: string | null;
  reason: string;
};

export type AuditedRelationship = RelationshipRef & {
  sourceName: string;
  sourceUrl: string;
  reason: string;
};

export type StandaloneAudit = {
  slug: string;
  disposition: 'enrichment_candidate' | 'legitimate_standalone';
  reason: string;
};

export const finalReviewDate = '2026-09-06T00:00:00.000Z';

export const c25Baseline = {
  totalSkills: 619,
  connectedSkills: 143,
  legitimateStandalone: 476,
  needsReview: 2,
  relationships: {
    prerequisite: 56,
    related: 23,
    specialization: 6,
    part_of: 19,
    alternative: 3,
    transferable: 2,
  },
} as const;

// This is the deterministic review ledger for every edge inherited with
// needs_revision. Rejected rows are intentionally retained here as evidence,
// but are not emitted into the active graph.
export const finalRelationshipReview: readonly FinalRelationshipDecision[] = [
  { original: { from: 'accessibility', to: 'html-css', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'accessibility', to: 'html-css', type: 'prerequisite' }, sourceName: 'W3C Web Accessibility Initiative', sourceUrl: 'https://www.w3.org/WAI/fundamentals/accessibility-intro/', reason: 'Semantic structure and presentational basics materially support accessible interface work.' },
  { original: { from: 'accessibility', to: 'web-development', type: 'part_of' }, outcome: 'accepted', final: { from: 'accessibility', to: 'web-development', type: 'part_of' }, sourceName: 'W3C Web Accessibility Initiative', sourceUrl: 'https://www.w3.org/WAI/fundamentals/accessibility-intro/', reason: 'Accessibility is a genuine component of building for the web.' },
  { original: { from: 'database-design', to: 'sql', type: 'prerequisite' }, outcome: 'corrected', final: { from: 'database-design', to: 'sql', type: 'related' }, sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/ddl.html', reason: 'SQL and data definition are strongly connected, but conceptual database design is not a universal prerequisite chain.' },
  { original: { from: 'database-design', to: 'system-design', type: 'related' }, outcome: 'corrected', final: { from: 'database-design', to: 'system-design', type: 'part_of' }, sourceName: 'SkillOS editorial taxonomy review', sourceUrl: null, reason: 'Database design is a component of system design; the direction and type now express that relationship without creating a roadmap dependency.' },
  { original: { from: 'git', to: 'command-line', type: 'transferable' }, outcome: 'corrected', final: { from: 'git', to: 'command-line', type: 'prerequisite' }, sourceName: 'Git Documentation', sourceUrl: 'https://git-scm.com/docs', reason: 'Command-line fluency materially improves learning and operating Git; the prior transferable direction was backwards.' },
  { original: { from: 'performance', to: 'javascript', type: 'prerequisite' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'The broad software-performance skill is not limited to JavaScript, so this would create a false prerequisite.' },
  { original: { from: 'performance', to: 'testing', type: 'related' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'Generic testing is too broad to be a useful direct relationship for the software-performance skill.' },
  { original: { from: 'postgresql', to: 'database-design', type: 'specialization' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'PostgreSQL is a database platform, not a narrower specialization of database design.' },
  { original: { from: 'postgresql', to: 'sql', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'postgresql', to: 'sql', type: 'prerequisite' }, sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/sql.html', reason: 'PostgreSQL documentation explicitly introduces its SQL language before platform-specific work.' },
  { original: { from: 'react', to: 'html-css', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'react', to: 'html-css', type: 'prerequisite' }, sourceName: 'React Documentation', sourceUrl: 'https://react.dev/learn', reason: 'React components return markup and are styled within web interfaces, making HTML and CSS fundamentals materially useful first.' },
  { original: { from: 'react', to: 'javascript', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'react', to: 'javascript', type: 'prerequisite' }, sourceName: 'React Documentation', sourceUrl: 'https://react.dev/learn', reason: 'React components are JavaScript functions.' },
  { original: { from: 'react', to: 'typescript', type: 'related' }, outcome: 'accepted', final: { from: 'react', to: 'typescript', type: 'related' }, sourceName: 'React Documentation', sourceUrl: 'https://react.dev/learn', reason: 'TypeScript is an optional but meaningful companion for React application work, not a required prerequisite.' },
  { original: { from: 'react', to: 'web-development', type: 'part_of' }, outcome: 'accepted', final: { from: 'react', to: 'web-development', type: 'part_of' }, sourceName: 'React Documentation', sourceUrl: 'https://react.dev/learn', reason: 'React is a web interface framework and therefore a component of web development.' },
  { original: { from: 'security-fundamentals', to: 'command-line', type: 'prerequisite' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'Command-line skill can help practical security work, but it is not a prerequisite for learning security fundamentals.' },
  { original: { from: 'sqlite', to: 'postgresql', type: 'alternative' }, outcome: 'accepted', final: { from: 'sqlite', to: 'postgresql', type: 'alternative' }, sourceName: 'SQLite Documentation', sourceUrl: 'https://www.sqlite.org/about.html', reason: 'SQLite and PostgreSQL are alternative relational database platforms for different deployment needs.' },
  { original: { from: 'supabase', to: 'javascript', type: 'prerequisite' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'Supabase supports more than JavaScript clients, so JavaScript is not a universal prerequisite.' },
  { original: { from: 'supabase', to: 'postgresql', type: 'related' }, outcome: 'accepted', final: { from: 'supabase', to: 'postgresql', type: 'related' }, sourceName: 'Supabase Documentation', sourceUrl: 'https://supabase.com/docs/guides/database/overview', reason: 'Supabase provides a hosted Postgres database and related platform services.' },
  { original: { from: 'supabase', to: 'sql', type: 'prerequisite' }, outcome: 'corrected', final: { from: 'supabase', to: 'sql', type: 'related' }, sourceName: 'Supabase Documentation', sourceUrl: 'https://supabase.com/docs/guides/database/overview', reason: 'SQL materially improves database work in Supabase but is not required for every platform workflow.' },
  { original: { from: 'system-design', to: 'database-design', type: 'prerequisite' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'Database design is often relevant to system design but not a universal first step; the component relationship is represented in the corrected reverse edge.' },
  { original: { from: 'technical-writing', to: 'product-discovery', type: 'related' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'Writing may support discovery outputs, but the two broad skills do not justify a direct catalog edge.' },
  { original: { from: 'testing', to: 'accessibility', type: 'related' }, outcome: 'accepted', final: { from: 'testing', to: 'accessibility', type: 'related' }, sourceName: 'W3C Web Accessibility Initiative', sourceUrl: 'https://www.w3.org/WAI/test-evaluate/', reason: 'Accessibility evaluation is a distinct, meaningful form of software testing without being a prerequisite chain.' },
  { original: { from: 'testing', to: 'javascript', type: 'prerequisite' }, outcome: 'rejected', final: null, sourceName: null, sourceUrl: null, reason: 'Generic testing spans many languages and disciplines, so JavaScript would be a false prerequisite.' },
  { original: { from: 'typescript', to: 'javascript', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'typescript', to: 'javascript', type: 'prerequisite' }, sourceName: 'TypeScript Documentation', sourceUrl: 'https://www.typescriptlang.org/docs/handbook/typescript-from-scratch', reason: 'TypeScript shares JavaScript syntax and runtime behavior; its own documentation recommends JavaScript fundamentals.' },
  { original: { from: 'vue-js', to: 'react', type: 'alternative' }, outcome: 'accepted', final: { from: 'vue-js', to: 'react', type: 'alternative' }, sourceName: 'Vue Documentation', sourceUrl: 'https://vuejs.org/guide/introduction.html', reason: 'Vue and React are reasonable alternative frameworks for building web interfaces.' },
  { original: { from: 'aws-lambda', to: 'cloud-computing-fundamentals', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'aws-lambda', to: 'cloud-computing-fundamentals', type: 'prerequisite' }, sourceName: 'AWS Documentation', sourceUrl: 'https://docs.aws.amazon.com/lambda/latest/dg/concepts-basics.html', reason: 'Lambda is an AWS cloud compute service, so cloud concepts materially support learning it.' },
  { original: { from: 'cross-site-scripting-prevention', to: 'input-validation', type: 'prerequisite' }, outcome: 'corrected', final: { from: 'cross-site-scripting-prevention', to: 'input-validation', type: 'related' }, sourceName: 'OWASP Cheat Sheet Series', sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html', reason: 'Input validation contributes to XSS risk reduction but OWASP does not treat it as the primary XSS defense.' },
  { original: { from: 'css-flexbox', to: 'css-layout', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'css-flexbox', to: 'css-layout', type: 'prerequisite' }, sourceName: 'MDN Web Docs', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox', reason: 'MDN lists familiarity with CSS layout concepts as a Flexbox prerequisite.' },
  { original: { from: 'css-grid', to: 'css-layout', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'css-grid', to: 'css-layout', type: 'prerequisite' }, sourceName: 'MDN Web Docs', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Grids', reason: 'MDN lists familiarity with CSS layout concepts as a Grid prerequisite.' },
  { original: { from: 'discovery-calls', to: 'user-interviews', type: 'transferable' }, outcome: 'accepted', final: { from: 'discovery-calls', to: 'user-interviews', type: 'transferable' }, sourceName: 'SkillOS editorial inference', sourceUrl: null, reason: 'The edge records a bounded transfer of interviewing, listening, and problem-discovery practice across sales and product contexts; it is explicitly editorial rather than an external citation claim.' },
  { original: { from: 'epidemiology-fundamentals', to: 'public-health-fundamentals', type: 'prerequisite' }, outcome: 'corrected', final: { from: 'epidemiology-fundamentals', to: 'public-health-fundamentals', type: 'part_of' }, sourceName: 'World Health Organization', sourceUrl: 'https://www.who.int/health-topics/epidemiology', reason: 'Epidemiology is a core public-health discipline, but public-health fundamentals are not a prerequisite chain for learning it.' },
  { original: { from: 'interaction-design', to: 'user-experience-fundamentals', type: 'part_of' }, outcome: 'accepted', final: { from: 'interaction-design', to: 'user-experience-fundamentals', type: 'part_of' }, sourceName: 'W3C Web Accessibility Initiative', sourceUrl: 'https://www.w3.org/WAI/fundamentals/designing-for-inclusion/', reason: 'Interaction design is a constituent capability within user-experience practice.' },
  { original: { from: 'inventory-management', to: 'supply-chain-fundamentals', type: 'part_of' }, outcome: 'accepted', final: { from: 'inventory-management', to: 'supply-chain-fundamentals', type: 'part_of' }, sourceName: 'SkillOS editorial taxonomy review', sourceUrl: null, reason: 'Inventory management is a component capability of supply-chain operations; this is recorded as an internal taxonomy inference.' },
  { original: { from: 'kubernetes-deployments', to: 'kubernetes-pods', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'kubernetes-deployments', to: 'kubernetes-pods', type: 'prerequisite' }, sourceName: 'Kubernetes Documentation', sourceUrl: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/', reason: 'Deployments manage replica sets of Pods, so Pod concepts come first.' },
  { original: { from: 'model-evaluation', to: 'machine-learning-fundamentals', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'model-evaluation', to: 'machine-learning-fundamentals', type: 'prerequisite' }, sourceName: 'scikit-learn User Guide', sourceUrl: 'https://scikit-learn.org/stable/modules/model_evaluation.html', reason: 'Evaluation is part of machine-learning model development and depends on its basic concepts.' },
  { original: { from: 'motion-design-fundamentals', to: 'animation-principles', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'motion-design-fundamentals', to: 'animation-principles', type: 'prerequisite' }, sourceName: 'Adobe Learn', sourceUrl: 'https://helpx.adobe.com/after-effects/using/animation-basics.html', reason: 'Animation principles materially support motion-design work.' },
  { original: { from: 'node-js-http-servers', to: 'node-js-runtime', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'node-js-http-servers', to: 'node-js-runtime', type: 'prerequisite' }, sourceName: 'Node.js Documentation', sourceUrl: 'https://nodejs.org/api/http.html', reason: 'HTTP server APIs operate within the Node.js runtime.' },
  { original: { from: 'product-roadmapping', to: 'product-strategy', type: 'part_of' }, outcome: 'accepted', final: { from: 'product-roadmapping', to: 'product-strategy', type: 'part_of' }, sourceName: 'Atlassian', sourceUrl: 'https://www.atlassian.com/agile/product-management/product-roadmaps', reason: 'A product roadmap communicates and operationalizes product strategy.' },
  { original: { from: 'responsive-web-design', to: 'css-layout', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'responsive-web-design', to: 'css-layout', type: 'prerequisite' }, sourceName: 'MDN Web Docs', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design', reason: 'MDN lists CSS layout fundamentals as prerequisites and explains responsive layout techniques.' },
  { original: { from: 'retrieval-augmented-generation', to: 'embedding-search', type: 'related' }, outcome: 'accepted', final: { from: 'retrieval-augmented-generation', to: 'embedding-search', type: 'related' }, sourceName: 'OpenAI Platform Documentation', sourceUrl: 'https://platform.openai.com/docs/guides/retrieval', reason: 'Embedding retrieval is a meaningful but not universal component of retrieval-augmented generation.' },
  { original: { from: 'sql-joins', to: 'sql-queries', type: 'prerequisite' }, outcome: 'accepted', final: { from: 'sql-joins', to: 'sql-queries', type: 'prerequisite' }, sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/queries.html', reason: 'Joins are a core SQL query construct.' },
  { original: { from: 'sql-query-planning', to: 'sql-indexes', type: 'related' }, outcome: 'accepted', final: { from: 'sql-query-planning', to: 'sql-indexes', type: 'related' }, sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/indexes.html', reason: 'Indexes and query planning interact, but neither is represented as a universal learning prerequisite.' },
  { original: { from: 'systems-engineering', to: 'engineering-problem-solving', type: 'related' }, outcome: 'accepted', final: { from: 'systems-engineering', to: 'engineering-problem-solving', type: 'related' }, sourceName: 'SkillOS editorial taxonomy review', sourceUrl: null, reason: 'Systems engineering and engineering problem solving are meaningfully connected without creating a directional learning dependency.' },
];

// A bounded second-level audit of high-value standalone candidates. Candidates
// with a defensible edge are represented below in targetedRelationshipEnrichment;
// the remaining reviewed examples stay standalone by design.
export const standaloneAudit: readonly StandaloneAudit[] = [
  { slug: 'web-performance', disposition: 'enrichment_candidate', reason: 'A clear specialization relationship to the reviewed software-performance skill is supported.' },
  { slug: 'api-error-handling', disposition: 'enrichment_candidate', reason: 'HTTP API error semantics are a component of API design.' },
  { slug: 'api-pagination', disposition: 'enrichment_candidate', reason: 'Pagination is a concrete API design capability.' },
  { slug: 'aws-simple-queue-service', disposition: 'enrichment_candidate', reason: 'The service directly implements message-queue concepts.' },
  { slug: 'container-registries', disposition: 'enrichment_candidate', reason: 'Registries store and distribute container images.' },
  { slug: 'content-security-policy', disposition: 'enrichment_candidate', reason: 'CSP is a documented additional defense against XSS.' },
  { slug: 'output-encoding', disposition: 'enrichment_candidate', reason: 'Context-aware output encoding is a core XSS defense.' },
  { slug: 'javascript-testing', disposition: 'enrichment_candidate', reason: 'It is a JavaScript-specific testing practice with a clear language foundation.' },
  { slug: 'javascript-performance', disposition: 'enrichment_candidate', reason: 'It is a JavaScript-specific performance practice with a clear language foundation.' },
  { slug: 'node-js-modules', disposition: 'enrichment_candidate', reason: 'Modules are a Node.js runtime capability.' },
  { slug: 'node-js-streams', disposition: 'enrichment_candidate', reason: 'Streams are a Node.js runtime capability.' },
  { slug: 'node-js-testing', disposition: 'enrichment_candidate', reason: 'The test runner is a Node.js runtime capability.' },
  { slug: 'postgresql-administration', disposition: 'enrichment_candidate', reason: 'Administration is specific to operating PostgreSQL.' },
  { slug: 'postgresql-backup-and-restore', disposition: 'enrichment_candidate', reason: 'Backup and restore are PostgreSQL operational capabilities.' },
  { slug: 'postgresql-full-text-search', disposition: 'enrichment_candidate', reason: 'Full-text search is a PostgreSQL feature set.' },
  { slug: 'postgresql-functions', disposition: 'enrichment_candidate', reason: 'Functions are a PostgreSQL feature set.' },
  { slug: 'postgresql-performance', disposition: 'enrichment_candidate', reason: 'Performance tuning is a PostgreSQL-specific applied specialization.' },
  { slug: 'cash-flow-planning', disposition: 'legitimate_standalone', reason: 'No reviewed catalog edge would improve navigation without inventing a dependency.' },
  { slug: 'conflict-resolution', disposition: 'legitimate_standalone', reason: 'The catalog has adjacent communication skills, but no reviewed directional relationship is necessary.' },
  { slug: 'image-editing', disposition: 'legitimate_standalone', reason: 'It is a self-contained applied craft in the current catalog.' },
  { slug: 'nutrition-science', disposition: 'legitimate_standalone', reason: 'Neighboring health topics do not justify an unreviewed dependency or component edge.' },
  { slug: 'route-planning', disposition: 'legitimate_standalone', reason: 'The operations cluster does not supply a reviewed direct relationship that improves learning order.' },
  { slug: 'information-extraction', disposition: 'legitimate_standalone', reason: 'It may use several AI techniques, but none is a universal prerequisite in this catalog.' },
  { slug: 'web-storage', disposition: 'legitimate_standalone', reason: 'It is a focused browser capability without a necessary direct edge in the reviewed set.' },
  { slug: 'photo-composition', disposition: 'legitimate_standalone', reason: 'It is a self-contained visual practice in the current catalog.' },
];

export const targetedRelationshipEnrichment: readonly AuditedRelationship[] = [
  { from: 'web-performance', to: 'performance', type: 'specialization', sourceName: 'web.dev', sourceUrl: 'https://web.dev/learn/performance/', reason: 'Web performance is a platform-specific specialization of software performance.' },
  { from: 'product-discovery', to: 'product-management-fundamentals', type: 'part_of', sourceName: 'Atlassian', sourceUrl: 'https://www.atlassian.com/agile/product-management/discovery', reason: 'Product discovery is a core product-management activity focused on customer needs and validating ideas.' },
  { from: 'customer-discovery', to: 'product-discovery', type: 'part_of', sourceName: 'Atlassian', sourceUrl: 'https://www.atlassian.com/agile/product-management/discovery', reason: 'Understanding customer needs is a component of product discovery.' },
  { from: 'user-interviews', to: 'product-discovery', type: 'part_of', sourceName: 'Atlassian', sourceUrl: 'https://www.atlassian.com/agile/design/product-design-process-customer-interview', reason: 'Customer interviews provide qualitative input to product discovery.' },
  { from: 'api-error-handling', to: 'rest-apis', type: 'part_of', sourceName: 'IETF', sourceUrl: 'https://www.rfc-editor.org/rfc/rfc9457', reason: 'Problem details define a reusable HTTP API error-response format.' },
  { from: 'api-pagination', to: 'rest-apis', type: 'part_of', sourceName: 'Google API Improvement Proposals', sourceUrl: 'https://google.aip.dev/158', reason: 'Pagination is a documented API collection-design capability.' },
  { from: 'aws-simple-queue-service', to: 'message-queues', type: 'prerequisite', sourceName: 'AWS Documentation', sourceUrl: 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html', reason: 'SQS is a managed message-queue service, so queue concepts come first.' },
  { from: 'container-registries', to: 'docker-images', type: 'prerequisite', sourceName: 'Docker Documentation', sourceUrl: 'https://docs.docker.com/docker-hub/', reason: 'Registries store, manage, and distribute container images.' },
  { from: 'content-security-policy', to: 'cross-site-scripting-prevention', type: 'related', sourceName: 'OWASP Cheat Sheet Series', sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html', reason: 'OWASP describes CSP as an additional XSS defense layer, not a replacement for core defenses.' },
  { from: 'output-encoding', to: 'cross-site-scripting-prevention', type: 'part_of', sourceName: 'OWASP Cheat Sheet Series', sourceUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html', reason: 'Context-aware output encoding is a core XSS prevention technique.' },
  { from: 'javascript-testing', to: 'javascript-syntax', type: 'prerequisite', sourceName: 'MDN Web Docs', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', reason: 'Testing JavaScript behavior requires working with JavaScript programs and syntax.' },
  { from: 'javascript-performance', to: 'javascript-syntax', type: 'prerequisite', sourceName: 'MDN Web Docs', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', reason: 'Performance work begins with reading and changing JavaScript programs.' },
  { from: 'node-js-modules', to: 'node-js-runtime', type: 'prerequisite', sourceName: 'Node.js Documentation', sourceUrl: 'https://nodejs.org/api/modules.html', reason: 'Modules are a runtime capability in Node.js.' },
  { from: 'node-js-streams', to: 'node-js-runtime', type: 'prerequisite', sourceName: 'Node.js Documentation', sourceUrl: 'https://nodejs.org/api/stream.html', reason: 'Streams are a Node.js runtime API.' },
  { from: 'node-js-testing', to: 'node-js-runtime', type: 'prerequisite', sourceName: 'Node.js Documentation', sourceUrl: 'https://nodejs.org/api/test.html', reason: 'The test runner is provided by the Node.js runtime.' },
  { from: 'postgresql-administration', to: 'postgresql', type: 'prerequisite', sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/admin.html', reason: 'Administration operates an existing PostgreSQL installation.' },
  { from: 'postgresql-backup-and-restore', to: 'postgresql', type: 'prerequisite', sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/backup.html', reason: 'Backup and restore are operational PostgreSQL capabilities.' },
  { from: 'postgresql-full-text-search', to: 'postgresql', type: 'specialization', sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/textsearch.html', reason: 'Full-text search is a PostgreSQL feature specialization.' },
  { from: 'postgresql-functions', to: 'postgresql', type: 'specialization', sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/functions.html', reason: 'Functions are a PostgreSQL feature specialization.' },
  { from: 'postgresql-performance', to: 'postgresql', type: 'specialization', sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/performance-tips.html', reason: 'Performance tuning is a PostgreSQL-specific applied specialization.' },
];

export const finalSkillReviews = [
  { slug: 'performance', sourceName: 'web.dev', sourceUrl: 'https://web.dev/learn/performance/', externalId: 'c2.5-final:performance', reason: 'Accepted after replacing its over-broad legacy edges with the precise Web Performance specialization.', catalogClassification: 'enriched' as const },
  { slug: 'product-discovery', sourceName: 'Atlassian', sourceUrl: 'https://www.atlassian.com/agile/product-management/discovery', externalId: 'c2.5-final:product-discovery', reason: 'Accepted with a source-backed product-management hierarchy and customer-discovery context.', catalogClassification: 'enriched' as const },
] as const;

export const catalogSourceOverrides: Readonly<Record<string, { sourceName: string; sourceUrl: string }>> = {
  'git-version-control': { sourceName: 'Git Documentation', sourceUrl: 'https://git-scm.com/docs' },
  'git-branching': { sourceName: 'Git Documentation', sourceUrl: 'https://git-scm.com/book/en/v2/Appendix-C%3A-Git-Commands-Branching-and-Merging' },
  'git-hooks': { sourceName: 'Git Documentation', sourceUrl: 'https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks.html' },
  'github-workflows': { sourceName: 'GitHub Documentation', sourceUrl: 'https://docs.github.com/en/actions' },
};
