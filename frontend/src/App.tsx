import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type HealthState = "checking" | "available" | "unavailable";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export default function App() {
  const supabase = useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    let active = true;
    fetch(`${apiBaseUrl}/health/live`)
      .then((response) => {
        if (!response.ok) throw new Error("API indisponível");
        return response.json();
      })
      .then(() => active && setHealth("available"))
      .catch(() => active && setHealth("unavailable"));

    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (active) setUserEmail(data.session?.user.email ?? null);
      });
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setUserEmail(session?.user.email ?? null);
      });
      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    }
    return () => { active = false; };
  }, [supabase]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!supabase) {
      setMessage("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage("Não foi possível autenticar. Verifique os dados ou a configuração do Supabase Auth.");
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setMessage(error ? "Não foi possível encerrar a sessão." : "Sessão encerrada.");
  }

  return (
    <main className="page">
      <header className="header">
        <div className="mark">SEAP</div>
        <div>
          <p className="eyebrow">Controle de processos correicionais</p>
          <h1>ControleSEAP</h1>
        </div>
      </header>
      <section className="panel">
        <h2>Ambiente de migração</h2>
        <p className="muted">Esta é a base da nova interface. Os módulos de negócio serão migrados após o mapeamento das operações e do schema atual.</p>
        <div className="status">
          <span className={`dot ${health}`} />
          <span>API: {health === "checking" ? "verificando…" : health === "available" ? "disponível" : "indisponível"}</span>
        </div>
        {!userEmail ? (
          <form onSubmit={signIn}>
            <h3>Acesso institucional</h3>
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">Entrar</button>
            <p className="muted small">O login depende da configuração do Supabase Auth e de usuários autorizados no projeto.</p>
          </form>
        ) : (
          <div className="signed-in">
            <p>Sessão autenticada como <strong>{userEmail}</strong>.</p>
            <button type="button" className="secondary" onClick={signOut}>Sair</button>
          </div>
        )}
        {message && <p role="status" className="message">{message}</p>}
      </section>
      <footer>Versão inicial de arquitetura — não substitui ainda o sistema legado.</footer>
    </main>
  );
}
