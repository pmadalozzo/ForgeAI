/**
 * Tipos TypeScript do banco de dados Supabase — gerado manualmente para corresponder ao schema.
 * Será substituído por `npx supabase gen types typescript` em produção.
 */

// ========================
// Enums do banco de dados
// ========================

export type UserRole = 'viewer' | 'developer' | 'admin';
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed';
export type SupervisionMode = 'autopilot' | 'approve' | 'watch' | 'pair';
export type SourceType = 'text' | 'local_folder' | 'git_repo';
export type SenderType = 'user' | 'agent' | 'system';
export type MemberRole = 'viewer' | 'developer' | 'admin';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'blocked' | 'done';

// ========================
// Interfaces das tabelas (Row, Insert, Update)
// ========================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          role: UserRole;
          github_token: string | null;
          github_username: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          github_token?: string | null;
          github_username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          github_token?: string | null;
          github_username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description: string;
          status: ProjectStatus;
          supervision_mode: SupervisionMode;
          source_type: SourceType;
          source_url: string | null;
          git_branch: string | null;
          created_by: string;
          progress: number;
          total_cost: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          status?: ProjectStatus;
          supervision_mode?: SupervisionMode;
          source_type?: SourceType;
          source_url?: string | null;
          git_branch?: string | null;
          created_by: string;
          progress?: number;
          total_cost?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          status?: ProjectStatus;
          supervision_mode?: SupervisionMode;
          source_type?: SourceType;
          source_url?: string | null;
          git_branch?: string | null;
          created_by?: string;
          progress?: number;
          total_cost?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_members: {
        Row: {
          project_id: string;
          user_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: {
          project_id: string;
          user_id: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Update: {
          project_id?: string;
          user_id?: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_members_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'project_members_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      project_messages: {
        Row: {
          id: string;
          project_id: string;
          sender_type: SenderType;
          sender_id: string;
          agent_role: string | null;
          content: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          sender_type: SenderType;
          sender_id: string;
          agent_role?: string | null;
          content: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          sender_type?: SenderType;
          sender_id?: string;
          agent_role?: string | null;
          content?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_messages_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_configs: {
        Row: {
          id: string;
          project_id: string;
          agent_role: string;
          llm_provider: string;
          model_name: string;
          is_active: boolean;
          config: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          agent_role: string;
          llm_provider: string;
          model_name: string;
          is_active?: boolean;
          config?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          agent_role?: string;
          llm_provider?: string;
          model_name?: string;
          is_active?: boolean;
          config?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_configs_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string;
          assigned_agent: string | null;
          status: TaskStatus;
          priority: number;
          parent_task_id: string | null;
          quality_gate_results: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          description?: string;
          assigned_agent?: string | null;
          status?: TaskStatus;
          priority?: number;
          parent_task_id?: string | null;
          quality_gate_results?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          description?: string;
          assigned_agent?: string | null;
          status?: TaskStatus;
          priority?: number;
          parent_task_id?: string | null;
          quality_gate_results?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_parent_task_id_fkey';
            columns: ['parent_task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_sessions: {
        Row: {
          id: string;
          project_id: string;
          agent_role: string;
          status: string;
          current_task_id: string | null;
          lines_written: number;
          tokens_used: number;
          cost: number;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          agent_role: string;
          status?: string;
          current_task_id?: string | null;
          lines_written?: number;
          tokens_used?: number;
          cost?: number;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          agent_role?: string;
          status?: string;
          current_task_id?: string | null;
          lines_written?: number;
          tokens_used?: number;
          cost?: number;
          started_at?: string;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_sessions_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_sessions_current_task_id_fkey';
            columns: ['current_task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      artifacts: {
        Row: {
          id: string;
          project_id: string;
          task_id: string | null;
          file_path: string;
          content: string;
          artifact_type: string;
          created_by_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          task_id?: string | null;
          file_path: string;
          content?: string;
          artifact_type: string;
          created_by_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          file_path?: string;
          content?: string;
          artifact_type?: string;
          created_by_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'artifacts_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'artifacts_task_id_fkey';
            columns: ['task_id'];
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      project_memories: {
        Row: {
          id: string;
          project_id: string;
          agent_role: string;
          type: string;
          title: string;
          content: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          agent_role: string;
          type: string;
          title: string;
          content: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          agent_role?: string;
          type?: string;
          title?: string;
          content?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'project_memories_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      dev_memories: {
        Row: {
          id: string;
          category: string;
          title: string;
          content: string;
          learned_from: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          title: string;
          content: string;
          learned_from?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          title?: string;
          content?: string;
          learned_from?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          providers: Record<string, unknown>;
          agent_defaults: Record<string, unknown>;
          supervision_mode: string;
          claude_effort: string;
          max_parallel_agents: number;
          auto_fast_model: boolean;
          theme: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          providers?: Record<string, unknown>;
          agent_defaults?: Record<string, unknown>;
          supervision_mode?: string;
          claude_effort?: string;
          max_parallel_agents?: number;
          auto_fast_model?: boolean;
          theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          providers?: Record<string, unknown>;
          agent_defaults?: Record<string, unknown>;
          supervision_mode?: string;
          claude_effort?: string;
          max_parallel_agents?: number;
          auto_fast_model?: boolean;
          theme?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_skills: {
        Row: {
          id: string;
          agent_role: string;
          name: string;
          description: string;
          content: string;
          version: string;
          tags: string[];
          is_default: boolean;
          project_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_role: string;
          name: string;
          description?: string;
          content?: string;
          version?: string;
          tags?: string[];
          is_default?: boolean;
          project_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_role?: string;
          name?: string;
          description?: string;
          content?: string;
          version?: string;
          tags?: string[];
          is_default?: boolean;
          project_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_skills_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_skills_created_by_fkey';
            columns: ['created_by'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_project_member: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      get_member_role: {
        Args: { p_project_id: string };
        Returns: MemberRole;
      };
      is_project_developer_or_admin: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
      is_project_admin: {
        Args: { p_project_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      project_status: ProjectStatus;
      supervision_mode: SupervisionMode;
      source_type: SourceType;
      sender_type: SenderType;
      member_role: MemberRole;
      task_status: TaskStatus;
    };
  };
}

// ========================
// Tipos utilitarios para uso direto nos componentes
// ========================

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Atalhos para uso frequente
export type Profile = Tables<'profiles'>;
export type Project = Tables<'projects'>;
export type ProjectMember = Tables<'project_members'>;
export type ProjectMessage = Tables<'project_messages'>;
export type AgentConfig = Tables<'agent_configs'>;
export type Task = Tables<'tasks'>;
export type AgentSession = Tables<'agent_sessions'>;
export type Artifact = Tables<'artifacts'>;
export type AgentSkill = Tables<'agent_skills'>;
export type UserSettings = Tables<'user_settings'>;
export type ProjectMemoryRow = Tables<'project_memories'>;
export type DevMemoryRow = Tables<'dev_memories'>;
