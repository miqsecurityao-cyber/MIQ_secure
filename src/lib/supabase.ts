import { createClient } from "@supabase/supabase-js"

export type QuoteItem = {
  description: string
  quantity: number
  unitPrice: number
  category: "material" | "cost"
}

export type Quote = {
  id: string
  client: string
  clientId?: string
  requestId?: string
  service: string
  amount: number
  status: string
  createdAt: string
  installationDate?: string
  items?: QuoteItem[]
}

export type Client = {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export type Request = {
  id: string
  client: string
  service: string
  status: string
  createdAt: string
  diagnosticDate?: string
  installationDate?: string
}

export type StoredData = {
  clients: Client[]
  requests: Request[]
  quotes: Quote[]
  errors: string[]
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Database = {
  public: {
    Tables: {
      miq_admins: {
        Row: { user_id: string; created_at: string }
        Insert: { user_id: string; created_at?: string }
        Update: { user_id?: string; created_at?: string }
        Relationships: []
      }
      clients: {
        Row: { id: string; name: string; email: string; phone: string; created_at: string }
        Insert: { id: string; name: string; email?: string; phone?: string; created_at: string }
        Update: { id?: string; name?: string; email?: string; phone?: string; created_at?: string }
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          client: string
          service: string
          status: string
          created_at: string
          diagnostic_date: string | null
          installation_date: string | null
        }
        Insert: {
          id: string
          client: string
          service: string
          status: string
          created_at: string
          diagnostic_date?: string | null
          installation_date?: string | null
        }
        Update: {
          id?: string
          client?: string
          service?: string
          status?: string
          created_at?: string
          diagnostic_date?: string | null
          installation_date?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          client: string
          client_id: string | null
          request_id: string | null
          service: string
          amount: number
          status: string
          created_at: string
          installation_date: string | null
          items: Json
        }
        Insert: {
          id: string
          client: string
          client_id?: string | null
          request_id?: string | null
          service: string
          amount: number
          status: string
          created_at: string
          installation_date?: string | null
          items?: Json
        }
        Update: {
          id?: string
          client?: string
          client_id?: string | null
          request_id?: string | null
          service?: string
          amount?: number
          status?: string
          created_at?: string
          installation_date?: string | null
          items?: Json
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_miq_admin: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null

export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null
}

export async function isAuthorizedAdmin(userId: string): Promise<boolean> {
  if (!supabaseClient) throw new Error("Supabase não está configurado.")

  const { data, error } = await supabaseClient
    .from("miq_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

export async function loadSupabaseRecords(): Promise<StoredData> {
  if (!supabaseClient) throw new Error("Supabase não está configurado.")

  const [clientsResult, requestsResult, quotesResult] = await Promise.all([
    supabaseClient.from("clients").select("*"),
    supabaseClient.from("requests").select("*"),
    supabaseClient.from("quotes").select("*"),
  ])

  if (clientsResult.error) throw clientsResult.error
  if (requestsResult.error) throw requestsResult.error
  if (quotesResult.error) throw quotesResult.error

  const quotes = sortByCreatedAt(quotesResult.data.map((quote): Quote => ({
    id: quote.id,
    client: quote.client,
    clientId: quote.client_id ?? undefined,
    requestId: quote.request_id ?? undefined,
    service: quote.service,
    amount: Number(quote.amount),
    status: quote.status,
    createdAt: quote.created_at,
    installationDate: quote.installation_date ?? undefined,
    items: parseQuoteItems(quote.items),
  })))

  return {
    clients: sortByCreatedAt(clientsResult.data.map((client): Client => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      createdAt: client.created_at,
    }))),
    requests: sortByCreatedAt(requestsResult.data.map((request): Request => ({
      id: request.id,
      client: request.client,
      service: request.service,
      status: request.status,
      createdAt: request.created_at,
      diagnosticDate: request.diagnostic_date ?? undefined,
      installationDate: request.installation_date ?? undefined,
    }))),
    quotes,
    errors: [],
  }
}

function sortByCreatedAt<T extends { createdAt: string }>(records: T[]): T[] {
  function timestamp(value: string): number {
    const angolanDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (angolanDate) {
      return Date.UTC(Number(angolanDate[3]), Number(angolanDate[2]) - 1, Number(angolanDate[1]))
    }
    return Date.parse(value)
  }

  return records.sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt))
}

function parseQuoteItems(value: Json): QuoteItem[] {
  if (!Array.isArray(value)) throw new Error("Os itens de um orçamento têm formato inválido.")

  return value.map((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      typeof item.description !== "string" ||
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      typeof item.unitPrice !== "number" ||
      !Number.isFinite(item.unitPrice) ||
      (item.category !== "material" && item.category !== "cost")
    ) {
      throw new Error("Um item de orçamento guardado tem formato inválido.")
    }

    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      category: item.category,
    }
  })
}

export async function saveSupabaseRecords(data: Omit<StoredData, "errors">): Promise<void> {
  if (!supabaseClient) throw new Error("Supabase não está configurado.")

  const results = await Promise.all([
    data.clients.length
      ? supabaseClient.from("clients").upsert(
          data.clients.map((client) => ({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            created_at: client.createdAt,
          })),
          { onConflict: "id" },
        )
      : Promise.resolve({ error: null }),
    data.requests.length
      ? supabaseClient.from("requests").upsert(
          data.requests.map((request) => ({
            id: request.id,
            client: request.client,
            service: request.service,
            status: request.status,
            created_at: request.createdAt,
            diagnostic_date: request.diagnosticDate ?? null,
            installation_date: request.installationDate ?? null,
          })),
          { onConflict: "id" },
        )
      : Promise.resolve({ error: null }),
    data.quotes.length
      ? supabaseClient.from("quotes").upsert(
          data.quotes.map((quote) => ({
            id: quote.id,
            client: quote.client,
            client_id: quote.clientId ?? null,
            request_id: quote.requestId ?? null,
            service: quote.service,
            amount: quote.amount,
            status: quote.status,
            created_at: quote.createdAt,
            installation_date: quote.installationDate ?? null,
            items: quote.items ?? [],
          })),
          { onConflict: "id" },
        )
      : Promise.resolve({ error: null }),
  ])

  const failedResult = results.find((result) => result.error)
  if (failedResult?.error) throw failedResult.error
}
