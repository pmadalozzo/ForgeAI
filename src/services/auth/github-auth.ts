/**
 * GitHub Authentication Service — Autenticacao via Personal Access Token (PAT).
 * Valida tokens contra a API do GitHub e lista repositorios do usuario.
 */

/** Estado de autenticacao do GitHub */
export interface GitHubAuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  avatarUrl: string | null;
}

/** Informacoes basicas do usuario GitHub */
export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

/** Repositorio do usuario GitHub */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  language: string | null;
  updated_at: string;
  stargazers_count: number;
}

/** Resultado de validacao de token */
export interface TokenValidationResult {
  valid: boolean;
  username: string | null;
  avatarUrl: string | null;
  error: string | null;
}

/** URL para criar um novo PAT no GitHub com escopo repo */
export const GITHUB_NEW_TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=repo&description=ForgeAI";

// === Device Flow ===

/** Resposta do GitHub ao iniciar o Device Flow */
export interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/** Status do polling do Device Flow */
export type DeviceFlowPollStatus =
  | { status: "pending" }
  | { status: "success"; token: string }
  | { status: "expired" }
  | { status: "error"; message: string };

/**
 * Inicia o GitHub Device Flow.
 * Requer um client_id de um GitHub OAuth App.
 * O usuário recebe um user_code para digitar em https://github.com/login/device
 */
export async function startDeviceFlow(clientId: string): Promise<DeviceFlowResponse | null> {
  try {
    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: "repo",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as DeviceFlowResponse;
    return data;
  } catch {
    return null;
  }
}

/**
 * Faz polling para verificar se o usuário já autorizou o Device Flow.
 * Retorna o access_token quando autorizado.
 */
export async function pollDeviceFlow(
  clientId: string,
  deviceCode: string,
): Promise<DeviceFlowPollStatus> {
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return { status: "error", message: `HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.access_token) {
      return { status: "success", token: data.access_token };
    }

    if (data.error === "authorization_pending") {
      return { status: "pending" };
    }

    if (data.error === "slow_down") {
      return { status: "pending" };
    }

    if (data.error === "expired_token") {
      return { status: "expired" };
    }

    return { status: "error", message: data.error_description ?? data.error ?? "Erro desconhecido" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", message };
  }
}

/**
 * Valida um Personal Access Token do GitHub.
 * Chama GET /user para verificar se o token e valido e obter dados do usuario.
 */
export async function validateToken(token: string): Promise<TokenValidationResult> {
  if (!token || token.trim().length === 0) {
    return { valid: false, username: null, avatarUrl: null, error: "Token vazio" };
  }

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, username: null, avatarUrl: null, error: "Token invalido ou expirado" };
      }
      if (response.status === 403) {
        return { valid: false, username: null, avatarUrl: null, error: "Token sem permissoes suficientes" };
      }
      return {
        valid: false,
        username: null,
        avatarUrl: null,
        error: `Erro HTTP ${response.status}`,
      };
    }

    const user = (await response.json()) as GitHubUser;

    return {
      valid: true,
      username: user.login,
      avatarUrl: user.avatar_url,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      username: null,
      avatarUrl: null,
      error: `Erro de rede: ${message}`,
    };
  }
}

/**
 * Lista os repositorios do usuario autenticado, ordenados por data de atualizacao.
 */
export async function listRepos(
  token: string,
): Promise<{ repos: GitHubRepo[]; error: string | null }> {
  try {
    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=20",
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      return { repos: [], error: `Erro HTTP ${response.status}` };
    }

    const repos = (await response.json()) as GitHubRepo[];
    return { repos, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { repos: [], error: `Erro de rede: ${message}` };
  }
}
