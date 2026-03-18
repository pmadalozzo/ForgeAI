/**
 * CRUD para agent_skills no Supabase.
 * Skills são documentos SKILL.md completos com frontmatter YAML.
 */
import { getSupabaseClient } from "./safe-client";

export interface SkillRow {
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
}

export interface CreateSkillInput {
  agent_role: string;
  name: string;
  description: string;
  content: string;
  version?: string;
  tags?: string[];
  is_default?: boolean;
  project_id?: string | null;
  created_by?: string | null;
}

/** Busca skills de um agente (projeto-específicas + defaults globais) */
export async function fetchSkillsForAgent(
  agentRole: string,
  projectId?: string | null,
): Promise<SkillRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("agent_skills")
    .select("*")
    .eq("agent_role", agentRole)
    .order("created_at");

  if (projectId) {
    query = query.or(`project_id.eq.${projectId},project_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[skills-service] fetchSkillsForAgent:", error.message);
    return [];
  }

  return (data ?? []) as SkillRow[];
}

/** Busca todas as skills (de um projeto ou globais) */
export async function fetchAllSkills(
  projectId?: string | null,
): Promise<SkillRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from("agent_skills")
    .select("*")
    .order("agent_role")
    .order("created_at");

  if (projectId) {
    query = query.or(`project_id.eq.${projectId},project_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[skills-service] fetchAllSkills:", error.message);
    return [];
  }

  return (data ?? []) as SkillRow[];
}

/** Cria uma nova skill */
export async function createSkill(input: CreateSkillInput): Promise<SkillRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("agent_skills")
    .insert({
      agent_role: input.agent_role,
      name: input.name,
      description: input.description,
      content: input.content,
      version: input.version ?? "1.0.0",
      tags: input.tags ?? [],
      is_default: input.is_default ?? false,
      project_id: input.project_id ?? null,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[skills-service] createSkill:", error.message);
    return null;
  }

  return data as SkillRow;
}

/** Atualiza uma skill existente */
export async function updateSkill(
  skillId: string,
  updates: Partial<Pick<SkillRow, "name" | "description" | "content" | "version" | "tags">>,
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("agent_skills")
    .update(updates)
    .eq("id", skillId);

  if (error) {
    console.error("[skills-service] updateSkill:", error.message);
    return false;
  }

  return true;
}

/** Remove uma skill */
export async function deleteSkill(skillId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("agent_skills")
    .delete()
    .eq("id", skillId);

  if (error) {
    console.error("[skills-service] deleteSkill:", error.message);
    return false;
  }

  return true;
}

/** Conteúdo padrão das skills por role (fallback quando Supabase não tem dados) */
const DEFAULT_SKILL_CONTENT: Record<string, { name: string; description: string; content: string; tags: string[] }> = {
  orchestrator: {
    name: "Orquestrador",
    description: "Coordenador central que decompõe requisitos, atribui tarefas e monitora progresso.",
    content: "",
    tags: ["coordenação", "planejamento", "gestão", "sprint"],
  },
  pm: {
    name: "Product Manager",
    description: "Traduz necessidades do usuário em user stories e prioriza o backlog.",
    content: "",
    tags: ["user-stories", "backlog", "priorização", "requisitos"],
  },
  architect: {
    name: "Arquiteto",
    description: "Define arquitetura do sistema, API design e decisões técnicas.",
    content: "",
    tags: ["arquitetura", "design", "api-design", "decisões-técnicas"],
  },
  frontend: {
    name: "Frontend Dev",
    description: "Cria interfaces React/TypeScript responsivas e acessíveis.",
    content: "",
    tags: ["react", "typescript", "tailwind", "ui", "componentes"],
  },
  backend: {
    name: "Backend Dev",
    description: "Implementa APIs REST, autenticação e lógica de negócio.",
    content: "",
    tags: ["nodejs", "fastify", "api", "rest", "auth"],
  },
  database: {
    name: "Database Engineer",
    description: "Modelagem de dados, migrations e otimização de queries PostgreSQL.",
    content: "",
    tags: ["postgresql", "sql", "modelagem", "migrations"],
  },
  qa: {
    name: "QA Engineer",
    description: "Testes unitários, integração e e2e. Bug reports e cobertura de código.",
    content: "",
    tags: ["testes", "vitest", "playwright", "cobertura"],
  },
  security: {
    name: "Security Engineer",
    description: "Análise de vulnerabilidades, OWASP Top 10 e auditoria de segurança.",
    content: "",
    tags: ["segurança", "owasp", "vulnerabilidades", "auth"],
  },
  devops: {
    name: "DevOps Engineer",
    description: "CI/CD, Docker, deploy e monitoramento de infraestrutura.",
    content: "",
    tags: ["cicd", "docker", "deploy", "monitoramento"],
  },
  reviewer: {
    name: "Code Reviewer",
    description: "Revisão de código por qualidade, padrões e boas práticas.",
    content: "",
    tags: ["code-review", "qualidade", "refactoring", "performance"],
  },
  designer: {
    name: "UI/UX Designer",
    description: "Revisa e melhora interfaces, pesquisa referências de grandes players.",
    content: "",
    tags: ["design", "ui", "ux", "layout", "responsivo", "design-system"],
  },
};

/** Sincroniza SKILL.md dos arquivos locais para o Supabase (upsert por agent_role) */
export async function syncSkillsFromFiles(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  const roles = [
    "orchestrator", "pm", "architect", "frontend", "backend",
    "database", "qa", "security", "devops", "reviewer",
  ];

  let synced = 0;

  for (const role of roles) {
    try {
      const res = await fetch(`/api/skills/${role}`);
      if (!res.ok) continue;
      const data = await res.json() as { content: string | null };
      if (!data.content || data.content.length < 100) continue;

      const def = DEFAULT_SKILL_CONTENT[role];
      const name = def?.name ?? role;
      const description = def?.description ?? `Agente ${role}`;
      const tags = def?.tags ?? [];

      // Upsert: atualiza se já existe, insere se não
      const { error } = await supabase
        .from("agent_skills")
        .upsert(
          {
            agent_role: role,
            name,
            description,
            content: data.content,
            version: "2.0.0",
            tags,
            is_default: true,
            project_id: null,
          },
          { onConflict: "agent_role" },
        );

      if (!error) synced++;
    } catch {
      // Arquivo não encontrado — ignora
    }
  }

  console.log(`[skills-service] ${synced} skills sincronizadas dos arquivos para o Supabase`);
  return synced;
}

/** Retorna skill padrão para um role (usado como fallback) */
export function getDefaultSkill(agentRole: string): CreateSkillInput {
  const def = DEFAULT_SKILL_CONTENT[agentRole];
  if (!def) {
    return {
      agent_role: agentRole,
      name: agentRole,
      description: `Agente ${agentRole}`,
      content: `# ${agentRole}\n\nDescreva as habilidades deste agente aqui.`,
      tags: [],
      is_default: true,
    };
  }
  return {
    agent_role: agentRole,
    name: def.name,
    description: def.description,
    content: def.content,
    tags: def.tags,
    is_default: true,
  };
}
