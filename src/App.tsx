import { FormEvent, ReactNode, useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  BriefcaseBusiness,
  Ban,
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  CircleMinus,
  ClipboardCheck,
  FileText,
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Download,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"
import {
  isAuthorizedAdmin,
  isSupabaseConfigured,
  loadSupabaseRecords,
  saveSupabaseRecords,
  supabaseClient,
} from "./lib/supabase"
import type { Client, Quote, QuoteItem, Request, StoredData } from "./lib/supabase"

type View = "login" | "recovery" | "password-reset"
type Notice = { tone: "error" | "info"; message: string } | null

type QuoteLineDraft = {
  id: number
  description: string
  quantity: string
  unitPrice: string
}

type Section = "dashboard" | "requests" | "clients" | "quotes"
type FormType = "requests" | "quotes" | null

const storageKeys = {
  clients: "miq-commercial:clients:v1",
  requests: "miq-commercial:requests:v1",
  quotes: "miq-commercial:quotes:v1",
}

const sections: Section[] = ["dashboard", "requests", "clients", "quotes"]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isClient(value: unknown): value is Client {
  return isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.phone === "string" &&
    typeof value.createdAt === "string"
}

function isRequest(value: unknown): value is Request {
  return isObject(value) &&
    typeof value.id === "string" &&
    typeof value.client === "string" &&
    typeof value.service === "string" &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string" &&
    (value.diagnosticDate === undefined || typeof value.diagnosticDate === "string") &&
    (value.installationDate === undefined || typeof value.installationDate === "string")
}

function isQuote(value: unknown): value is Quote {
  return isObject(value) &&
    typeof value.id === "string" &&
    typeof value.client === "string" &&
    (value.clientId === undefined || typeof value.clientId === "string") &&
    (value.requestId === undefined || typeof value.requestId === "string") &&
    typeof value.service === "string" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string" &&
    (value.installationDate === undefined || typeof value.installationDate === "string") &&
    (value.items === undefined || (
      Array.isArray(value.items) &&
      value.items.every((item) =>
        isObject(item) &&
        typeof item.description === "string" &&
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        typeof item.unitPrice === "number" &&
        Number.isFinite(item.unitPrice) &&
        (item.category === "material" || item.category === "cost"),
      )
    ))
}

function readStoredRecords<T>(
  key: string,
  isRecord: (value: unknown) => value is T,
): { records: T[]; error?: string } {
  let serialized: string | null
  try {
    serialized = window.localStorage.getItem(key)
  } catch (error) {
    console.error(`Não foi possível ler ${key} do armazenamento local.`, error)
    return { records: [], error: "Não foi possível ler os registos guardados neste navegador." }
  }

  if (!serialized) return { records: [] }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    console.error(`Os dados guardados em ${key} não são JSON válido.`, error)
    return { records: [], error: "Há dados guardados inválidos. Os registos desta categoria não foram carregados." }
  }

  if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
    console.error(`Os dados guardados em ${key} não correspondem ao formato esperado.`)
    return { records: [], error: "Há dados guardados num formato inválido. Os registos desta categoria não foram carregados." }
  }

  return { records: parsed }
}

function loadStoredData(): StoredData {
  const clients = readStoredRecords(storageKeys.clients, isClient)
  const requests = readStoredRecords(storageKeys.requests, isRequest)
  const quotes = readStoredRecords(storageKeys.quotes, isQuote)
  return {
    clients: clients.records,
    requests: requests.records,
    quotes: quotes.records,
    errors: [clients.error, requests.error, quotes.error].filter(
      (error): error is string => Boolean(error),
    ),
  }
}

function getSectionFromHash(): Section {
  const section = window.location.hash.slice(1)
  return sections.find((id) => id === section) ?? "dashboard"
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(amount)

const dateFormatter = new Intl.DateTimeFormat("pt-AO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const formatDate = (date: string) => {
  let year: number
  let month: number
  let day: number
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)

  if (isoMatch) {
    year = Number(isoMatch[1])
    month = Number(isoMatch[2])
    day = Number(isoMatch[3])
  } else {
    const localizedMatch = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/.exec(date)
    if (!localizedMatch) return "Por agendar"

    const first = Number(localizedMatch[1])
    const second = Number(localizedMatch[2])
    year = Number(localizedMatch[3])
    month = first <= 12 && second > 12 ? first : second
    day = first <= 12 && second > 12 ? second : first
  }

  const parsedDate = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return "Por agendar"
  }
  return dateFormatter.format(parsedDate)
}

function parseDisplayDate(date: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  if (!match) return undefined

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const parsedDate = new Date(year, month - 1, day)
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return undefined
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function DateInput({
  value,
  onChange,
  required = false,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
  ariaLabel: string
}) {
  const [displayValue, setDisplayValue] = useState(value ? formatDate(value) : "")
  const textInputRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayValue(value ? formatDate(value) : "")
  }, [value])

  function updateFromText(nextValue: string) {
    setDisplayValue(nextValue)
    const parsedDate = parseDisplayDate(nextValue)
    textInputRef.current?.setCustomValidity(
      nextValue && !parsedDate ? "Use o formato DD/MM/AAAA com uma data válida." : "",
    )
    if (parsedDate) onChange(parsedDate)
    else if (!nextValue) onChange("")
  }

  return (
    <span className="date-input-control">
      <input
        ref={textInputRef}
        className={className}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        aria-label={ariaLabel}
        value={displayValue}
        onChange={(event) => updateFromText(event.target.value)}
        required={required}
      />
      <button
        className="date-picker-button"
        type="button"
        aria-label={`Abrir calendário — ${ariaLabel}`}
        onClick={() => pickerRef.current?.showPicker()}
      >
        <CalendarDays size={15} aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        className="date-picker-native"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        onChange={(event) => {
          textInputRef.current?.setCustomValidity("")
          onChange(event.target.value)
        }}
      />
    </span>
  )
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand${inverse ? " brand-inverse" : ""}`} role="img" aria-label="MiQ Security">
      <svg className="brand-logo" viewBox="0 0 230 104" aria-hidden="true">
        <text className="brand-logo-m" x="0" y="66">M</text>
        <rect className="brand-logo-i" x="75" y="35" width="18" height="31" rx="9" />
        <circle className="brand-logo-accent" cx="84" cy="22" r="9" />
        <text className="brand-logo-q" x="95" y="66">O</text>
        <path className="brand-logo-q-accent" d="m143 55 22 18" />
        <text className="brand-logo-security" x="3" y="101">Security</text>
      </svg>
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

function LoginView({
  onNavigate,
  onAuthenticated,
}: {
  onNavigate: (view: View) => void
  onAuthenticated: (email: string, password: string) => Promise<string | null>
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  async function handleSubmit(event: FormEvent) {
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
    try {
      const error = await onAuthenticated(email.trim(), password)
      if (error) {
        setNotice({ tone: "error", message: error })
      }
    } catch (error) {
      console.error("Não foi possível iniciar sessão.", error)
      setNotice({
        tone: "error",
        message: "Não foi possível iniciar sessão. Tente novamente.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-content">
      <div className="eyebrow">
        <span className="status-dot" />
        Acesso exclusivo ao administrador
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

    </div>
  )
}

function RecoveryView({
  onNavigate,
  onRecover,
}: {
  onNavigate: (view: View) => void
  onRecover: (email: string) => Promise<string | null>
}) {
  const [email, setEmail] = useState("")
  const [notice, setNotice] = useState<Notice>(null)
  const [loading, setLoading] = useState(false)

  async function recover(event: FormEvent) {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice({ tone: "error", message: "Introduza um e-mail válido." })
      return
    }
    setLoading(true)
    try {
      const error = await onRecover(email.trim())
      setNotice(error
        ? { tone: "error", message: error }
        : { tone: "info", message: "Se a conta existir, receberá um e-mail com instruções para redefinir a palavra-passe." })
    } catch (error) {
      console.error("Não foi possível solicitar a recuperação da palavra-passe.", error)
      setNotice({ tone: "error", message: "Não foi possível enviar o e-mail de recuperação. Tente novamente." })
    } finally {
      setLoading(false)
    }
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
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "A enviar..." : "Enviar instruções"}
        </button>
      </form>
    </div>
  )
}

function PasswordResetView({
  onNavigate,
  onUpdatePassword,
}: {
  onNavigate: (view: View) => void
  onUpdatePassword: (password: string) => Promise<string | null>
}) {
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [notice, setNotice] = useState<Notice>(null)
  const [loading, setLoading] = useState(false)

  async function updatePassword(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setNotice({ tone: "error", message: "A palavra-passe deve ter pelo menos 8 caracteres." })
      return
    }
    if (password !== confirmation) {
      setNotice({ tone: "error", message: "As palavras-passe não coincidem." })
      return
    }

    setLoading(true)
    try {
      const error = await onUpdatePassword(password)
      if (error) setNotice({ tone: "error", message: error })
    } catch (error) {
      console.error("Não foi possível guardar a nova palavra-passe.", error)
      setNotice({ tone: "error", message: "Não foi possível atualizar a palavra-passe. Solicite um novo link." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-content">
      <div className="feature-icon"></div>
      <div className="form-heading">
        <h1>Definir nova palavra-passe</h1>
        <p>Escolha uma palavra-passe nova para a conta administrativa.</p>
      </div>
      <form onSubmit={updatePassword}>
        <Field
          id="new-password"
          label="Nova palavra-passe"
          type="password"
          placeholder="Pelo menos 8 caracteres"
          icon={<LockKeyhole size={19} />}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <Field
          id="confirm-password"
          label="Confirmar palavra-passe"
          type="password"
          placeholder="Repita a nova palavra-passe"
          icon={<LockKeyhole size={19} />}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
        />
        <NoticeBox notice={notice} />
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "A atualizar..." : "Guardar nova palavra-passe"}
        </button>
      </form>
      <button className="back-button" type="button" onClick={() => onNavigate("login")}>
        <ArrowLeft size={18} />
        Voltar ao login
      </button>
    </div>
  )
}

function DashboardView({
  onExit,
  initialData,
}: {
  onExit: () => void
  initialData: StoredData
}) {
  const storedData = initialData
  const [search, setSearch] = useState("")
  const [notice, setNotice] = useState<string | null>(
    storedData.errors.length > 0
      ? [...new Set(storedData.errors)].join(" ")
      : null,
  )
  const [requests, setRequests] = useState<Request[]>(initialData.requests)
  const [clients] = useState<Client[]>(initialData.clients)
  const [quotes, setQuotes] = useState<Quote[]>(initialData.quotes)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [isDownloadingQuote, setIsDownloadingQuote] = useState(false)
  const quoteDocumentRef = useRef<HTMLElement | null>(null)
  const [formType, setFormType] = useState<FormType>(null)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)
  const [requestClient, setRequestClient] = useState("")
  const [requestService, setRequestService] = useState("")
  const [requestDiagnosticDate, setRequestDiagnosticDate] = useState("")
  const [requestInstallationDate, setRequestInstallationDate] = useState("")
  const [requestStatus, setRequestStatus] = useState("Diagnóstico agendado")
  const [quoteClient, setQuoteClient] = useState("")
  const [quoteService, setQuoteService] = useState("")
  const [quoteMaterials, setQuoteMaterials] = useState<QuoteLineDraft[]>([])
  const [quoteInstallationCost, setQuoteInstallationCost] = useState("")
  const [quoteTransportCost, setQuoteTransportCost] = useState("")
  const [quoteAdditionalCosts, setQuoteAdditionalCosts] = useState<QuoteLineDraft[]>([])
  const [quoteAssociation, setQuoteAssociation] = useState("")
  const nextQuoteLineId = useRef(0)
  const [activeSection, setActiveSection] = useState<Section>(getSectionFromHash)
  const skipInitialPersistence = useRef(true)
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve())
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-AO")
  const matchingRequests = requests.filter((request) =>
    `${request.id} ${request.client} ${request.service} ${request.status} ${request.diagnosticDate ?? ""}`
      .toLocaleLowerCase("pt-AO")
      .includes(normalizedSearch),
  )
  const clientRequests = requests
  const matchingClientRequests = clientRequests.filter((request) =>
    `${request.id} ${request.client} ${request.service} ${request.status} ${request.installationDate ?? ""}`
      .toLocaleLowerCase("pt-AO")
      .includes(normalizedSearch),
  )
  const scheduledInstallations = clientRequests.filter((request) => request.installationDate).length
  const awaitingInstallation = clientRequests.length - scheduledInstallations
  const matchingQuotes = quotes.filter((quote) =>
    `${quote.id} ${quote.client} ${quote.service} ${quote.status}`
      .toLocaleLowerCase("pt-AO")
      .includes(normalizedSearch),
  )
  const quoteStatusSummary = [
    { label: "Total de orçamentos", count: quotes.length, tone: "total" },
    {
      label: "A aguardar resposta",
      count: quotes.filter((quote) => quote.status === "Rascunho" || quote.status === "Enviado").length,
      tone: "pending",
    },
    {
      label: "Aceites pelo cliente",
      count: quotes.filter((quote) => quote.status === "Aprovado").length,
      tone: "approved",
    },
    {
      label: "Recusados",
      count: quotes.filter((quote) => quote.status === "Recusado").length,
      tone: "rejected",
    },
  ]
  const quoteMaterialsTotal = quoteMaterials.reduce(
    (total, item) => total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  )
  const quoteAdditionalCostsTotal = quoteAdditionalCosts.reduce(
    (total, item) => total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  )
  const quoteDraftTotal =
    quoteMaterialsTotal +
    (Number(quoteInstallationCost) || 0) +
    (Number(quoteTransportCost) || 0) +
    quoteAdditionalCostsTotal
  const scheduledDiagnostics = requests.filter(
    (request) => request.status === "Diagnóstico agendado" && request.diagnosticDate,
  )
  const scheduledInstallationsList = requests.filter(
    (request) => request.status === "Instalação agendada" && request.installationDate,
  )
  const completedInstallations = requests.filter((request) => request.status === "Concluído")
  const serviceSchedulePanels = [
    {
      title: "Diagnósticos agendados",
      icon: <CalendarDays size={17} />,
      tone: "diagnostic",
      requests: scheduledDiagnostics,
      getDate: (request: Request) => request.diagnosticDate,
      emptyMessage: "Não há diagnósticos agendados.",
    },
    {
      title: "Instalações agendadas",
      icon: <ClipboardCheck size={17} />,
      tone: "scheduled",
      requests: scheduledInstallationsList,
      getDate: (request: Request) => request.installationDate,
      emptyMessage: "Não há instalações agendadas.",
      canComplete: true,
    },
    {
      title: "Instalações concluídas",
      icon: <CheckCircle2 size={17} />,
      tone: "completed",
      requests: completedInstallations,
      getDate: (request: Request) => request.installationDate,
      emptyMessage: "Ainda não há instalações concluídas.",
    },
  ]
  const navigation: { id: Section; label: string; icon: ReactNode }[] = [
    { id: "dashboard", label: "Visão geral", icon: <LayoutDashboard size={18} /> },
    { id: "requests", label: "Pedidos", icon: <BriefcaseBusiness size={18} /> },
    { id: "clients", label: "Clientes", icon: <Users size={18} /> },
    { id: "quotes", label: "Orçamentos", icon: <FileText size={18} /> },
  ]

  const sectionLabels: Record<Section, string> = {
    dashboard: "Visão geral",
    requests: "Pedidos",
    clients: "Clientes",
    quotes: "Orçamentos",
  }

  function createQuoteLine(): QuoteLineDraft {
    return {
      id: nextQuoteLineId.current++,
      description: "",
      quantity: "1",
      unitPrice: "",
    }
  }

  function openForm(type: Exclude<FormType, null>) {
    setEditingRequestId(null)
    setEditingQuoteId(null)
    setRequestClient("")
    setRequestService("")
    setRequestDiagnosticDate("")
    setRequestInstallationDate("")
    setRequestStatus("Diagnóstico agendado")
    setQuoteClient("")
    setQuoteService("")
    setQuoteMaterials([])
    setQuoteInstallationCost("")
    setQuoteTransportCost("")
    setQuoteAdditionalCosts([])
    setQuoteAssociation("")
    setFormType(type)
  }

  function openRequestEditor(request: Request) {
    setEditingRequestId(request.id)
    setEditingQuoteId(null)
    setRequestClient(request.client)
    setRequestService(request.service)
    setRequestDiagnosticDate(request.diagnosticDate ?? "")
    setRequestInstallationDate(request.installationDate ?? "")
    setRequestStatus(request.status)
    setFormType("requests")
  }

  function openQuoteEditor(quote: Quote) {
    const items = quote.items?.length
      ? quote.items
      : quote.amount > 0
        ? [{
            description: quote.service,
            quantity: 1,
            unitPrice: quote.amount,
            category: "material" as const,
          }]
        : []
    const installationItem = items.find(
      (item) =>
        item.category === "cost" &&
        item.description.toLocaleLowerCase("pt-AO") === "instalação" &&
        item.quantity === 1,
    )
    const transportItem = items.find(
      (item) =>
        item.category === "cost" &&
        item.description.toLocaleLowerCase("pt-AO") === "transporte" &&
        item.quantity === 1,
    )
    const association = quote.requestId && requests.some((request) => request.id === quote.requestId)
      ? `request:${quote.requestId}`
      : quote.clientId && clients.some((client) => client.id === quote.clientId)
        ? `client:${quote.clientId}`
        : ""

    setEditingRequestId(null)
    setEditingQuoteId(quote.id)
    setQuoteClient(quote.client)
    setQuoteService(quote.service)
    setQuoteAssociation(association)
    setQuoteMaterials(items
      .filter((item) => item.category === "material")
      .map((item) => ({
        id: nextQuoteLineId.current++,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })))
    setQuoteInstallationCost(installationItem ? String(installationItem.unitPrice) : "")
    setQuoteTransportCost(transportItem ? String(transportItem.unitPrice) : "")
    setQuoteAdditionalCosts(items
      .filter((item) => item.category === "cost" && item !== installationItem && item !== transportItem)
      .map((item) => ({
        id: nextQuoteLineId.current++,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
      })))
    setFormType("quotes")
  }

  function changeRequestStatus(request: Request, status: string) {
    if (status === "Diagnóstico agendado" && !request.diagnosticDate) {
      setNotice("Defina a data do diagnóstico antes de selecionar o estado agendado.")
      return
    }
    if (status === "Cancelado" && !window.confirm(`Cancelar o pedido ${request.id}? O agendamento de diagnóstico ou instalação também será removido.`)) {
      return
    }

    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? {
              ...item,
              status,
              ...(status === "Cancelado"
                ? { diagnosticDate: undefined, installationDate: undefined }
                : status === "Diagnóstico por agendar"
                  ? { diagnosticDate: undefined }
                : {}),
            }
          : item,
      ),
    )
    if (status === "Cancelado") {
      setQuotes((current) =>
        current.map((quote) =>
          quote.requestId === request.id ? { ...quote, installationDate: undefined } : quote,
        ),
      )
    }
    setNotice(`Estado do pedido ${request.id} atualizado para "${status}".`)
  }

  function cancelRequest(request: Request) {
    if (!window.confirm(`Tem a certeza de que pretende cancelar o pedido ${request.id}?`)) return

    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? { ...item, status: "Cancelado", diagnosticDate: undefined, installationDate: undefined }
          : item,
      ),
    )
    setQuotes((current) =>
      current.map((quote) =>
        quote.requestId === request.id ? { ...quote, installationDate: undefined } : quote,
      ),
    )
    setNotice(`Pedido ${request.id} cancelado. Os agendamentos associados foram removidos.`)
  }

  function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const today = dateFormatter.format(new Date())
    const year = new Date().getFullYear()

    if (formType === "requests") {
      if (editingRequestId) {
        const existingRequest = requests.find((request) => request.id === editingRequestId)
        if (!existingRequest) {
          setNotice("Não foi possível editar o pedido porque já não existe.")
          return
        }
        if (requestStatus === "Diagnóstico agendado" && !requestDiagnosticDate) {
          setNotice("Defina a data do diagnóstico antes de selecionar esse estado.")
          return
        }
        if (requestStatus === "Instalação agendada" && !requestInstallationDate) {
          setNotice("Defina a data da instalação antes de selecionar esse estado.")
          return
        }

        const isCancelled = requestStatus === "Cancelado"
        const isInstallationScheduled = requestStatus === "Instalação agendada"
        const isDiagnosticPending = requestStatus === "Diagnóstico por agendar"
        const isDiagnosticComplete = requestStatus === "Diagnóstico concluído"
        const isCompleted = requestStatus === "Concluído"
        const updatedRequest: Request = {
          ...existingRequest,
          client: requestClient.trim(),
          service: requestService.trim(),
          status: isCancelled
            ? "Cancelado"
            : isInstallationScheduled
              ? "Instalação agendada"
              : isDiagnosticPending
                ? "Diagnóstico por agendar"
                : isDiagnosticComplete
                  ? "Diagnóstico concluído"
                  : isCompleted
                    ? "Concluído"
                    : "Diagnóstico agendado",
          diagnosticDate: isCancelled || isDiagnosticPending || isDiagnosticComplete || isInstallationScheduled || isCompleted
            ? undefined
            : requestDiagnosticDate || undefined,
          installationDate: isCancelled ||
            isDiagnosticPending ||
            isDiagnosticComplete ||
            requestStatus === "Diagnóstico agendado"
            ? undefined
            : requestInstallationDate || undefined,
        }
        setRequests((current) =>
          current.map((request) => request.id === editingRequestId ? updatedRequest : request),
        )
        setQuotes((current) =>
          current.map((quote) =>
            quote.requestId === editingRequestId
              ? {
                  ...quote,
                  client: updatedRequest.client,
                  service: updatedRequest.service,
                  installationDate: updatedRequest.installationDate,
                }
              : quote,
          ),
        )
        setNotice(`Pedido ${editingRequestId} atualizado.`)
      } else {
      const nextNumber = requests.length + 1
      setRequests((current) => [
        {
          id: `PED-${year}-${String(nextNumber).padStart(3, "0")}`,
          client: requestClient.trim(),
          service: requestService.trim(),
          status: "Diagnóstico agendado",
          createdAt: today,
          diagnosticDate: requestDiagnosticDate,
        },
        ...current,
      ])
      setNotice("Pedido guardado neste navegador.")
      }
    } else if (formType === "quotes") {
      function getCompletedItems(
        items: QuoteLineDraft[],
        category: QuoteItem["category"],
      ): QuoteItem[] | null {
        const completed: QuoteItem[] = []
        for (const item of items) {
          const isBlank =
            !item.description.trim() &&
            !item.unitPrice &&
            (!item.quantity || item.quantity === "1")
          if (isBlank) continue

          const quantity = Number(item.quantity)
          const unitPrice = Number(item.unitPrice)
          if (
            !item.description.trim() ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !item.unitPrice ||
            !Number.isFinite(unitPrice) ||
            unitPrice < 0
          ) {
            return null
          }
          completed.push({
            description: item.description.trim(),
            quantity,
            unitPrice,
            category,
          })
        }
        return completed
      }

      const materials = getCompletedItems(quoteMaterials, "material")
      const additionalCosts = getCompletedItems(quoteAdditionalCosts, "cost")
      const installationCost = Number(quoteInstallationCost) || 0
      const transportCost = Number(quoteTransportCost) || 0
      if (!materials || !additionalCosts || installationCost < 0 || transportCost < 0) {
        setNotice("Preencha a descrição, quantidade e custo unitário de cada linha, e use valores iguais ou superiores a zero.")
        return
      }

      const items: QuoteItem[] = [
        ...materials,
        ...(installationCost > 0
          ? [{ description: "Instalação", quantity: 1, unitPrice: installationCost, category: "cost" as const }]
          : []),
        ...(transportCost > 0
          ? [{ description: "Transporte", quantity: 1, unitPrice: transportCost, category: "cost" as const }]
          : []),
        ...additionalCosts,
      ]
      const amount = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
      if (amount <= 0) {
        setNotice("Adicione pelo menos um material ou custo com valor superior a zero.")
        return
      }

      const existingQuote = editingQuoteId
        ? quotes.find((quote) => quote.id === editingQuoteId)
        : undefined
      if (editingQuoteId && !existingQuote) {
        setNotice("Não foi possível editar o orçamento porque já não existe.")
        return
      }

      const [associationType, associationId] = quoteAssociation.split(":")
      const quote: Quote = {
        id: existingQuote?.id ?? `ORC-${year}-${String(quotes.length + 1).padStart(3, "0")}`,
        client: quoteClient.trim(),
        clientId: associationType === "client" ? associationId : undefined,
        requestId: associationType === "request" ? associationId : undefined,
        service: quoteService.trim(),
        amount,
        status: existingQuote?.status ?? "Rascunho",
        createdAt: existingQuote?.createdAt ?? today,
        installationDate: existingQuote?.installationDate,
        items,
      }
      if (existingQuote) {
        setQuotes((current) => current.map((item) => item.id === quote.id ? quote : item))
        setNotice(`Orçamento ${quote.id} atualizado.`)
      } else {
        setQuotes((current) => [quote, ...current])
        setSelectedQuote(quote)
        setNotice("Orçamento criado. Pode imprimir ou guardar como PDF.")
      }
    }

    setSearch("")
    setFormType(null)
    setEditingQuoteId(null)
  }

  async function downloadSelectedQuote() {
    if (!selectedQuote || !quoteDocumentRef.current || isDownloadingQuote) return

    setIsDownloadingQuote(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ])
      await document.fonts.ready
      const canvas = await html2canvas(quoteDocumentRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 12
      const contentWidth = pageWidth - margin * 2
      const contentHeight = pageHeight - margin * 2
      const sourcePageHeight = Math.max(1, Math.floor(canvas.width * contentHeight / contentWidth))
      const pageCount = Math.ceil(canvas.height / sourcePageHeight)

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const sourceY = pageIndex * sourcePageHeight
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY)
        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const context = pageCanvas.getContext("2d")
        if (!context) throw new Error("Não foi possível preparar a imagem da página do orçamento.")
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)

        if (pageIndex > 0) pdf.addPage()
        const imageHeight = sliceHeight * contentWidth / canvas.width
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.96),
          "JPEG",
          margin,
          margin,
          contentWidth,
          imageHeight,
          undefined,
          "FAST",
        )
      }

      pdf.save(`${selectedQuote.id}.pdf`)
      setNotice(`PDF do orçamento ${selectedQuote.id} descarregado com o design da aplicação.`)
    } catch (error) {
      console.error(`Não foi possível descarregar o PDF do orçamento ${selectedQuote.id}.`, error)
      setNotice(`Não foi possível descarregar o PDF do orçamento ${selectedQuote.id}. Tente novamente.`)
    } finally {
      setIsDownloadingQuote(false)
    }
  }

  useEffect(() => {
    function syncSectionFromHash() {
      setActiveSection(getSectionFromHash())
      setSearch("")
    }

    window.addEventListener("hashchange", syncSectionFromHash)
    return () => window.removeEventListener("hashchange", syncSectionFromHash)
  }, [])

  useEffect(() => {
    if (skipInitialPersistence.current) {
      skipInitialPersistence.current = false
      return
    }

    if (isSupabaseConfigured()) {
      const currentData = { clients, requests, quotes }
      persistenceQueue.current = persistenceQueue.current
        .then(() => saveSupabaseRecords(currentData))
        .catch((error: unknown) => {
          console.error("Não foi possível guardar os registos no Supabase.", error)
          setNotice("Não foi possível guardar os dados na base de dados. Verifique a ligação e tente novamente.")
        })
      return
    }

    const records: [string, unknown][] = [
      [storageKeys.clients, clients],
      [storageKeys.requests, requests],
      [storageKeys.quotes, quotes],
    ]

    for (const [key, value] of records) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
      } catch (error) {
        console.error(`Não foi possível guardar os registos em ${key}.`, error)
        setNotice("Não foi possível guardar os dados neste navegador. Verifique o espaço disponível e as permissões.")
      }
    }
  }, [clients, requests, quotes])

  return (
    <main className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <a
          className="dashboard-brand"
          href="#dashboard"
          aria-label="MIQ Security — início"
          onClick={() => setActiveSection("dashboard")}
        >
          <Logo />
        </a>

        <div className="sidebar-caption">ESPAÇO COMERCIAL</div>
        <nav className="dashboard-nav" aria-label="Navegação principal">
          {navigation.map((item) => (
            <a
              className={`dashboard-nav-link${activeSection === item.id ? " active" : ""}`}
              href={`#${item.id}`}
              key={item.id}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => {
                setActiveSection(item.id)
                setSearch("")
                setNotice(null)
              }}
            >
              {item.icon} {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <div className="user-avatar">MIQ</div>
            <div>
              <strong>Admin</strong>
              <span>Espaço comercial</span>
            </div>
          </div>
          <button className="sidebar-exit" type="button" onClick={onExit}>
            <LogOut size={16} /> Terminar sessão
          </button>
        </div>
      </aside>

      <section className="dashboard-main" id="dashboard">
        <header className="dashboard-topbar">
          <div className="dashboard-breadcrumb">MIQ COMMERCIAL <span>/</span> {sectionLabels[activeSection]}</div>
          <button className="dashboard-mobile-exit" type="button" onClick={onExit}>
            <LogOut size={15} /> Terminar sessão
          </button>
          {activeSection !== "dashboard" && <div className="dashboard-top-actions">
            <label className="dashboard-search">
              <Search size={17} />
              <input
                aria-label={`Pesquisar ${sectionLabels[activeSection].toLocaleLowerCase("pt-AO")}`}
                placeholder={`Pesquisar ${sectionLabels[activeSection].toLocaleLowerCase("pt-AO")}`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>}
        </header>

        <div className="dashboard-content">
          {notice && (
            <div className="dashboard-toast" role="status">
              {notice}
              <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button>
            </div>
          )}

          {activeSection === "dashboard" && (
            <section className="service-dashboard" aria-labelledby="service-dashboard-title">
                <header className="service-dashboard-heading">
                  <div>
                    <span className="service-dashboard-eyebrow">ESPAÇO COMERCIAL</span>
                  <h1 id="service-dashboard-title">Agenda de serviços</h1>
                    <p>Acompanhe os compromissos e o progresso das instalações.</p>
                  </div>
                  <button className="dashboard-primary-button" type="button" onClick={() => openForm("requests")}>
                    <CirclePlus size={16} /> Novo pedido
                  </button>
                </header>
                <div className="service-dashboard-grid">
                  {serviceSchedulePanels.map((panel) => (
                    <section className={`dashboard-panel service-dashboard-card service-dashboard-card-${panel.tone}`} key={panel.title}>
                      <div className="service-dashboard-card-heading">
                        <span className="service-dashboard-icon" aria-hidden="true">{panel.icon}</span>
                        <span className="service-dashboard-count" aria-label={`${panel.requests.length} pedidos`}>
                          {panel.requests.length}
                        </span>
                      </div>
                      <h2>{panel.title}</h2>
                      {panel.requests.length > 0 ? (
                        <ul className="service-dashboard-list">
                          {panel.requests.slice(0, 5).map((request) => {
                            const serviceDate = panel.getDate(request)
                            return (
                              <li key={request.id}>
                                <div>
                                  <strong>{request.client}</strong>
                                  <span>{request.id} · {request.service}</span>
                                </div>
                                <time dateTime={serviceDate}>{serviceDate ? formatDate(serviceDate) : "—"}</time>
                                {panel.canComplete && (
                                  <button
                                    className="service-complete-button"
                                    type="button"
                                    onClick={() => {
                                      setRequests((current) =>
                                        current.map((item) =>
                                          item.id === request.id
                                            ? { ...item, status: "Concluído" }
                                            : item,
                                        ),
                                      )
                                      setNotice(`Instalação do pedido ${request.id} marcada como concluída.`)
                                    }}
                                  >
                                    Concluir
                                  </button>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="service-dashboard-empty">{panel.emptyMessage}</p>
                      )}
                      <a className="service-dashboard-link" href="#requests">
                        Ver pedidos <span aria-hidden="true">→</span>
                      </a>
                    </section>
                  ))}
                </div>
            </section>
          )}

          {activeSection === "requests" && (
            <section className="dashboard-panel quotes-panel" id="requests">
              <div className="panel-heading quotes-heading">
                <div><h2>Pedidos</h2><p>Registe o cliente, o serviço e a data agendada para o diagnóstico.</p></div>
                <button className="dashboard-primary-button" type="button" onClick={() => openForm("requests")}>
                  <CirclePlus size={17} /> Novo pedido
                </button>
              </div>
              <div className="quotes-table-wrap">
                <table className="quotes-table">
                  <thead><tr><th>REFERÊNCIA</th><th>CLIENTE</th><th>TIPO DE PEDIDO / SERVIÇO</th><th>ESTADO / ALTERAR</th><th>DATA DO DIAGNÓSTICO</th><th>REGISTADO</th><th>AÇÕES</th></tr></thead>
                  <tbody>
                    {matchingRequests.map((request) => (
                      <tr key={request.id}>
                        <td className="quote-id">{request.id}</td>
                        <td className="quote-client">{request.client}</td>
                        <td>{request.service}</td>
                        <td>
                          <select
                            className={`quote-status-control ${["Diagnóstico concluído", "Instalação agendada", "Concluído"].includes(request.status) ? "approved" : "pending"}`}
                            aria-label={`Estado do pedido ${request.id}`}
                            value={request.status}
                            disabled={Boolean(request.installationDate)}
                            onChange={(event) => {
                              const status = event.target.value
                              changeRequestStatus(request, status)
                            }}
                          >
                            {!["Diagnóstico agendado", "Diagnóstico por agendar", "Diagnóstico concluído", "Instalação agendada", "Concluído", "Cancelado"].includes(request.status) && (
                              <option value={request.status}>{request.status}</option>
                            )}
                            <option value="Diagnóstico agendado">Diagnóstico agendado</option>
                            <option value="Diagnóstico por agendar">Diagnóstico por agendar</option>
                            <option value="Diagnóstico concluído">Diagnóstico concluído</option>
                            <option value="Instalação agendada" disabled>Instalação agendada — definida no agendamento</option>
                            <option value="Concluído" disabled>Concluído</option>
                            <option value="Cancelado">Cancelado</option>
                          </select>
                        </td>
                        <td className="request-diagnostic-date">
                          {["Diagnóstico agendado", "Diagnóstico por agendar"].includes(request.status) ? (
                            <div className="request-diagnostic-schedule">
                              <DateInput
                                className="installation-date-input"
                                ariaLabel={`Data do diagnóstico do pedido ${request.id}`}
                                value={request.diagnosticDate ?? ""}
                                onChange={(date) => {
                                  setRequests((current) =>
                                    current.map((item) =>
                                      item.id === request.id
                                        ? {
                                            ...item,
                                            diagnosticDate: date || undefined,
                                            status: date ? "Diagnóstico agendado" : "Diagnóstico por agendar",
                                          }
                                        : item,
                                    ),
                                  )
                                  setNotice(
                                    date
                                      ? `Diagnóstico do pedido ${request.id} agendado para ${formatDate(date)}.`
                                      : `Agendamento do diagnóstico do pedido ${request.id} removido.`,
                                  )
                                }}
                              />
                              {request.status === "Diagnóstico agendado" && request.diagnosticDate && (
                                <button
                                  className="cancel-diagnostic-button"
                                  type="button"
                                  onClick={() => {
                                    setRequests((current) =>
                                      current.map((item) =>
                                        item.id === request.id
                                          ? {
                                              ...item,
                                              diagnosticDate: undefined,
                                              status: "Diagnóstico por agendar",
                                            }
                                          : item,
                                      ),
                                    )
                                    setNotice(`Agendamento do diagnóstico do pedido ${request.id} cancelado. O pedido continua aberto para reagendamento.`)
                                  }}
                                >
                                  Cancelar agendamento
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="quote-time">
                              {request.diagnosticDate ? formatDate(request.diagnosticDate) : "Por agendar"}
                            </span>
                          )}
                        </td>
                        <td className="quote-time">{formatDate(request.createdAt)}</td>
                        <td>
                          <div className="request-actions">
                            <button
                              className="request-action-button"
                              type="button"
                              onClick={() => openRequestEditor(request)}
                              aria-label={`Editar pedido ${request.id}`}
                            >
                              <Pencil size={13} /> Editar
                            </button>
                            {request.status !== "Cancelado" && request.status !== "Concluído" && (
                              <button
                                className="request-action-button request-action-cancel"
                                type="button"
                                onClick={() => cancelRequest(request)}
                                aria-label={`Cancelar pedido ${request.id}`}
                              >
                                <Ban size={13} /> Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {matchingRequests.length === 0 && <tr><td className="empty-search" colSpan={7}>{requests.length === 0 ? "Ainda não existem pedidos." : "Nenhum pedido corresponde à pesquisa."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeSection === "clients" && (
            <section className="clients-section" id="clients">
              <div className="panel-heading clients-heading">
                <div>
                  <h2>Agendamento de serviços</h2>
                  <p>Escolha o pedido do cliente e marque o dia da instalação ou execução. O estado do pedido é atualizado automaticamente.</p>
                </div>
              </div>
              <div className="client-status-summary">
                <article className="client-status-card">
                  <span className="quote-status approved">Serviços agendados</span>
                  <strong>{scheduledInstallations}</strong>
                </article>
                <article className="client-status-card">
                  <span className="quote-status pending">A aguardar agendamento</span>
                  <strong>{awaitingInstallation}</strong>
                </article>
              </div>
              <section className="dashboard-panel quotes-panel">
                <div className="quotes-table-wrap">
                  <table className="quotes-table">
                    <thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>SERVIÇO</th><th>DIA DA IMPLEMENTAÇÃO / INSTALAÇÃO</th><th>ESTADO</th><th>AÇÕES</th></tr></thead>
                    <tbody>
                      {matchingClientRequests.map((request) => (
                          <tr key={request.id}>
                            <td className="quote-id">{request.id}</td>
                            <td className="quote-client">{request.client}</td>
                            <td>{request.service}</td>
                            <td>
                              <DateInput
                                className="installation-date-input"
                                ariaLabel={`Data da instalação ou execução do pedido ${request.id}`}
                                value={request.installationDate ?? ""}
                                onChange={(date) => {
                                  const installationDate = date || undefined
                                  setRequests((current) =>
                                    current.map((item) => {
                                      if (item.id !== request.id) return item
                                      if (installationDate) {
                                        return {
                                          ...item,
                                          installationDate,
                                          status: "Instalação agendada",
                                        }
                                      }
                                      return {
                                        ...item,
                                        installationDate: undefined,
                                        status: item.status === "Instalação agendada"
                                          ? "Diagnóstico concluído"
                                          : item.status,
                                      }
                                    }),
                                  )
                                  setQuotes((current) =>
                                    current.map((quote) =>
                                      quote.requestId === request.id
                                        ? { ...quote, installationDate }
                                        : quote,
                                    ),
                                  )
                                  setNotice(
                                    installationDate
                                      ? `Data da instalação/execução do pedido ${request.id} agendada. Estado atualizado automaticamente.`
                                      : `Agendamento do pedido ${request.id} removido.`,
                                  )
                                }}
                              />
                            </td>
                            <td>
                              <span className={`quote-status ${request.installationDate ? "approved" : "pending"}`}>
                                {request.installationDate ? "Instalação agendada" : "A aguardar agendamento"}
                              </span>
                            </td>
                            <td>
                              <div className="request-actions">
                                <button
                                  className="request-action-button"
                                  type="button"
                                  onClick={() => openRequestEditor(request)}
                                  aria-label={`Editar pedido ${request.id}`}
                                >
                                  <Pencil size={13} /> Editar
                                </button>
                                {request.status !== "Cancelado" && request.status !== "Concluído" && (
                                  <button
                                    className="request-action-button request-action-cancel"
                                    type="button"
                                    onClick={() => cancelRequest(request)}
                                    aria-label={`Cancelar pedido ${request.id}`}
                                  >
                                    <Ban size={13} /> Cancelar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                      ))}
                      {matchingClientRequests.length === 0 && (
                        <tr>
                          <td className="empty-search" colSpan={6}>
                            {clientRequests.length === 0
                              ? "Registe primeiro um pedido de serviço para apresentar o cliente e agendar a execução."
                              : "Nenhum pedido corresponde à pesquisa."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          )}

          {activeSection === "quotes" && (
            <section className="quotes-section" id="quotes">
              <div className="panel-heading quotes-heading">
                <div className="quotes-page-title">
                  <span className="quotes-eyebrow">GESTÃO COMERCIAL</span>
                  <h1>Orçamentos</h1>
                  <p>Prepare propostas, acompanhe as respostas dos clientes e consulte os valores.</p>
                </div>
                <button className="dashboard-primary-button" type="button" onClick={() => openForm("quotes")}>
                  <CirclePlus size={17} /> Novo orçamento
                </button>
              </div>
              <div className="quotes-summary" aria-label="Resumo dos orçamentos">
                {quoteStatusSummary.map((item) => (
                  <article className={`quotes-summary-card quotes-summary-${item.tone}`} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </article>
                ))}
              </div>
              <section className="dashboard-panel quotes-list-panel" aria-labelledby="quotes-list-title">
                <div className="quotes-list-heading">
                  <div>
                    <h2 id="quotes-list-title">Lista de propostas</h2>
                    <p>{matchingQuotes.length} {matchingQuotes.length === 1 ? "orçamento apresentado" : "orçamentos apresentados"}</p>
                  </div>
                </div>
                <div className="quotes-table-wrap">
                  <table className="quotes-table">
                    <thead><tr><th>REFERÊNCIA</th><th>CLIENTE</th><th>SERVIÇO</th><th>VALOR</th><th>ESTADO</th><th>DATA</th><th>AÇÃO</th></tr></thead>
                    <tbody>
                      {matchingQuotes.map((quote) => (
                        <tr key={quote.id}>
                          <td className="quote-id">{quote.id}</td>
                          <td className="quote-client">{quote.client}</td>
                          <td className="quote-service-cell">{quote.service}</td>
                          <td className="quote-value">{formatCurrency(quote.amount)}</td>
                          <td>
                            <select
                              className={`quote-status-control quote-status-${quote.status.toLocaleLowerCase("pt-AO")}`}
                              aria-label={`Estado do orçamento ${quote.id}`}
                              value={quote.status}
                              onChange={(event) => {
                                const status = event.target.value
                                setQuotes((current) =>
                                  current.map((item) =>
                                    item.id === quote.id ? { ...item, status } : item,
                                  ),
                                )
                                setSelectedQuote((current) =>
                                  current?.id === quote.id ? { ...current, status } : current,
                                )
                                setNotice(`Estado do orçamento ${quote.id} atualizado.`)
                              }}
                            >
                              <option value="Rascunho">Rascunho</option>
                              <option value="Enviado">Enviado</option>
                              <option value="Aprovado">Aceite pelo cliente</option>
                              <option value="Recusado">Recusado</option>
                            </select>
                          </td>
                          <td className="quote-time">{formatDate(quote.createdAt)}</td>
                          <td>
                            <div className="request-actions">
                              <button
                                className="request-action-button"
                                type="button"
                                onClick={() => openQuoteEditor(quote)}
                                aria-label={`Editar orçamento ${quote.id}`}
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <button className="quote-print-button" type="button" onClick={() => setSelectedQuote(quote)}>
                                Ver / imprimir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {matchingQuotes.length === 0 && (
                        <tr>
                          <td className="empty-search" colSpan={7}>
                            {quotes.length === 0
                              ? "Ainda não existem propostas. Crie um orçamento para começar."
                              : "Nenhum orçamento corresponde à pesquisa."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          )}
          <footer className="dashboard-footer">© 2026 MiQ Security</footer>
        </div>
      </section>
      {formType && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setFormType(null)
        }}>
          <section className="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title">
            <div className="quote-dialog-heading">
              <div>
                <h2 id="quote-dialog-title">
                  {formType === "requests"
                    ? editingRequestId ? "Editar pedido" : "Novo pedido"
                    : editingQuoteId ? "Editar orçamento" : "Novo orçamento"}
                </h2>
                <p>
                  {editingRequestId
                    ? "Atualize os dados e o estado do pedido."
                    : editingQuoteId
                      ? "Edite os dados e os elementos do orçamento."
                      : "Preencha os dados para guardar neste navegador."}
                </p>
              </div>
              <button className="dialog-close" type="button" aria-label="Fechar" onClick={() => setFormType(null)}>×</button>
            </div>
            <form onSubmit={createRecord}>
              {formType === "requests" && (
                <>
                  <label>Cliente<input autoFocus required value={requestClient} onChange={(event) => setRequestClient(event.target.value)} placeholder="Nome do cliente" /></label>
                  <label>Tipo de pedido / serviço<input required value={requestService} onChange={(event) => setRequestService(event.target.value)} placeholder="Ex.: instalação de câmaras" /></label>
                  {editingRequestId && (
                    <label>
                      Estado do pedido
                      <select
                        value={requestStatus}
                          onChange={(event) => {
                            const status = event.target.value
                            setRequestStatus(status)
                            if (["Diagnóstico por agendar", "Diagnóstico concluído", "Cancelado"].includes(status)) {
                              setRequestDiagnosticDate("")
                              setRequestInstallationDate("")
                            } else if (status === "Diagnóstico agendado") {
                              setRequestInstallationDate("")
                            } else if (status === "Instalação agendada") {
                              setRequestDiagnosticDate("")
                            }
                          }}
                        >
                        <option value="Diagnóstico agendado">Diagnóstico agendado</option>
                        <option value="Diagnóstico por agendar">Diagnóstico por agendar</option>
                        <option value="Diagnóstico concluído">Diagnóstico concluído</option>
                        <option value="Instalação agendada">Instalação agendada</option>
                        <option value="Concluído">Concluído</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                            <span className="request-form-hint">Os estados “agendado” exigem uma data. Ao cancelar um agendamento, o estado compatível será atualizado automaticamente.</span>
                          </label>
                        )}
                        <label>
                          Data agendada para o diagnóstico
                          <DateInput
                            required={!editingRequestId || requestStatus === "Diagnóstico agendado"}
                            ariaLabel="Data agendada para o diagnóstico"
                            value={requestDiagnosticDate}
                            onChange={(date) => {
                              setRequestDiagnosticDate(date)
                              if (date) {
                                setRequestInstallationDate("")
                                setRequestStatus("Diagnóstico agendado")
                              } else if (requestStatus === "Diagnóstico agendado") {
                                setRequestStatus("Diagnóstico por agendar")
                              }
                            }}
                          />
                        </label>
                        {editingRequestId && (
                          <label>
                            Data agendada para instalação / execução
                            <DateInput
                              required={requestStatus === "Instalação agendada"}
                              ariaLabel="Data agendada para instalação ou execução"
                              value={requestInstallationDate}
                              onChange={(date) => {
                                setRequestInstallationDate(date)
                                if (date) {
                                  setRequestDiagnosticDate("")
                                  setRequestStatus("Instalação agendada")
                                } else if (requestStatus === "Instalação agendada") {
                                  setRequestStatus("Diagnóstico concluído")
                                }
                              }}
                            />
                          </label>
                        )}
                </>
              )}
              {formType === "quotes" && (
                <>
                  <label>
                    Associar a cliente ou pedido
                    <select
                      value={quoteAssociation}
                      onChange={(event) => {
                        const value = event.target.value
                        setQuoteAssociation(value)
                        if (!value) {
                          setQuoteClient("")
                          setQuoteService("")
                          return
                        }
                        const [type, id] = value.split(":")
                        if (type === "client") {
                          const client = clients.find((item) => item.id === id)
                          if (client) {
                            setQuoteClient(client.name)
                            setQuoteService("")
                          }
                        } else if (type === "request") {
                          const request = requests.find((item) => item.id === id)
                          if (request) {
                            setQuoteClient(request.client)
                            setQuoteService(request.service)
                          }
                        }
                      }}
                    >
                      <option value="">Introduzir dados manualmente</option>
                      {clients.length > 0 && (
                        <optgroup label="Clientes registados">
                          {clients.map((client) => (
                            <option key={client.id} value={`client:${client.id}`}>
                              {client.name} — {client.id}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {requests.length > 0 && (
                        <optgroup label="Pedidos registados">
                          {requests.map((request) => (
                            <option key={request.id} value={`request:${request.id}`}>
                              {request.id} — {request.client} — {request.service}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label>
                    Cliente
                    <input
                      autoFocus
                      required
                      value={quoteClient}
                      onChange={(event) => setQuoteClient(event.target.value)}
                      placeholder="Nome do cliente"
                      readOnly={quoteAssociation !== "" && !editingQuoteId}
                    />
                  </label>
                  <label>
                    Serviço
                    <input
                      required
                      value={quoteService}
                      onChange={(event) => setQuoteService(event.target.value)}
                      placeholder="Serviço proposto"
                      readOnly={quoteAssociation.startsWith("request:") && !editingQuoteId}
                    />
                  </label>
                  <section className="quote-composition-section" aria-labelledby="quote-materials-heading">
                    <div className="quote-composition-heading">
                      <div>
                        <h3 id="quote-materials-heading">Materiais</h3>
                        <p>Adicione os materiais, quantidades e custos unitários.</p>
                      </div>
                      <button
                        className="quote-add-line"
                        type="button"
                        onClick={() => setQuoteMaterials((current) => [...current, createQuoteLine()])}
                      >
                        <CirclePlus size={14} /> Adicionar material
                      </button>
                    </div>
                    {quoteMaterials.length === 0 ? (
                      <p className="quote-lines-empty">Ainda não adicionou materiais.</p>
                    ) : (
                      <div className="quote-line-list">
                        {quoteMaterials.map((item, index) => (
                          <div className="quote-line-item" key={item.id}>
                            <label>
                              Material {index + 1}
                              <input
                                value={item.description}
                                onChange={(event) =>
                                  setQuoteMaterials((current) =>
                                    current.map((line) => line.id === item.id ? { ...line, description: event.target.value } : line),
                                  )
                                }
                                placeholder="Ex.: câmara de segurança"
                              />
                            </label>
                            <label>
                              Quantidade
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(event) =>
                                  setQuoteMaterials((current) =>
                                    current.map((line) => line.id === item.id ? { ...line, quantity: event.target.value } : line),
                                  )
                                }
                              />
                            </label>
                            <label>
                              Custo unitário (Kz)
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  setQuoteMaterials((current) =>
                                    current.map((line) => line.id === item.id ? { ...line, unitPrice: event.target.value } : line),
                                  )
                                }
                                placeholder="0"
                              />
                            </label>
                            <button
                              className="quote-remove-line"
                              type="button"
                              aria-label={`Remover material ${index + 1}`}
                              onClick={() => setQuoteMaterials((current) => current.filter((line) => line.id !== item.id))}
                            >
                              <CircleMinus size={17} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="quote-composition-section" aria-labelledby="quote-costs-heading">
                    <div className="quote-composition-heading">
                      <div>
                        <h3 id="quote-costs-heading">Serviços e outros custos</h3>
                        <p>Indique os custos de instalação, transporte e despesas adicionais.</p>
                      </div>
                    </div>
                    <div className="quote-fixed-costs">
                      <label>
                        Instalação (Kz)
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={quoteInstallationCost}
                          onChange={(event) => setQuoteInstallationCost(event.target.value)}
                          placeholder="0"
                        />
                      </label>
                      <label>
                        Transporte (Kz)
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={quoteTransportCost}
                          onChange={(event) => setQuoteTransportCost(event.target.value)}
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <div className="quote-composition-heading quote-additional-heading">
                      <h3>Outros custos</h3>
                      <button
                        className="quote-add-line"
                        type="button"
                        onClick={() => setQuoteAdditionalCosts((current) => [...current, createQuoteLine()])}
                      >
                        <CirclePlus size={14} /> Adicionar custo
                      </button>
                    </div>
                    {quoteAdditionalCosts.length > 0 && (
                      <div className="quote-line-list">
                        {quoteAdditionalCosts.map((item, index) => (
                          <div className="quote-line-item" key={item.id}>
                            <label>
                              Descrição do custo {index + 1}
                              <input
                                value={item.description}
                                onChange={(event) =>
                                  setQuoteAdditionalCosts((current) =>
                                    current.map((line) => line.id === item.id ? { ...line, description: event.target.value } : line),
                                  )
                                }
                                placeholder="Ex.: configuração"
                              />
                            </label>
                            <label>
                              Quantidade
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(event) =>
                                  setQuoteAdditionalCosts((current) =>
                                    current.map((line) => line.id === item.id ? { ...line, quantity: event.target.value } : line),
                                  )
                                }
                              />
                            </label>
                            <label>
                              Custo unitário (Kz)
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  setQuoteAdditionalCosts((current) =>
                                    current.map((line) => line.id === item.id ? { ...line, unitPrice: event.target.value } : line),
                                  )
                                }
                                placeholder="0"
                              />
                            </label>
                            <button
                              className="quote-remove-line"
                              type="button"
                              aria-label={`Remover custo ${index + 1}`}
                              onClick={() => setQuoteAdditionalCosts((current) => current.filter((line) => line.id !== item.id))}
                            >
                              <CircleMinus size={17} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <div className="quote-draft-total">
                    <span>Total do orçamento</span>
                    <strong>{formatCurrency(quoteDraftTotal)}</strong>
                  </div>
                </>
              )}
              <div className="quote-dialog-actions">
                <button className="dashboard-primary-button" type="submit">
                  {formType === "requests"
                    ? editingRequestId ? "Guardar alterações" : "Registar pedido"
                    : editingQuoteId ? "Guardar alterações" : "Criar orçamento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {selectedQuote && (
        <div className="dialog-backdrop quote-preview-backdrop">
          <section className="quote-preview" role="dialog" aria-modal="true" aria-labelledby="quote-preview-title">
            <div className="quote-preview-controls">
              <button className="dialog-cancel" type="button" onClick={() => setSelectedQuote(null)}>
                Fechar
              </button>
              <button
                className="dashboard-primary-button"
                type="button"
                onClick={downloadSelectedQuote}
                disabled={isDownloadingQuote}
              >
                <Download size={16} /> {isDownloadingQuote ? "A gerar PDF..." : "Baixar PDF"}
              </button>
            </div>
            <article className="quote-document" ref={quoteDocumentRef}>
              <header className="quote-document-header">
                <div className="quote-document-brand">
                  <Logo />
                </div>
                <div className="quote-document-heading">
                  <h1 id="quote-preview-title">ORÇAMENTO</h1>
                  <p>{selectedQuote.id}</p>
                </div>
              </header>
              <div className="quote-document-meta">
                <div><span>DATA DE EMISSÃO</span><strong>{formatDate(selectedQuote.createdAt)}</strong></div>
                <div><span>ESTADO</span><strong>{selectedQuote.status === "Aprovado" ? "Aceite pelo cliente" : selectedQuote.status}</strong></div>
              </div>
              <section className="quote-document-client">
                <h2>CLIENTE</h2>
                <p>{selectedQuote.client}</p>
                {selectedQuote.clientId && (() => {
                  const client = clients.find((item) => item.id === selectedQuote.clientId)
                  return client ? <p>{[client.email, client.phone].filter(Boolean).join(" · ")}</p> : null
                })()}
                {selectedQuote.requestId && <p>Pedido associado: {selectedQuote.requestId}</p>}
              </section>
              <table className="quote-document-table">
                <thead>
                  <tr><th>DESCRIÇÃO</th><th>QTD.</th><th>VALOR UNITÁRIO</th><th>SUBTOTAL</th></tr>
                </thead>
                <tbody>
                  {selectedQuote.items?.length ? selectedQuote.items.map((item, index) => (
                    <tr key={`${selectedQuote.id}-item-${index}`}>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td>{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td>{selectedQuote.service}</td>
                      <td>1</td>
                      <td>{formatCurrency(selectedQuote.amount)}</td>
                      <td>{formatCurrency(selectedQuote.amount)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr><th colSpan={3}>TOTAL</th><th>{formatCurrency(selectedQuote.amount)}</th></tr>
                </tfoot>
              </table>
              <footer className="quote-document-footer">MiQ Security · MIQ COMMERCIAL</footer>
            </article>
          </section>
        </div>
      )}
    </main>
  )
}

export default function App() {
  const [view, setView] = useState<View>("login")
  const [showDashboard, setShowDashboard] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<StoredData | null>(null)
  const passwordRecovery = useRef(false)

  async function enterAdminDashboard(userId: string): Promise<string | null> {
    try {
      if (!await isAuthorizedAdmin(userId)) {
        await supabaseClient?.auth.signOut()
        return "Esta conta não tem autorização de administrador."
      }

      const records = await loadSupabaseRecords()
      setDashboardData(records)
      setAuthNotice(null)
      window.history.replaceState(null, "", window.location.pathname)
      setShowDashboard(true)
      return null
    } catch (error) {
      console.error("Não foi possível validar o administrador ou carregar os dados.", error)
      await supabaseClient?.auth.signOut()
      return "Não foi possível validar o acesso ou carregar os dados. Tente novamente."
    }
  }

  async function completeLogin(email: string, password: string): Promise<string | null> {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) {
        console.error("O Supabase recusou a tentativa de início de sessão.", error)
        return "E-mail ou palavra-passe incorretos."
      }
      if (!data.user) return "O Supabase não devolveu uma conta autenticada."
      return enterAdminDashboard(data.user.id)
    }

    if (!import.meta.env.DEV) {
      return "O acesso administrativo ainda não está configurado com o Supabase."
    }

    const temporaryEmail = import.meta.env.VITE_TEMP_AUTH_EMAIL
      ?.trim()
      .toLocaleLowerCase("en-US")
    const temporaryPassword = import.meta.env.VITE_TEMP_AUTH_PASSWORD
    if (!temporaryEmail || !temporaryPassword) {
      return "O Supabase ainda não está configurado neste ambiente."
    }
    if (
      email.toLocaleLowerCase("en-US") !== temporaryEmail ||
      password !== temporaryPassword
    ) {
      return "E-mail ou palavra-passe incorretos."
    }

    setDashboardData(loadStoredData())
    window.history.replaceState(null, "", window.location.pathname)
    setShowDashboard(true)
    return null
  }

  async function recoverPassword(email: string): Promise<string | null> {
    if (!supabaseClient) return "A recuperação de acesso requer a configuração do Supabase."

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) {
      console.error("Não foi possível enviar o e-mail de recuperação.", error)
      return "Não foi possível enviar o e-mail de recuperação. Tente novamente."
    }
    return null
  }

  async function updatePassword(password: string): Promise<string | null> {
    if (!supabaseClient) return "O serviço de autenticação não está configurado."

    const { error } = await supabaseClient.auth.updateUser({ password })
    if (error) {
      console.error("Não foi possível atualizar a palavra-passe.", error)
      return "Não foi possível atualizar a palavra-passe. Solicite um novo link de recuperação."
    }

    const { data, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !data.user) {
      console.error("Não foi possível validar a conta após alterar a palavra-passe.", userError)
      return "A palavra-passe foi atualizada, mas não foi possível validar a conta. Inicie sessão novamente."
    }
    return enterAdminDashboard(data.user.id)
  }

  async function exitDashboard() {
    if (supabaseClient) {
      const { error } = await supabaseClient.auth.signOut()
      if (error) {
        console.error("Não foi possível terminar a sessão.", error)
        setAuthNotice("Não foi possível terminar a sessão. Tente novamente.")
        return
      }
    }

    window.history.replaceState(null, "", window.location.pathname)
    setDashboardData(null)
    setShowDashboard(false)
    setView("login")
    setAuthNotice(null)
  }

  useEffect(() => {
    const client = supabaseClient
    if (!client) {
      setAuthReady(true)
      return
    }

    let active = true
    const auth = client.auth
    const { data: { subscription } } = auth.onAuthStateChange((event) => {
      if (!active) return
      if (event === "SIGNED_OUT") {
        setDashboardData(null)
        setShowDashboard(false)
        setView("login")
      }
      if (event === "PASSWORD_RECOVERY") {
        passwordRecovery.current = true
        setDashboardData(null)
        setShowDashboard(false)
        setView("password-reset")
        setAuthReady(true)
      }
    })

    async function restoreSession() {
      const { data, error } = await auth.getSession()
      if (!active) return
      if (error) {
        console.error("Não foi possível restaurar a sessão Supabase.", error)
        setAuthNotice("Não foi possível verificar a sessão. Tente iniciar sessão novamente.")
      } else if (data.session) {
        if (
          passwordRecovery.current ||
          new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"
        ) {
          passwordRecovery.current = true
          setView("password-reset")
        } else {
          const accessError = await enterAdminDashboard(data.session.user.id)
          if (accessError) setAuthNotice(accessError)
        }
      }
      if (active) setAuthReady(true)
    }

    void restoreSession()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (showDashboard && dashboardData) {
    return <DashboardView onExit={exitDashboard} initialData={dashboardData} />
  }

  return (
    <main className="auth-layout">
      <section className="brand-panel">
        <div className="brand-top">
          <Logo inverse />
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
        {!authReady && (
          <div className="notice notice-info" role="status">
            A verificar a sessão administrativa...
          </div>
        )}
        {authNotice && (
          <NoticeBox notice={{ tone: "error", message: authNotice }} />
        )}
        {view === "login" && (
          <LoginView onNavigate={setView} onAuthenticated={completeLogin} />
        )}
        {view === "recovery" && (
          <RecoveryView onNavigate={setView} onRecover={recoverPassword} />
        )}
        {view === "password-reset" && (
          <PasswordResetView onNavigate={setView} onUpdatePassword={updatePassword} />
        )}
        <p className="legal">
          © 2026 MiQ Security · Acesso exclusivo ao administrador autorizado
        </p>
      </section>
    </main>
  )
}
