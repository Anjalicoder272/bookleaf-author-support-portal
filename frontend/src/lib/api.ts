// Thin fetch wrapper: adds the JWT, parses the API's error shape, and logs out on 401.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const TOKEN_KEY = "bookleaf_token";

export type Role = "author" | "admin";

export interface User {
  id: number;
  email: string;
  role: Role;
  name: string;
  author_id: string | null;
}

export interface Book {
  id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  is_published: boolean;
  mrp: string | null;
  author_royalty_per_copy: string | null;
  total_copies_sold: number;
  total_royalty_earned: string;
  royalty_paid: string;
  royalty_pending: string;
  last_royalty_payout_date: string | null;
  print_partner: string;
  available_on: string[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login/") {
      tokenStore.clear();
      window.location.href = "/login";
    }
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.code ?? "error", err.message ?? "Request failed", err.details);
  }
  return body as T;
}

export async function login(email: string, password: string) {
  const data = await api<{ access: string; refresh: string; user: User }>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  tokenStore.set(data.access);
  return data.user;
}

export const getMe = () => api<User>("/auth/me/");
export const getMyBooks = () => api<Book[]>("/me/books/");

// ---------- Tickets ----------

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type Priority = "critical" | "high" | "medium" | "low";
export type Category =
  | "royalty_payments"
  | "isbn_metadata"
  | "printing_quality"
  | "distribution"
  | "production_status"
  | "general";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BookRef {
  id: string;
  title: string;
  status: string;
}

export interface Message {
  id: number;
  body: string;
  sender_role: "author" | "admin";
  sender_name: string;
  created_at: string;
}

export interface Note {
  id: number;
  body: string;
  author_email: string | null;
  created_at: string;
}

export interface AuthorTicket {
  id: number;
  subject: string;
  book: BookRef | null;
  status: TicketStatus;
  status_label: string;
  category: Category | "";
  category_label: string;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuthorTicketDetail extends AuthorTicket {
  description: string;
  attachment_name: string;
  messages: Message[];
}

export interface AdminTicket {
  id: number;
  subject: string;
  author_name: string;
  author_id: string;
  book: BookRef | null;
  status: TicketStatus;
  category: Category | "";
  priority: Priority | "";
  ai_status: "pending" | "done" | "failed";
  assigned_to: string | null;
  reply_count: number;
  age_hours: number;
  created_at: string;
  updated_at: string;
}

export interface AdminTicketDetail extends AdminTicket {
  description: string;
  attachment_name: string;
  author_email: string;
  book_details: Book | null;
  ai_category: Category | "";
  ai_priority: Priority | "";
  ai_reasoning: string;
  category_overridden: boolean;
  priority_overridden: boolean;
  messages: Message[];
  internal_notes: Note[];
}

export interface Draft {
  draft: string;
  ai_available: boolean;
  generated_at: string | null;
}

const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const authorTickets = {
  list: () => api<Paginated<AuthorTicket>>("/me/tickets/"),
  get: (id: number) => api<AuthorTicketDetail>(`/me/tickets/${id}/`),
  create: (data: { book_id: string | null; subject: string; description: string; attachment_name?: string }) =>
    post<AuthorTicketDetail>("/me/tickets/", data),
  reply: (id: number, body: string) => post<Message>(`/me/tickets/${id}/messages/`, { body }),
};

export const adminTickets = {
  list: (params: URLSearchParams) => api<Paginated<AdminTicket>>(`/admin/tickets/?${params}`),
  get: (id: number) => api<AdminTicketDetail>(`/admin/tickets/${id}/`),
  update: (id: number, data: Partial<{ status: TicketStatus; category: Category; priority: Priority }>) =>
    api<AdminTicketDetail>(`/admin/tickets/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  assignToMe: (id: number) => post(`/admin/tickets/${id}/assign/`),
  respond: (id: number, data: { body: string; used_ai_draft: boolean; status?: TicketStatus }) =>
    post<Message>(`/admin/tickets/${id}/responses/`, data),
  addNote: (id: number, body: string) => post<Note>(`/admin/tickets/${id}/notes/`, { body }),
  getDraft: (id: number) => api<Draft>(`/admin/tickets/${id}/draft/`),
  regenerateDraft: (id: number) => post<Draft>(`/admin/tickets/${id}/draft/`),
  retriage: (id: number) => post(`/admin/tickets/${id}/retriage/`),
};
