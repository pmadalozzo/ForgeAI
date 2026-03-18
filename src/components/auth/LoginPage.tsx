/**
 * Pagina de login do ForgeAI.
 * Suporta autenticacao via Supabase (email/senha) e modo local (offline).
 * Se as variaveis do Supabase nao estiverem presentes, mostra apenas modo local.
 */
import { useState, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { isSupabaseAvailable, getSupabaseClient } from "@/services/supabase/safe-client";

/** Tipo de view ativa */
type AuthView = "login" | "signup" | "forgot";

export function LoginPage() {
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);

  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabaseReady = isSupabaseAvailable();

  const canSubmit = email.trim().length > 0 && password.trim().length >= 6;

  /** Login com email + senha */
  const handleLogin = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    setLoading(false);

    if (authError) {
      setError(traduzirErro(authError.message));
      return;
    }

    if (data.user) {
      setAuthenticated(data.user.id, data.user.email ?? email.trim());
    }
  }, [email, password, setAuthenticated]);

  /** Criar conta */
  const handleSignUp = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    setLoading(false);

    if (authError) {
      setError(traduzirErro(authError.message));
      return;
    }

    // Se o Supabase exige confirmacao de email
    if (data.user && !data.session) {
      setSuccessMessage("Conta criada! Verifique seu email para confirmar.");
      setView("login");
      return;
    }

    // Login automatico apos signup
    if (data.user && data.session) {
      setAuthenticated(data.user.id, data.user.email ?? email.trim());
    }
  }, [email, password, setAuthenticated]);

  /** Recuperar senha */
  const handleForgotPassword = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (!email.trim()) {
      setError("Informe o email para recuperar a senha.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
    );

    setLoading(false);

    if (resetError) {
      setError(traduzirErro(resetError.message));
      return;
    }

    setSuccessMessage("Email de recuperacao enviado! Verifique sua caixa de entrada.");
    setView("login");
  }, [email]);

  /** Submit do form */
  const handleSubmit = useCallback(() => {
    if (view === "login") {
      void handleLogin();
    } else if (view === "signup") {
      void handleSignUp();
    } else if (view === "forgot") {
      void handleForgotPassword();
    }
  }, [view, handleLogin, handleSignUp, handleForgotPassword]);

  /** Enter para submeter */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        background: "#080c14",
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        color: "#e2e8f0",
      }}
    >
      {/* Branding */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 42 }}>{"\u{1F3ED}"}</span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 6,
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6, #10B981)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            FORGEAI
          </span>
        </div>
        <span style={{ fontSize: 14, color: "#475569", letterSpacing: 2 }}>
          Fábrica de Software Autônoma
        </span>
      </div>

      {/* Card de login */}
      <div
        style={{
          width: 420,
          maxWidth: "90vw",
          background: "#0c1322",
          border: "1px solid #1e293b",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Mensagens de sucesso */}
        {successMessage && (
          <div
            style={{
              fontSize: 13,
              color: "#10B981",
              background: "#064e3b22",
              border: "1px solid #064e3b",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Formulario Supabase */}
        {supabaseReady && (
          <>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#e2e8f0",
                margin: "0 0 24px 0",
                textAlign: "center",
              }}
            >
              {view === "login"
                ? "Entrar"
                : view === "signup"
                  ? "Criar Conta"
                  : "Recuperar Senha"}
            </h2>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="seu@email.com"
                style={inputStyle}
                autoFocus
                autoComplete="email"
              />
            </div>

            {/* Senha (nao mostra em forgot) */}
            {view !== "forgot" && (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Minimo 6 caracteres"
                  style={inputStyle}
                  autoComplete={view === "login" ? "current-password" : "new-password"}
                />
              </div>
            )}

            {/* Erro */}
            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#EF4444",
                  background: "#7f1d1d22",
                  border: "1px solid #7f1d1d",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {/* Botao principal */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || (view !== "forgot" && !canSubmit) || (view === "forgot" && !email.trim())}
              style={{
                width: "100%",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "inherit",
                color: "#fff",
                background:
                  loading
                    ? "#334155"
                    : "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                border: "none",
                borderRadius: 10,
                cursor: loading ? "wait" : "pointer",
                opacity: loading || (view !== "forgot" && !canSubmit) || (view === "forgot" && !email.trim()) ? 0.5 : 1,
                transition: "opacity 0.2s",
                letterSpacing: 1,
                marginBottom: 16,
              }}
            >
              {loading
                ? "Aguarde..."
                : view === "login"
                  ? "Entrar"
                  : view === "signup"
                    ? "Criar Conta"
                    : "Enviar Email de Recuperacao"}
            </button>

            {/* Links de navegacao */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {view === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setView("signup");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    style={linkBtnStyle}
                  >
                    Criar conta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    style={linkBtnStyle}
                  >
                    Esqueceu a senha?
                  </button>
                </>
              )}
              {view === "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  style={linkBtnStyle}
                >
                  Ja tenho conta
                </button>
              )}
              {view === "forgot" && (
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  style={linkBtnStyle}
                >
                  Voltar para login
                </button>
              )}
            </div>

              </>
        )}

        {/* Se Supabase nao esta disponivel */}
        {!supabaseReady && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#EF4444", margin: "0 0 8px 0", lineHeight: 1.5 }}>
              Supabase nao configurado. Verifique as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Traduz mensagens de erro do Supabase para portugues */
function traduzirErro(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Email ainda nao confirmado. Verifique sua caixa de entrada.";
  }
  if (lower.includes("user already registered")) {
    return "Este email ja esta cadastrado. Tente fazer login.";
  }
  if (lower.includes("password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Muitas tentativas. Aguarde um momento e tente novamente.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Erro de conexao. Verifique sua internet.";
  }
  return msg;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 8,
  fontFamily: "inherit",
  fontWeight: 600,
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#e2e8f0",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#3B82F6",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
