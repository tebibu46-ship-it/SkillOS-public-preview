// Mirrors the foundation migration. Regenerate from Supabase after remote application.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export interface Database {
 public: {
 Tables: {
  profiles: {
   Row: {
    id: string;
    user_id: string;
    display_name: string | null;
    timezone: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    display_name?: string | null;
    timezone?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    display_name?: string | null;
    timezone?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  skills: {
   Row: {
    id: string;
    name: string;
    slug: string;
    category: string | null;
    subcategory: string | null;
    description: string | null;
    difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
    estimated_minutes: number | null;
    tags: string[];
    source_name: string | null;
    source_url: string | null;
    external_id: string | null;
    assessment_type: 'practice' | 'project' | 'quiz' | 'reflection' | 'portfolio' | 'mixed' | null;
    mastery_criteria: string | null;
    parent_skill_id: string | null;
    review_status: 'unreviewed' | 'in_review' | 'reviewed' | 'needs_revision';
    reviewed_at: string | null;
    imported_at: string | null;
    normalized_name: string;
    catalog_classification: 'enriched' | 'standalone' | 'needs_review';
    search_vector: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    name: string;
    slug?: string;
    category?: string | null;
    subcategory?: string | null;
    description?: string | null;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
    estimated_minutes?: number | null;
    tags?: string[];
    source_name?: string | null;
    source_url?: string | null;
    external_id?: string | null;
    assessment_type?: 'practice' | 'project' | 'quiz' | 'reflection' | 'portfolio' | 'mixed' | null;
    mastery_criteria?: string | null;
    parent_skill_id?: string | null;
    review_status?: 'unreviewed' | 'in_review' | 'reviewed' | 'needs_revision';
    reviewed_at?: string | null;
    imported_at?: string | null;
    normalized_name?: string;
    catalog_classification?: 'enriched' | 'standalone' | 'needs_review';
    search_vector?: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    name?: string;
    slug?: string;
    category?: string | null;
    subcategory?: string | null;
    description?: string | null;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | null;
    estimated_minutes?: number | null;
    tags?: string[];
    source_name?: string | null;
    source_url?: string | null;
    external_id?: string | null;
    assessment_type?: 'practice' | 'project' | 'quiz' | 'reflection' | 'portfolio' | 'mixed' | null;
    mastery_criteria?: string | null;
    parent_skill_id?: string | null;
    review_status?: 'unreviewed' | 'in_review' | 'reviewed' | 'needs_revision';
    reviewed_at?: string | null;
    imported_at?: string | null;
    normalized_name?: string;
    catalog_classification?: 'enriched' | 'standalone' | 'needs_review';
    search_vector?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  user_skills: {
   Row: {
    id: string;
    user_id: string;
    skill_id: string;
    target_mastery: number | null;
    status: 'learning' | 'practicing' | 'paused' | 'completed';
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    skill_id: string;
    target_mastery?: number | null;
    status?: 'learning' | 'practicing' | 'paused' | 'completed';
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    skill_id?: string;
    target_mastery?: number | null;
    status?: 'learning' | 'practicing' | 'paused' | 'completed';
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  skill_relationships: {
   Row: {
    id: string;
    skill_id: string;
    prerequisite_id: string;
    relationship_type: 'prerequisite' | 'related' | 'specialization' | 'part_of' | 'alternative' | 'transferable';
    source_name: string | null;
    source_url: string | null;
    external_id: string | null;
    review_status: 'in_review' | 'reviewed' | 'needs_revision';
    review_reason: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    skill_id: string;
    prerequisite_id: string;
    relationship_type?: 'prerequisite' | 'related' | 'specialization' | 'part_of' | 'alternative' | 'transferable';
    source_name?: string | null;
    source_url?: string | null;
    external_id?: string | null;
    review_status?: 'in_review' | 'reviewed' | 'needs_revision';
    review_reason?: string | null;
    reviewed_at?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    skill_id?: string;
    prerequisite_id?: string;
    relationship_type?: 'prerequisite' | 'related' | 'specialization' | 'part_of' | 'alternative' | 'transferable';
    source_name?: string | null;
    source_url?: string | null;
    external_id?: string | null;
    review_status?: 'in_review' | 'reviewed' | 'needs_revision';
    review_reason?: string | null;
    reviewed_at?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  goals: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    deadline: string | null;
    target_skill_id: string | null;
    target_mastery: number | null;
    status: 'active' | 'paused' | 'completed' | 'archived';
    priority: number;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    description?: string | null;
    deadline?: string | null;
    target_skill_id?: string | null;
    target_mastery?: number | null;
    status?: 'active' | 'paused' | 'completed' | 'archived';
    priority?: number;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    description?: string | null;
    deadline?: string | null;
    target_skill_id?: string | null;
    target_mastery?: number | null;
    status?: 'active' | 'paused' | 'completed' | 'archived';
    priority?: number;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  goal_skills: {
   Row: {
    id: string;
    user_id: string;
    goal_id: string;
    skill_id: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    goal_id: string;
    skill_id: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    goal_id?: string;
    skill_id?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  projects: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    goal_id: string | null;
    status: 'planned' | 'active' | 'paused' | 'completed' | 'archived';
    mvp: string | null;
    success_metric: string | null;
    estimated_minutes: number | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    description?: string | null;
    goal_id?: string | null;
    status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived';
    mvp?: string | null;
    success_metric?: string | null;
    estimated_minutes?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    description?: string | null;
    goal_id?: string | null;
    status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived';
    mvp?: string | null;
    success_metric?: string | null;
    estimated_minutes?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  project_skills: {
   Row: {
    id: string;
    user_id: string;
    project_id: string;
    skill_id: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    project_id: string;
    skill_id: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    project_id?: string;
    skill_id?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  opportunities: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    url: string;
    source: string;
    provider: string;
    requirements: string | null;
    deadline: string | null;
    discovered_at: string;
    status: 'discovered' | 'tracking' | 'learning' | 'preparing' | 'applying' | 'submitted' | 'active' | 'rejected' | 'accepted' | 'archived';
    confidence: number | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    url: string;
    source: string;
    provider: string;
    requirements?: string | null;
    deadline?: string | null;
    discovered_at?: string;
    status?: 'discovered' | 'tracking' | 'learning' | 'preparing' | 'applying' | 'submitted' | 'active' | 'rejected' | 'accepted' | 'archived';
    confidence?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    url?: string;
    source?: string;
    provider?: string;
    requirements?: string | null;
    deadline?: string | null;
    discovered_at?: string;
    status?: 'discovered' | 'tracking' | 'learning' | 'preparing' | 'applying' | 'submitted' | 'active' | 'rejected' | 'accepted' | 'archived';
    confidence?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  opportunity_skills: {
   Row: {
    id: string;
    user_id: string;
    opportunity_id: string;
    skill_id: string;
    requirement: string | null;
    target_mastery: number | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    opportunity_id: string;
    skill_id: string;
    requirement?: string | null;
    target_mastery?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    opportunity_id?: string;
    skill_id?: string;
    requirement?: string | null;
    target_mastery?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  project_opportunities: {
   Row: {
    id: string;
    user_id: string;
    project_id: string;
    opportunity_id: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    project_id: string;
    opportunity_id: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    project_id?: string;
    opportunity_id?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  actions: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    type: 'learn' | 'practice' | 'build' | 'research' | 'apply' | 'prepare' | 'create' | 'review' | 'network' | 'evidence';
    status: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
    reason: string | null;
    priority: number;
    estimated_minutes: number | null;
    due_at: string | null;
    completed_at: string | null;
    source: string;
    goal_id: string | null;
    user_skill_id: string | null;
    project_id: string | null;
    opportunity_id: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    type?: 'learn' | 'practice' | 'build' | 'research' | 'apply' | 'prepare' | 'create' | 'review' | 'network' | 'evidence';
    status?: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
    reason?: string | null;
    priority?: number;
    estimated_minutes?: number | null;
    due_at?: string | null;
    completed_at?: string | null;
    source?: string;
    goal_id?: string | null;
    user_skill_id?: string | null;
    project_id?: string | null;
    opportunity_id?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    type?: 'learn' | 'practice' | 'build' | 'research' | 'apply' | 'prepare' | 'create' | 'review' | 'network' | 'evidence';
    status?: 'todo' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
    reason?: string | null;
    priority?: number;
    estimated_minutes?: number | null;
    due_at?: string | null;
    completed_at?: string | null;
    source?: string;
    goal_id?: string | null;
    user_skill_id?: string | null;
    project_id?: string | null;
    opportunity_id?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  learning_sessions: {
   Row: {
    id: string;
    user_id: string;
    skill_id: string;
    goal_id: string | null;
    action_id: string | null;
    resource_id: string | null;
    started_at: string;
    completed_at: string | null;
    duration_minutes: number | null;
    notes: string | null;
    status: 'active' | 'completed';
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    skill_id: string;
    goal_id?: string | null;
    action_id?: string | null;
    resource_id?: string | null;
    started_at?: string;
    completed_at?: string | null;
    duration_minutes?: number | null;
    notes?: string | null;
    status?: 'active' | 'completed';
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    skill_id?: string;
    goal_id?: string | null;
    action_id?: string | null;
    resource_id?: string | null;
    started_at?: string;
    completed_at?: string | null;
    duration_minutes?: number | null;
    notes?: string | null;
    status?: 'active' | 'completed';
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  evidence: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    type: 'repository' | 'deployment' | 'screenshot' | 'demo' | 'certificate' | 'writing' | 'exercise' | 'artifact';
    url: string | null;
    notes: string | null;
    action_id: string | null;
    project_id: string | null;
    opportunity_id: string | null;
    attempt_id: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    type?: 'repository' | 'deployment' | 'screenshot' | 'demo' | 'certificate' | 'writing' | 'exercise' | 'artifact';
    url?: string | null;
    notes?: string | null;
    action_id?: string | null;
    project_id?: string | null;
    opportunity_id?: string | null;
    attempt_id?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    type?: 'repository' | 'deployment' | 'screenshot' | 'demo' | 'certificate' | 'writing' | 'exercise' | 'artifact';
    url?: string | null;
    notes?: string | null;
    action_id?: string | null;
    project_id?: string | null;
    opportunity_id?: string | null;
    attempt_id?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  evidence_skills: {
   Row: {
    id: string;
    user_id: string;
    evidence_id: string;
    skill_id: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    evidence_id: string;
    skill_id: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    evidence_id?: string;
    skill_id?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  mastery_events: {
   Row: {
    id: string;
    user_id: string;
    user_skill_id: string;
    action_id: string | null;
    evidence_id: string | null;
    kind: 'practice' | 'self_assessment' | 'assessment';
    practice_minutes: number | null;
    assessed_mastery: number | null;
    rationale: string;
    occurred_at: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    user_skill_id: string;
    action_id?: string | null;
    evidence_id?: string | null;
    kind?: 'practice' | 'self_assessment' | 'assessment';
    practice_minutes?: number | null;
    assessed_mastery?: number | null;
    rationale: string;
    occurred_at?: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    user_skill_id?: string;
    action_id?: string | null;
    evidence_id?: string | null;
    kind?: 'practice' | 'self_assessment' | 'assessment';
    practice_minutes?: number | null;
    assessed_mastery?: number | null;
    rationale?: string;
    occurred_at?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  habits: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    goal_id: string | null;
    target_per_week: number;
    active: boolean;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    goal_id?: string | null;
    target_per_week?: number;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    goal_id?: string | null;
    target_per_week?: number;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  missions: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    goal_id: string | null;
    starts_on: string | null;
    status: 'planned' | 'active' | 'completed' | 'cancelled';
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    goal_id?: string | null;
    starts_on?: string | null;
    status?: 'planned' | 'active' | 'completed' | 'cancelled';
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    goal_id?: string | null;
    starts_on?: string | null;
    status?: 'planned' | 'active' | 'completed' | 'cancelled';
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  mission_actions: {
   Row: {
    id: string;
    user_id: string;
    mission_id: string;
    action_id: string;
    day_number: number;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    mission_id: string;
    action_id: string;
    day_number: number;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    mission_id?: string;
    action_id?: string;
    day_number?: number;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  habit_actions: {
   Row: {
    id: string;
    user_id: string;
    habit_id: string;
    action_id: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    habit_id: string;
    action_id: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    habit_id?: string;
    action_id?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  resources: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    url: string;
    source: string;
    provider: string;
    type: 'learn' | 'read' | 'watch' | 'research' | 'build' | 'tool';
    curated: boolean;
    retrieved_at: string | null;
    confidence: number | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    url: string;
    source: string;
    provider: string;
    type?: 'learn' | 'read' | 'watch' | 'research' | 'build' | 'tool';
    curated?: boolean;
    retrieved_at?: string | null;
    confidence?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    url?: string;
    source?: string;
    provider?: string;
    type?: 'learn' | 'read' | 'watch' | 'research' | 'build' | 'tool';
    curated?: boolean;
    retrieved_at?: string | null;
    confidence?: number | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  resource_skills: {
   Row: {
    id: string;
    user_id: string;
    resource_id: string;
    skill_id: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    resource_id: string;
    skill_id: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    resource_id?: string;
    skill_id?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  decisions: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    reasoning: string;
    alternatives: string | null;
    expected_outcome: string | null;
    actual_outcome: string | null;
    review_on: string | null;
    goal_id: string | null;
    project_id: string | null;
    action_id: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    reasoning: string;
    alternatives?: string | null;
    expected_outcome?: string | null;
    actual_outcome?: string | null;
    review_on?: string | null;
    goal_id?: string | null;
    project_id?: string | null;
    action_id?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    reasoning?: string;
    alternatives?: string | null;
    expected_outcome?: string | null;
    actual_outcome?: string | null;
    review_on?: string | null;
    goal_id?: string | null;
    project_id?: string | null;
    action_id?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  trends: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    provider: string;
    source_url: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    provider: string;
    source_url: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    provider?: string;
    source_url?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  trend_snapshots: {
   Row: {
    id: string;
    user_id: string;
    trend_id: string;
    observed_at: string;
    metric: string;
    value: number;
    source_url: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    trend_id: string;
    observed_at: string;
    metric: string;
    value: number;
    source_url: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    trend_id?: string;
    observed_at?: string;
    metric?: string;
    value?: number;
    source_url?: string;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  portfolio_items: {
   Row: {
    id: string;
    user_id: string;
    title: string;
    project_id: string;
    evidence_id: string;
    url: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    title: string;
    project_id: string;
    evidence_id: string;
    url?: string | null;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    title?: string;
    project_id?: string;
    evidence_id?: string;
    url?: string | null;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
  learning_experiments: {
   Row: {
    id: string;
    user_id: string;
    skill_id: string;
    goal_id: string | null;
    project_id: string | null;
    template_key: string;
    title: string;
    objective: string;
    definition_version: number;
    steps: unknown;
    acceptance_criteria: unknown;
    constraints: unknown;
    success_conditions: unknown;
    evidence_requirements: unknown;
    estimated_minutes: number | null;
    evaluation_mode: 'deterministic' | 'manual';
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id: string;
    user_id?: string;
    skill_id: string;
    goal_id?: string | null;
    project_id?: string | null;
    template_key: string;
    title: string;
    objective: string;
    definition_version?: number;
    steps?: unknown;
    acceptance_criteria?: unknown;
    constraints?: unknown;
    success_conditions?: unknown;
    evidence_requirements?: unknown;
    estimated_minutes?: number | null;
    evaluation_mode: 'deterministic' | 'manual';
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string; user_id?: string; skill_id?: string; goal_id?: string | null; project_id?: string | null; template_key?: string; title?: string; objective?: string; definition_version?: number; steps?: unknown; acceptance_criteria?: unknown; constraints?: unknown; success_conditions?: unknown; evidence_requirements?: unknown; estimated_minutes?: number | null; evaluation_mode?: 'deterministic' | 'manual'; created_at?: string; updated_at?: string;
   };
   Relationships: [];
  };
  learning_experiment_attempts: {
   Row: {
    id: string;
    user_id: string;
   experiment_id: string;
    experiment_definition_version: number;
    goal_id: string | null;
    project_id: string | null;
    action_id: string | null;
    session_id: string | null;
    status: 'PROPOSED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
    result: 'NOT_EVALUATED' | 'PASSED' | 'PARTIAL' | 'FAILED';
    idempotency_key: string;
    started_at: string | null;
    completed_at: string | null;
    abandoned_at: string | null;
    evaluated_at: string | null;
    assessment_id: string | null;
    provenance: Record<string, unknown>;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    experiment_id: string;
    experiment_definition_version?: number;
    goal_id?: string | null;
    project_id?: string | null;
    action_id?: string | null;
    session_id?: string | null;
    status?: 'PROPOSED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
    result?: 'NOT_EVALUATED' | 'PASSED' | 'PARTIAL' | 'FAILED';
    idempotency_key: string;
    started_at?: string | null;
    completed_at?: string | null;
    abandoned_at?: string | null;
    evaluated_at?: string | null;
    assessment_id?: string | null;
    provenance?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string; user_id?: string; experiment_id?: string; experiment_definition_version?: number; goal_id?: string | null; project_id?: string | null; action_id?: string | null; session_id?: string | null; status?: 'PROPOSED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'; result?: 'NOT_EVALUATED' | 'PASSED' | 'PARTIAL' | 'FAILED'; idempotency_key?: string; started_at?: string | null; completed_at?: string | null; abandoned_at?: string | null; evaluated_at?: string | null; assessment_id?: string | null; provenance?: unknown; created_at?: string; updated_at?: string;
   };
   Relationships: [];
  };
  learning_assessments: {
   Row: {
    id: string;
    user_id: string;
    attempt_id: string;
    contract_snapshot: Record<string, unknown>;
    response: string | null;
    evaluator: 'manual';
    status: 'ATTEMPTED' | 'PARTIAL' | 'PASSED' | 'INSUFFICIENT_EVIDENCE';
    feedback: string | null;
    evaluated_at: string | null;
    provenance: Record<string, unknown>;
    idempotency_key: string;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    attempt_id: string;
    contract_snapshot: Record<string, unknown>;
    response?: string | null;
    evaluator?: 'manual';
    status: 'ATTEMPTED' | 'PARTIAL' | 'PASSED' | 'INSUFFICIENT_EVIDENCE';
    feedback?: string | null;
    evaluated_at?: string | null;
    provenance?: Record<string, unknown>;
    idempotency_key: string;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string; user_id?: string; attempt_id?: string; contract_snapshot?: Record<string, unknown>; response?: string | null; evaluator?: 'manual'; status?: 'ATTEMPTED' | 'PARTIAL' | 'PASSED' | 'INSUFFICIENT_EVIDENCE'; feedback?: string | null; evaluated_at?: string | null; provenance?: Record<string, unknown>; idempotency_key?: string; created_at?: string; updated_at?: string;
   };
   Relationships: [];
  };
  reflections: {
   Row: {
    id: string;
    user_id: string;
    goal_id: string | null;
    period_start: string;
    period_end: string;
    accomplishment: string | null;
    learning: string | null;
    blocker: string | null;
    next_step: string | null;
    created_at: string;
    updated_at: string;
   };
   Insert: {
    id?: string;
    user_id?: string;
    goal_id?: string | null;
    period_start: string;
    period_end: string;
    accomplishment?: string | null;
    learning?: string | null;
    blocker?: string | null;
    next_step?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Update: {
    id?: string;
    user_id?: string;
    goal_id?: string | null;
    period_start?: string;
    period_end?: string;
    accomplishment?: string | null;
    learning?: string | null;
    blocker?: string | null;
    next_step?: string | null;
    created_at?: string;
    updated_at?: string;
   };
   Relationships: [];
  };
 };
 Views: { [_ in never]: never };
 Functions: { [_ in never]: never };
 Enums: { [_ in never]: never };
 CompositeTypes: { [_ in never]: never };
 };
}
export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
