import type { SkillCandidate } from '../services/skill-ingestion';
import { skillSlug } from '../services/skill-ingestion';

type SkillGroup = Omit<SkillCandidate, 'name' | 'description' | 'masteryCriteria' | 'externalId' | 'relationships'> & {
  names: readonly string[];
};

// Batch A is an editorially curated discovery set. The source link is the
// authoritative documentation family used to validate the concept; the short
// descriptions are SkillOS originals, not copied course text.
const groups: readonly SkillGroup[] = [
  {
    category: 'Technology', subcategory: 'Web platform', difficulty: 'beginner', estimatedMinutes: 180,
    tags: ['web', 'frontend'], sourceName: 'MDN Web Docs', sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web', assessmentType: 'project',
    names: ['HTML Semantics', 'CSS Layout', 'CSS Flexbox', 'CSS Grid', 'Responsive Web Design', 'Web Forms', 'HTML Tables', 'HTML Media', 'Web Accessibility', 'Browser Rendering', 'DOM Manipulation', 'Web Events', 'Fetch API', 'Web Storage', 'Service Workers', 'Web Components', 'Canvas API', 'WebSockets', 'Web Performance', 'Progressive Web Apps', 'Web Security Basics', 'URL and URI Design', 'HTTP Fundamentals', 'Browser Developer Tools', 'Web Internationalization'],
  },
  {
    category: 'Technology', subcategory: 'JavaScript ecosystems', difficulty: 'intermediate', estimatedMinutes: 240,
    tags: ['javascript', 'typescript'], sourceName: 'TypeScript Handbook', sourceUrl: 'https://www.typescriptlang.org/docs/handbook/intro.html', assessmentType: 'practice',
    names: ['JavaScript Syntax', 'JavaScript Functions', 'JavaScript Objects', 'JavaScript Modules', 'JavaScript Promises', 'JavaScript Async Programming', 'JavaScript Error Handling', 'JavaScript Testing', 'JavaScript Package Management', 'TypeScript Types', 'TypeScript Generics', 'TypeScript Utility Types', 'TypeScript Modules', 'TypeScript Compiler Configuration', 'TypeScript Declaration Files', 'TypeScript Narrowing', 'TypeScript Classes', 'TypeScript Decorators', 'TypeScript API Design', 'TypeScript Migration', 'ECMAScript Collections', 'ECMAScript Iterators', 'ECMAScript Regular Expressions', 'JavaScript Runtime Semantics', 'JavaScript Performance'],
  },
  {
    category: 'Technology', subcategory: 'Node.js and services', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['node', 'backend'], sourceName: 'Node.js Documentation', sourceUrl: 'https://nodejs.org/docs/latest/api/', assessmentType: 'project',
    names: ['Node.js Runtime', 'Node.js Modules', 'Node.js File Systems', 'Node.js Streams', 'Node.js HTTP Servers', 'Node.js URL Handling', 'Node.js Process Management', 'Node.js Child Processes', 'Node.js Worker Threads', 'Node.js Diagnostics', 'Node.js Testing', 'Node.js Package Publishing', 'Express Web Services', 'API Middleware', 'Request Validation', 'API Error Handling', 'API Rate Limiting', 'API Pagination', 'API Versioning', 'API Documentation', 'Background Jobs', 'Message Queues', 'Webhooks', 'Event-Driven Services', 'Service Health Checks'],
  },
  {
    category: 'Technology', subcategory: 'Python', difficulty: 'beginner', estimatedMinutes: 300,
    tags: ['python', 'programming'], sourceName: 'Python Documentation', sourceUrl: 'https://docs.python.org/3/tutorial/', assessmentType: 'practice',
    names: ['Python Syntax', 'Python Control Flow', 'Python Functions', 'Python Data Structures', 'Python Modules', 'Python Packages', 'Python Virtual Environments', 'Python Exceptions', 'Python File Handling', 'Python Iterators', 'Python Generators', 'Python Decorators', 'Python Classes', 'Python Dataclasses', 'Python Type Hints', 'Python Testing', 'Python Logging', 'Python Command-Line Tools', 'Python Web Requests', 'Python Asyncio', 'Python Context Managers', 'Python Regular Expressions', 'Python Performance', 'Python Debugging', 'Python Packaging'],
  },
  {
    category: 'Technology', subcategory: 'Data and databases', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['data', 'databases'], sourceName: 'PostgreSQL Documentation', sourceUrl: 'https://www.postgresql.org/docs/current/', assessmentType: 'practice',
    names: ['Relational Data Modeling', 'SQL Queries', 'SQL Joins', 'SQL Aggregations', 'SQL Subqueries', 'SQL Common Table Expressions', 'SQL Window Functions', 'SQL Transactions', 'SQL Constraints', 'SQL Indexes', 'SQL Query Planning', 'PostgreSQL Administration', 'PostgreSQL Roles', 'PostgreSQL Functions', 'PostgreSQL Triggers', 'PostgreSQL JSON', 'PostgreSQL Full-Text Search', 'PostgreSQL Backup and Restore', 'PostgreSQL Performance', 'Database Migrations', 'Database Normalization', 'Database Denormalization', 'Data Quality Checks', 'Data Lineage', 'Data Warehouse Modeling'],
  },
  {
    category: 'Technology', subcategory: 'Cloud platforms', difficulty: 'intermediate', estimatedMinutes: 360,
    tags: ['cloud', 'aws'], sourceName: 'AWS Documentation', sourceUrl: 'https://docs.aws.amazon.com/', assessmentType: 'project',
    names: ['Cloud Computing Fundamentals', 'AWS Identity and Access Management', 'AWS Virtual Private Cloud', 'AWS Elastic Compute Cloud', 'AWS Simple Storage Service', 'AWS Relational Database Service', 'AWS Lambda', 'AWS API Gateway', 'AWS CloudFormation', 'AWS CloudWatch', 'AWS EventBridge', 'AWS Simple Queue Service', 'AWS Simple Notification Service', 'AWS DynamoDB', 'AWS Elastic Container Service', 'AWS Elastic Kubernetes Service', 'AWS CloudFront', 'AWS Route 53', 'AWS Secrets Manager', 'AWS Key Management Service', 'AWS Cost Management', 'AWS Well-Architected Framework', 'AWS Backup', 'AWS Autoscaling', 'AWS Incident Response'],
  },
  {
    category: 'Technology', subcategory: 'Cloud platforms', difficulty: 'intermediate', estimatedMinutes: 360,
    tags: ['cloud', 'platforms'], sourceName: 'Microsoft Learn', sourceUrl: 'https://learn.microsoft.com/en-us/azure/', assessmentType: 'project',
    names: ['Azure Fundamentals', 'Azure Entra ID', 'Azure Virtual Networks', 'Azure Virtual Machines', 'Azure App Service', 'Azure Functions', 'Azure Blob Storage', 'Azure SQL Database', 'Azure Cosmos DB', 'Azure Kubernetes Service', 'Azure Container Apps', 'Azure DevOps', 'Azure Monitor', 'Azure Application Insights', 'Azure Key Vault', 'Azure API Management', 'Azure Service Bus', 'Azure Event Grid', 'Azure Logic Apps', 'Azure Resource Manager', 'Azure Cost Management', 'Azure Well-Architected Framework', 'Azure Backup', 'Azure Front Door', 'Azure Data Factory'],
  },
  {
    category: 'Technology', subcategory: 'Developer tools and delivery', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['devops', 'delivery'], sourceName: 'Kubernetes Documentation', sourceUrl: 'https://kubernetes.io/docs/home/', assessmentType: 'project',
    names: ['Linux Command Line', 'Linux Processes', 'Linux Users and Permissions', 'Linux Networking', 'Shell Scripting', 'Git Version Control', 'Git Branching', 'Git Collaboration', 'Git Hooks', 'GitHub Workflows', 'Docker Images', 'Docker Containers', 'Docker Compose', 'Container Registries', 'Kubernetes Pods', 'Kubernetes Deployments', 'Kubernetes Services', 'Kubernetes Ingress', 'Kubernetes ConfigMaps', 'Kubernetes Secrets', 'Kubernetes Volumes', 'Kubernetes Scheduling', 'Kubernetes Observability', 'Continuous Integration', 'Continuous Delivery'],
  },
  {
    category: 'Technology', subcategory: 'Security', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['security', 'risk'], sourceName: 'OWASP', sourceUrl: 'https://owasp.org/www-project-top-ten/', assessmentType: 'practice',
    names: ['Security Principles', 'Threat Modeling', 'Security Requirements', 'Input Validation', 'Output Encoding', 'Authentication Design', 'Authorization Design', 'Session Security', 'Password Security', 'Multi-Factor Authentication', 'OAuth 2.0', 'OpenID Connect', 'Web Security Testing', 'API Security Testing', 'Cross-Site Scripting Prevention', 'SQL Injection Prevention', 'Cross-Site Request Forgery Prevention', 'Security Headers', 'Content Security Policy', 'Secrets Management', 'Cryptographic Hashing', 'Transport Layer Security', 'Dependency Security', 'Secure Logging', 'Incident Response Fundamentals'],
  },
  {
    category: 'Technology', subcategory: 'AI and machine learning', difficulty: 'advanced', estimatedMinutes: 420,
    tags: ['ai', 'machine-learning'], sourceName: 'scikit-learn User Guide', sourceUrl: 'https://scikit-learn.org/stable/user_guide.html', assessmentType: 'project',
    names: ['Machine Learning Fundamentals', 'Dataset Design', 'Data Preprocessing', 'Feature Engineering', 'Exploratory Data Analysis', 'Supervised Learning', 'Unsupervised Learning', 'Regression Modeling', 'Classification Modeling', 'Clustering', 'Dimensionality Reduction', 'Model Evaluation', 'Cross-Validation', 'Hyperparameter Tuning', 'Model Selection', 'Decision Trees', 'Ensemble Learning', 'Neural Network Fundamentals', 'Deep Learning', 'Natural Language Processing', 'Computer Vision', 'Time Series Forecasting', 'Recommendation Systems', 'Model Explainability', 'Machine Learning Operations'],
  },
  {
    category: 'Technology', subcategory: 'AI applications', difficulty: 'advanced', estimatedMinutes: 360,
    tags: ['ai', 'software'], sourceName: 'OpenAI Platform Documentation', sourceUrl: 'https://platform.openai.com/docs/overview', assessmentType: 'project',
    names: ['AI Product Fundamentals', 'Prompt Design', 'Structured Model Outputs', 'Retrieval-Augmented Generation', 'Embedding Search', 'Vector Database Design', 'Agent Workflow Design', 'Tool-Calling Systems', 'AI Evaluation', 'AI Safety Review', 'AI Cost Management', 'AI Latency Optimization', 'Model Context Design', 'Conversation Design', 'Synthetic Data Review', 'Human-in-the-Loop Systems', 'AI Observability', 'Model Monitoring', 'Data Privacy for AI', 'Responsible AI', 'AI Experiment Design', 'Document Question Answering', 'Text Classification', 'Information Extraction', 'AI Application Security'],
  },
  {
    category: 'Business', subcategory: 'Product management', difficulty: 'beginner', estimatedMinutes: 240,
    tags: ['product', 'strategy'], sourceName: 'Product Development and Management Association', sourceUrl: 'https://www.pdma.org/page/what-is-product-management', assessmentType: 'project',
    names: ['Product Management Fundamentals', 'Problem Framing', 'Customer Discovery', 'User Interviews', 'Jobs To Be Done', 'Market Segmentation', 'Value Proposition Design', 'Product Vision', 'Product Strategy', 'Product Roadmapping', 'Product Requirements', 'Acceptance Criteria', 'Prioritization Frameworks', 'Opportunity Sizing', 'Product Metrics', 'North Star Metrics', 'Experiment Design', 'Usability Testing', 'Product Launch Planning', 'Product Operations', 'Product Analytics', 'Product Risk Management', 'Stakeholder Alignment', 'Product Portfolio Strategy', 'Product Lifecycle Management'],
  },
  {
    category: 'Business', subcategory: 'Sales and CRM', difficulty: 'beginner', estimatedMinutes: 240,
    tags: ['sales', 'crm'], sourceName: 'Salesforce Trailhead', sourceUrl: 'https://trailhead.salesforce.com/content/learn', assessmentType: 'practice',
    names: ['Sales Fundamentals', 'Ideal Customer Profiles', 'Lead Qualification', 'Account Research', 'Sales Prospecting', 'Outbound Emailing', 'Cold Calling', 'Discovery Calls', 'Consultative Selling', 'Value-Based Selling', 'Sales Objection Handling', 'Sales Negotiation', 'Proposal Writing', 'Sales Presentations', 'Pipeline Management', 'CRM Data Hygiene', 'Sales Forecasting', 'Account Planning', 'Territory Planning', 'Customer Handoffs', 'Renewal Conversations', 'Expansion Selling', 'Partner Selling', 'Sales Operations', 'Revenue Operations'],
  },
  {
    category: 'Business', subcategory: 'Marketing', difficulty: 'beginner', estimatedMinutes: 240,
    tags: ['marketing', 'growth'], sourceName: 'HubSpot Academy', sourceUrl: 'https://academy.hubspot.com/courses', assessmentType: 'project',
    names: ['Marketing Fundamentals', 'Audience Research', 'Brand Positioning', 'Content Strategy', 'Editorial Planning', 'Search Engine Optimization', 'Search Intent Analysis', 'Technical SEO', 'Email Marketing', 'Lifecycle Marketing', 'Social Media Strategy', 'Community Marketing', 'Paid Search Fundamentals', 'Paid Social Fundamentals', 'Conversion Rate Optimization', 'Landing Page Optimization', 'Marketing Analytics', 'Attribution Basics', 'Customer Journey Mapping', 'Marketing Automation', 'Lead Nurturing', 'Campaign Planning', 'Marketing Experimentation', 'Marketing Operations', 'Go-To-Market Planning'],
  },
  {
    category: 'Business', subcategory: 'Entrepreneurship and finance', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['business', 'finance'], sourceName: 'U.S. Small Business Administration', sourceUrl: 'https://www.sba.gov/business-guide', assessmentType: 'project',
    names: ['Entrepreneurship Fundamentals', 'Business Model Design', 'Business Plan Writing', 'Customer Problem Validation', 'Competitive Analysis', 'Market Research', 'Pricing Strategy', 'Unit Economics', 'Revenue Model Design', 'Cash Flow Planning', 'Financial Statement Reading', 'Budgeting Fundamentals', 'Financial Forecasting', 'Startup Finance', 'Fundraising Strategy', 'Investor Communication', 'Procurement Fundamentals', 'Vendor Management', 'Contract Fundamentals', 'Business Risk Management', 'Decision Analysis', 'Business Process Mapping', 'Operational Planning', 'Small Business Compliance', 'Business Continuity Planning'],
  },
  {
    category: 'Professional', subcategory: 'Communication and leadership', difficulty: 'beginner', estimatedMinutes: 180,
    tags: ['communication', 'leadership'], sourceName: 'Toastmasters International', sourceUrl: 'https://www.toastmasters.org/resources/public-speaking-tips', assessmentType: 'practice',
    names: ['Written Communication', 'Clear Business Writing', 'Technical Writing', 'Executive Summaries', 'Presentation Structure', 'Public Speaking', 'Storytelling', 'Facilitation', 'Active Listening', 'Difficult Conversations', 'Giving Feedback', 'Receiving Feedback', 'Meeting Design', 'Meeting Facilitation', 'Remote Collaboration', 'Cross-Cultural Communication', 'Negotiation Fundamentals', 'Conflict Resolution', 'Leadership Fundamentals', 'Coaching Conversations', 'Delegation', 'Decision Communication', 'Influencing Without Authority', 'Team Norms', 'Change Communication'],
  },
  {
    category: 'Professional', subcategory: 'Research and productivity', difficulty: 'beginner', estimatedMinutes: 180,
    tags: ['research', 'productivity'], sourceName: 'University of Michigan Library', sourceUrl: 'https://guides.lib.umich.edu/research', assessmentType: 'practice',
    names: ['Research Question Design', 'Source Evaluation', 'Literature Search', 'Evidence Synthesis', 'Note-Taking Systems', 'Citation Management', 'Quantitative Reasoning', 'Qualitative Reasoning', 'Critical Thinking', 'Systems Thinking', 'Root Cause Analysis', 'Decision Framing', 'Time Management', 'Focus Management', 'Task Planning', 'Personal Knowledge Management', 'Information Architecture', 'Documentation Systems', 'Remote Work Practices', 'Prioritization', 'Work Estimation', 'Project Planning', 'Risk Registers', 'Retrospectives', 'Continuous Improvement'],
  },
  {
    category: 'Professional', subcategory: 'Project and operations', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['projects', 'operations'], sourceName: 'Project Management Institute', sourceUrl: 'https://www.pmi.org/learning/library', assessmentType: 'project',
    names: ['Project Management Fundamentals', 'Project Chartering', 'Scope Management', 'Schedule Management', 'Project Estimation', 'Resource Planning', 'Project Budgeting', 'Quality Management', 'Project Risk Management', 'Issue Management', 'Dependency Management', 'Project Governance', 'Agile Fundamentals', 'Scrum Practices', 'Kanban Practices', 'Lean Process Improvement', 'Service Design', 'Service Operations', 'Incident Management', 'Change Management', 'Release Management', 'Operations Metrics', 'Capacity Planning', 'Business Process Improvement', 'Vendor Operations'],
  },
  {
    category: 'Creative', subcategory: 'User experience and interface design', difficulty: 'beginner', estimatedMinutes: 240,
    tags: ['ux', 'design'], sourceName: 'W3C Web Accessibility Initiative', sourceUrl: 'https://www.w3.org/WAI/fundamentals/accessibility-intro/', assessmentType: 'portfolio',
    names: ['User Experience Fundamentals', 'User Research', 'Persona Development', 'Journey Mapping', 'Information Architecture', 'Interaction Design', 'Wireframing', 'Prototyping', 'Usability Heuristics', 'Usability Testing', 'Design Systems', 'Visual Hierarchy', 'Layout Composition', 'Typography for Interfaces', 'Color for Interfaces', 'Form Design', 'Navigation Design', 'Dashboard Design', 'Mobile Interface Design', 'Responsive Interface Design', 'Design Critique', 'Accessibility Design', 'Content Design', 'Service Blueprinting', 'UX Documentation'],
  },
  {
    category: 'Creative', subcategory: 'Brand and visual design', difficulty: 'beginner', estimatedMinutes: 240,
    tags: ['design', 'brand'], sourceName: 'Adobe Learn', sourceUrl: 'https://helpx.adobe.com/learn.html', assessmentType: 'portfolio',
    names: ['Graphic Design Fundamentals', 'Brand Strategy', 'Brand Identity', 'Logo Design', 'Visual Identity Systems', 'Brand Guidelines', 'Typography Fundamentals', 'Type Pairing', 'Color Theory', 'Color Systems', 'Composition', 'Grid Systems', 'Illustration Fundamentals', 'Digital Illustration', 'Icon Design', 'Editorial Design', 'Print Design', 'Presentation Design', 'Infographic Design', 'Photography Fundamentals', 'Photo Composition', 'Image Editing', 'Art Direction', 'Creative Briefs', 'Design Portfolio Development'],
  },
  {
    category: 'Creative', subcategory: 'Motion and 3D', difficulty: 'intermediate', estimatedMinutes: 360,
    tags: ['motion', '3d'], sourceName: 'Blender Manual', sourceUrl: 'https://docs.blender.org/manual/en/latest/', assessmentType: 'portfolio',
    names: ['Motion Design Fundamentals', 'Animation Principles', 'Storyboarding', 'Timing and Spacing', 'Motion Typography', 'Interface Motion', 'Video Editing', 'Video Compositing', 'Sound for Video', 'Color Grading', '3D Modeling', '3D Sculpting', '3D Texturing', '3D Lighting', '3D Camera Work', '3D Rigging', 'Character Animation', 'Motion Graphics', 'Visual Effects', 'Rendering Fundamentals', 'Blender Modeling', 'Blender Animation', 'Blender Compositing', 'Creative Production Planning', 'Motion Portfolio Development'],
  },
  {
    category: 'Specialized', subcategory: 'Health and life sciences', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['science', 'health'], sourceName: 'World Health Organization', sourceUrl: 'https://www.who.int/publications', assessmentType: 'project',
    names: ['Public Health Fundamentals', 'Epidemiology Fundamentals', 'Health Data Literacy', 'Clinical Research Basics', 'Evidence-Based Practice', 'Health Communication', 'Health Policy Analysis', 'Global Health', 'Health Systems', 'Healthcare Quality', 'Patient Safety', 'Health Program Planning', 'Health Risk Communication', 'Biostatistics Fundamentals', 'Research Ethics', 'Laboratory Safety', 'Environmental Health', 'Occupational Health', 'Nutrition Science', 'Mental Health Literacy', 'Infectious Disease Fundamentals', 'Vaccination Program Design', 'Health Equity', 'Community Health Assessment', 'Health Information Privacy'],
  },
  {
    category: 'Specialized', subcategory: 'Science and engineering', difficulty: 'intermediate', estimatedMinutes: 360,
    tags: ['science', 'engineering'], sourceName: 'National Institute of Standards and Technology', sourceUrl: 'https://www.nist.gov/publications', assessmentType: 'project',
    names: ['Scientific Method', 'Experimental Design', 'Measurement Fundamentals', 'Uncertainty Analysis', 'Technical Data Analysis', 'Scientific Visualization', 'Computational Science', 'Engineering Problem Solving', 'Requirements Engineering', 'Systems Engineering', 'Reliability Engineering', 'Safety Engineering', 'Quality Engineering', 'Materials Science', 'Mechanical Design', 'Electrical Fundamentals', 'Control Systems', 'Signal Processing', 'Thermodynamics', 'Fluid Mechanics', 'Structural Analysis', 'Geospatial Analysis', 'Remote Sensing', 'Technical Standards', 'Engineering Documentation'],
  },
  {
    category: 'Specialized', subcategory: 'Operations and logistics', difficulty: 'intermediate', estimatedMinutes: 300,
    tags: ['operations', 'logistics'], sourceName: 'U.S. Department of Transportation', sourceUrl: 'https://www.transportation.gov/research', assessmentType: 'project',
    names: ['Operations Fundamentals', 'Supply Chain Fundamentals', 'Demand Planning', 'Inventory Management', 'Warehouse Operations', 'Procurement Operations', 'Supplier Quality', 'Logistics Planning', 'Transportation Management', 'Fleet Operations', 'Route Planning', 'Last-Mile Delivery', 'Manufacturing Fundamentals', 'Production Planning', 'Process Capability', 'Lean Manufacturing', 'Maintenance Planning', 'Asset Management', 'Safety Management', 'Quality Auditing', 'Service Level Management', 'Operations Research', 'Capacity Optimization', 'Sustainability Operations', 'Emergency Logistics'],
  },
];

const expandedBatchASkills: SkillCandidate[] = groups.flatMap(group => group.names.map(name => ({
  name,
  description: `Build practical capability in ${name.toLocaleLowerCase()} through deliberate practice and a concrete work sample.`,
  category: group.category,
  subcategory: group.subcategory,
  difficulty: group.difficulty,
  estimatedMinutes: group.estimatedMinutes,
  tags: group.tags,
  sourceName: group.sourceName,
  sourceUrl: group.sourceUrl,
  externalId: `batch-a:${skillSlug(name)}`,
  assessmentType: group.assessmentType,
  masteryCriteria: `Can explain the core ideas of ${name.toLocaleLowerCase()} and apply them in an appropriate practical context.`,
  relationships: [],
})));

// A manifest is allowed to draw from overlapping source families, but the
// import payload itself is deterministic and contains one row per slug.
export const batchASkills: SkillCandidate[] = [...new Map(expandedBatchASkills.map(skill => [skillSlug(skill.name), skill])).values()];

export const batchASummary = {
  candidates: batchASkills.length,
  groups: groups.length,
  sources: [...new Set(groups.map(group => group.sourceName))].length,
};
