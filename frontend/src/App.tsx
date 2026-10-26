import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type HealthState = "checking" | "available" | "unavailable";
type Diligencia = {
  doc_solicitante: string;
  prazo_atendimento: string;
  data_resposta: string;
};
type Processo = {
  id: string | number;
  sei: string | null;
  objeto: string | null;
  diligencias: Diligencia[] | string | null;
};
type DiligenciaItem = Diligencia & { processId: string; sei: string; objeto: string; index: number; daysLeft: number | null };

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ALERT_DAYS = 15;

function parseDiligencias(value: Processo["diligencias"]): Diligencia[] {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(dateValue: string): number {
  const [year, month, day] = dateValue.split("-").map(Number);
  const due = new Date(year, month - 1, day);
  const todayText = localDateString();
  const [todayYear, todayMonth, todayDay] = todayText.split("-").map(Number);
  const today = new Date(todayYear, todayMonth - 1, todayDay);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getDeadlineState(item: DiligenciaItem): "answered" | "overdue" | "alert" | "ok" {
  if (item.data_resposta) return "answered";
  if (item.daysLeft !== null && item.daysLeft < 0) return "overdue";
  if (item.daysLeft !== null && item.daysLeft <= ALERT_DAYS) return "alert";
  return "ok";
}

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
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "answered">("pending");
  const [search, setSearch] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [documento, setDocumento] = useState("");
  const [prazo, setPrazo] = useState("");
  const [resposta, setResposta] = useState("");

  const loadProcessos = useCallback(async () => {
    if (!supabase || !userEmail) return;
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("processos")
      .select("id, sei, objeto, diligencias")
      .order("sei", { ascending: true });
    setLoading(false);
    if (error) {
      setMessage(`Não foi possível carregar os processos: ${error.message}`);
      return;
    }
    const rows = (data ?? []) as Processo[];
    setProcessos(rows);
    setSelectedProcessId((current) => current || (rows[0] ? String(rows[0].id) : ""));
  }, [supabase, userEmail]);

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

  useEffect(() => {
    if (userEmail) void loadProcessos();
    else setProcessos([]);
  }, [userEmail, loadProcessos]);

  const items = useMemo<DiligenciaItem[]>(() => processos.flatMap((processo) =>
    parseDiligencias(processo.diligencias).map((diligencia, index) => ({
      ...diligencia,
      processId: String(processo.id),
      sei: processo.sei || "(Processo sem SEI)",
      objeto: processo.objeto || "",
      index,
      daysLeft: diligencia.prazo_atendimento ? daysUntil(diligencia.prazo_atendimento) : null,
    })),
  ), [processos]);

  const visibleItems = useMemo(() => items.filter((item) => {
    const state = getDeadlineState(item);
    const matchesFilter = filter === "all" || (filter === "pending" ? state !== "answered" : state === "answered");
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !needle || [item.sei, item.objeto, item.doc_solicitante].some((v) => String(v ?? "").toLocaleLowerCase("pt-BR").includes(needle));
    return matchesFilter && matchesSearch;
  }).sort((a, b) => {
    if (a.data_resposta && !b.data_resposta) return 1;
    if (!a.data_resposta && b.data_resposta) return -1;
    return (a.daysLeft ?? 999999) - (b.daysLeft ?? 999999);
  }), [items, filter, search]);

  const pending = items.filter((item) => !item.data_resposta);
  const overdueCount = pending.filter((item) => item.daysLeft !== null && item.daysLeft < 0).length;
  const alertCount = pending.filter((item) => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= ALERT_DAYS).length;
  const onTimeCount = pending.filter((item) => item.daysLeft !== null && item.daysLeft > ALERT_DAYS).length;
  const answeredCount = items.length - pending.length;

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

  async function saveDiligencias(processId: string, nextDiligencias: Diligencia[]) {
    if (!supabase) return;
    setSaving(true);
    setMessage("");
    // Mantém o formato legado: a coluna diligencias recebe JSON serializado.
    const serialized = nextDiligencias.length ? JSON.stringify(nextDiligencias) : null;
    const { error } = await supabase.from("processos").update({ diligencias: serialized }).eq("id", processId);
    setSaving(false);
    if (error) {
      setMessage(`Não foi possível salvar a diligência: ${error.message}`);
      return;
    }
    setProcessos((current) => current.map((processo) =>
      String(processo.id) === processId ? { ...processo, diligencias: serialized } : processo,
    ));
    setDocumento("");
    setPrazo("");
    setResposta("");
    setMessage("Diligências do processo atualizadas.");
  }

  async function addDiligencia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const processId = selectedProcessId;
    const processo = processos.find((item) => String(item.id) === processId);
    if (!processo || !documento.trim() || !prazo) {
      setMessage("Selecione um processo e informe o documento solicitante e o prazo.");
      return;
    }
    const next = [...parseDiligencias(processo.diligencias), {
      doc_solicitante: documento.trim(),
      prazo_atendimento: prazo,
      data_resposta: resposta || "",
    }];
    await saveDiligencias(processId, next);
  }

  async function updateResposta(item: DiligenciaItem, value: string) {
    const processo = processos.find((entry) => String(entry.id) === item.processId);
    if (!processo) return;
    const next = parseDiligencias(processo.diligencias).map((diligencia, index) =>
      index === item.index ? { ...diligencia, data_resposta: value } : diligencia,
    );
    await saveDiligencias(item.processId, next);
  }

  async function removeDiligencia(item: DiligenciaItem) {
    const processo = processos.find((entry) => String(entry.id) === item.processId);
    if (!processo || !window.confirm(`Remover a diligência "${item.doc_solicitante}" do processo ${item.sei}?`)) return;
    const next = parseDiligencias(processo.diligencias).filter((_diligencia, index) => index !== item.index);
    await saveDiligencias(item.processId, next);
  }

  return (
    <main className="page">
      <header className="header">
        <div className="mark">SEAP</div>
        <div>
          <p className="eyebrow">Controle de processos correicionais</p>
          <h1>ControleSEAP</h1>
          <p className="muted">Módulo de diligências integrado aos processos</p>
        </div>
      </header>

      {!userEmail ? (
        <section className="panel auth-panel">
          <h2>Acesso institucional</h2>
          <p className="muted">Entre para consultar e administrar diligências associadas aos processos.</p>
          <div className="status"><span className={`dot ${health}`} /><span>API: {health === "checking" ? "verificando…" : health === "available" ? "disponível" : "indisponível"}</span></div>
          <form onSubmit={signIn}>
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit">Entrar</button>
          </form>
        </section>
      ) : (
        <>
          <section className="toolbar">
            <div><strong>Sessão:</strong> {userEmail}</div>
            <div className="toolbar-actions">
              <button type="button" className="secondary" onClick={() => void loadProcessos()} disabled={loading || saving}>Atualizar</button>
              <button type="button" className="secondary" onClick={() => void signOut()}>Sair</button>
            </div>
          </section>

          <section className="stats-grid" aria-label="Resumo de diligências pendentes">
            <article className="stat-card"><span>Dentro do prazo</span><strong>{onTimeCount}</strong></article>
            <article className="stat-card warning"><span>Próximas do vencimento (até {ALERT_DAYS} dias)</span><strong>{alertCount}</strong></article>
            <article className="stat-card danger"><span>Vencidas</span><strong>{overdueCount}</strong></article>
            <article className="stat-card"><span>Respondidas</span><strong>{answeredCount}</strong></article>
          </section>

          <section className="panel">
            <h2>Adicionar diligência a um processo</h2>
            <p className="muted">As diligências ficam vinculadas ao registro do processo, sem tabela independente.</p>
            <form className="diligencia-form" onSubmit={addDiligencia}>
              <div className="field wide">
                <label htmlFor="processo">Processo</label>
                <select id="processo" value={selectedProcessId} onChange={(e) => setSelectedProcessId(e.target.value)} required>
                  <option value="">Selecione…</option>
                  {processos.map((processo) => <option key={String(processo.id)} value={String(processo.id)}>{processo.sei || "Sem SEI"} — {processo.objeto || "Sem objeto"}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="documento">Documento solicitante</label>
                <input id="documento" value={documento} onChange={(e) => setDocumento(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="prazo">Prazo para atendimento</label>
                <input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="resposta">Data de resposta (opcional)</label>
                <input id="resposta" type="date" value={resposta} onChange={(e) => setResposta(e.target.value)} />
              </div>
              <button type="submit" disabled={saving || loading || !processos.length}>{saving ? "Salvando…" : "Adicionar diligência"}</button>
            </form>
          </section>

          <section className="panel">
            <div className="list-heading">
              <div><h2>Diligências</h2><p className="muted">{visibleItems.length} registro(s) exibido(s) de {items.length}</p></div>
              <input aria-label="Buscar diligências" className="search-input" placeholder="Buscar por SEI, objeto ou documento…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-tabs" role="group" aria-label="Filtrar diligências">
              <button type="button" className={filter === "pending" ? "active" : "secondary"} onClick={() => setFilter("pending")}>Pendentes ({pending.length})</button>
              <button type="button" className={filter === "answered" ? "active" : "secondary"} onClick={() => setFilter("answered")}>Respondidas ({answeredCount})</button>
              <button type="button" className={filter === "all" ? "active" : "secondary"} onClick={() => setFilter("all")}>Todas ({items.length})</button>
            </div>
            {loading ? <p className="muted">Carregando processos…</p> : visibleItems.length === 0 ? <p className="empty-state">Nenhuma diligência corresponde ao filtro atual.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Processo / SEI</th><th>Documento solicitante</th><th>Prazo</th><th>Situação</th><th>Data de resposta</th><th>Ações</th></tr></thead>
                  <tbody>
                    {visibleItems.map((item) => {
                      const state = getDeadlineState(item);
                      const label = state === "answered" ? "Respondida" : state === "overdue" ? `Vencida há ${Math.abs(item.daysLeft ?? 0)} dia(s)` : state === "alert" ? `Vence em ${item.daysLeft} dia(s)` : "Dentro do prazo";
                      return <tr key={`${item.processId}-${item.index}`}>
                        <td><strong>{item.sei}</strong><span className="table-subtitle">{item.objeto}</span></td>
                        <td>{item.doc_solicitante || "—"}</td>
                        <td>{formatDate(item.prazo_atendimento)}</td>
                        <td><span className={`status-pill ${state}`}>{label}</span></td>
                        <td><input aria-label={`Data de resposta: ${item.doc_solicitante}`} type="date" value={item.data_resposta || ""} disabled={saving} onChange={(e) => void updateResposta(item, e.target.value)} /></td>
                        <td><button type="button" className="danger-button" disabled={saving} onClick={() => void removeDiligencia(item)}>Remover</button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {message && <p role="status" className={message.includes("Não foi possível") ? "message error-message" : "message"}>{message}</p>}
      <footer>ControleSEAP — diligências associadas aos processos. O módulo depende das permissões RLS existentes no Supabase.</footer>
    </main>
  );
}
