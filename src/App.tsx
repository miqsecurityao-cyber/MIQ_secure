import { FormEvent, ReactNode, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

type View = "login" | "invite" | "recovery"
type Notice = { tone: "error" | "info" message: string } | null

function Logo() {
  return (
    <div className="brand" aria-label="MiQ Security">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-mark-cut" />
      </span>
      <span className="brand-copy">
        <strong>MIQ</strong>
        <small>SECURITY</small>
      </span>
    </div>
  )
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  icon,
  autoComplete,
  value,
  onChange,
  action,
  required = true,
}: {
  id: string
  label: string
  type?: string
  placeholder: string
  icon: ReactNode
  autoComplete?: string
  value: string
  onChange: (value: string) => void
  action?: ReactNode
  required?: boolean
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <span className="input-icon">{icon}</span>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
        />
        {action}
      </span>
    </label>
  )
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <div className={`notice notice-${notice.tone}`} role="status">
      <ShieldCheck size={18} />
      <span>{notice.message}</span>
    </div>
  )
}

function LoginView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setNotice(null)

    if (!email.trim() || !password) {
      setNotice({
        tone: "error",
        message: "Preencha o e-mail profissional e a palavra-passe.",
      })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice({
        tone: "error",
        message: "Introduza um endereço de e-mail válido.",
      })
      return
    }

    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      setNotice({
        tone: "info",
        message:
          "O serviço seguro de autenticação ainda não está configurado neste ambiente.",
      })
    }, 700)
  }

  return (
    <div className="form-content">
      <div className="eyebrow">
        <span className="status-dot" />
        Acesso reservado
      </div>
      <div className="form-heading">
        <h1>Iniciar sessão</h1>
        <p>Introduza os seus dados de acesso para continuar.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          id="email"
          label="E-mail profissional"
          type="email"
          placeholder="nome@miqsecurity.com"
          icon={<Mail size={19} />}
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <Field
          id="password"
          label="Palavra-passe"
          type={showPassword ? "text" : "password"}
          placeholder="Introduza a sua palavra-passe"
          icon={<LockKeyhole size={19} />}
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          action={
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={
                showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
              }
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          }
        />

        <div className="form-options">
          <label className="check-row">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span className="custom-check">
              {remember && <Check size={13} strokeWidth={3} />}
            </span>
            <span>Manter sessão iniciada</span>
          </label>
          <button
            className="text-button"
            type="button"
            onClick={() => onNavigate("recovery")}
          >
            Esqueceu-se da palavra-passe?
          </button>
        </div>

        <NoticeBox notice={notice} />

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle className="spinner" size={20} />A verificar...
            </>
          ) : (
            <>Iniciar sessão</>
          )}
        </button>
      </form>

      <div className="separator">
        <span />
        <em>ou</em>
        <span />
      </div>

      <div className="invite-callout">
        <div className="callout-icon"></div>
        <div>
          <strong>Tem um convite?</strong>
          <span>Active o seu acesso de forma segura.</span>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onNavigate("invite")}
        >
          Criar conta
        </button>
      </div>
    </div>
  )
}

function InviteView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [invite, setInvite] = useState("")
  const [notice, setNotice] = useState<Notice>(null)
  const [loading, setLoading] = useState(false)

  function validateInvite(event: FormEvent) {
    event.preventDefault()
    if (!invite.trim()) {
      setNotice({
        tone: "error",
        message: "Introduza o link ou código do convite.",
      })
      return
    }
    setLoading(true)
    setNotice(null)
    window.setTimeout(() => {
      setLoading(false)
      setNotice({
        tone: "info",
        message:
          "A validação de convites requer a ligação ao servidor seguro da MiQ.",
      })
    }, 700)
  }

  return (
    <div className="form-content">
      <button
        className="back-button"
        type="button"
        onClick={() => onNavigate("login")}
      >
        <ArrowLeft size={18} />
        Voltar ao login
      </button>
      <div className="feature-icon"></div>
      <div className="form-heading">
        <h1>Criar conta</h1>
        <p>
          Para aceder ao MIQ COMMERCIAL, precisa de um convite válido emitido
          pela MiQ Security.
        </p>
      </div>

      <div className="step-label">
        <span>1</span>
        Validar convite
      </div>

      <form onSubmit={validateInvite}>
        <Field
          id="invite"
          label="Link ou código do convite"
          placeholder="Cole aqui o convite recebido"
          icon={<KeyRound size={19} />}
          autoComplete="off"
          value={invite}
          onChange={setInvite}
        />
        <NoticeBox notice={notice} />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle className="spinner" size={20} />A validar...
            </>
          ) : (
            <>Validar convite</>
          )}
        </button>
      </form>

      <div className="security-note">
        <ShieldCheck size={20} />
        <p>
          <strong>Registo protegido</strong>O e-mail e o cargo estão associados
          ao convite e não podem ser alterados durante o registo.
        </p>
      </div>
    </div>
  )
}

function RecoveryView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [email, setEmail] = useState("")
  const [notice, setNotice] = useState<Notice>(null)

  function recover(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice({ tone: "error", message: "Introduza um e-mail válido." })
      return
    }
    setNotice({
      tone: "info",
      message:
        "Se a conta existir, receberá instruções quando o serviço de e-mail estiver configurado.",
    })
  }

  return (
    <div className="form-content">
      <button
        className="back-button"
        type="button"
        onClick={() => onNavigate("login")}
      >
        <ArrowLeft size={18} />
        Voltar ao login
      </button>
      <div className="feature-icon"></div>
      <div className="form-heading">
        <h1>Recuperar acesso</h1>
        <p>
          Introduza o seu e-mail profissional. Se a conta estiver activa,
          enviaremos instruções seguras.
        </p>
      </div>
      <form onSubmit={recover}>
        <Field
          id="recovery-email"
          label="E-mail profissional"
          type="email"
          placeholder="nome@miqsecurity.com"
          icon={<Mail size={19} />}
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <NoticeBox notice={notice} />
        <button className="primary-button" type="submit">
          Enviar instruções
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>("login")

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <div className="brand-top">
          <Logo />
          <span className="internal-pill">
            <LockKeyhole size={13} />
            Plataforma interna
          </span>
        </div>

        <div className="brand-message">
          <div className="brand-accent">
            <Sparkles size={16} />
            MIQ COMMERCIAL
          </div>
          <h2>
            O seu negócio.
            <br />
            <span>Sob controlo.</span>
          </h2>
          <p>
            Uma plataforma interna para gerir clientes, pedidos e orçamentos da
            MiQ Security, com mais organização, rapidez e controlo.
          </p>
        </div>

        <div className="brand-footer">
          <div className="security-line">
            <div></div>
          </div>
          <p>Tecnologia ao serviço de uma operação comercial mais eficiente.</p>
        </div>

        <div className="tech-grid" aria-hidden="true" />
        <div className="signal signal-one" aria-hidden="true" />
        <div className="signal signal-two" aria-hidden="true" />
      </section>

      <section className="form-panel">
        <div className="mobile-brand">
          <Logo />
          <span className="internal-pill">
            <LockKeyhole size={13} />
            Interno
          </span>
        </div>
        {view === "login" && <LoginView onNavigate={setView} />}
        {view === "invite" && <InviteView onNavigate={setView} />}
        {view === "recovery" && <RecoveryView onNavigate={setView} />}
        <p className="legal">
          © 2026 MiQ Security · Uso exclusivo de colaboradores autorizados
        </p>
      </section>
    </main>
  )
}
