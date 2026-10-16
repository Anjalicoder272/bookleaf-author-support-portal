"use client";

import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  StickyNote,
  UserCheck,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { MessageThread, StatusTimeline } from "@/components/MessageThread";
import { RequireRole } from "@/components/RequireRole";
import { Avatar, btn, card, input, Kbd, LiveDot, Skeleton, Spinner } from "@/components/ui";
import { usePolling } from "@/hooks/usePolling";
import {
  ApiError,
  adminTickets,
  type AdminTicketDetail,
  type Category,
  type Priority,
  type TicketStatus,
  type User,
} from "@/lib/api";
import { formatDate, formatINR } from "@/lib/format";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, timeAgo } from "@/lib/labels";

const SEND_OPTIONS: { value: TicketStatus | ""; label: string }[] = [
  { value: "", label: "Keep open" },
  { value: "resolved", label: "Resolve" },
  { value: "closed", label: "Close" },
];

function Composer({ ticket, autoDraft, onSent }: { ticket: AdminTicketDetail; autoDraft: boolean; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [fromDraft, setFromDraft] = useState(false);
  const [aiState, setAiState] = useState<"loading" | "ready" | "unavailable">(autoDraft ? "loading" : "ready");
  const [nextStatus, setNextStatus] = useState<TicketStatus | "">("resolved");
  const [sending, setSending] = useState(false);

  const loadDraft = useCallback(
    async (regenerate = false) => {
      setAiState("loading");
      try {
        const d = regenerate ? await adminTickets.regenerateDraft(ticket.id) : await adminTickets.getDraft(ticket.id);
        if (d.draft) {
          setBody(d.draft);
          setFromDraft(true);
        }
        setAiState(d.ai_available ? "ready" : "unavailable");
        if (regenerate) toast(d.ai_available ? "Fresh draft ready" : "AI is unavailable right now", { icon: d.ai_available ? "✨" : "⚠️" });
      } catch {
        setAiState("unavailable");
      }
    },
    [ticket.id],
  );

  // Draft automatically only when the author is waiting on us (cached server-side after the first time).
  // After we've replied, a follow-up draft is one click away via Regenerate, so no tokens are spent by default.
  useEffect(() => {
    if (autoDraft) loadDraft();
  }, [autoDraft, loadDraft]);

  async function send() {
    if (body.trim().length < 2 || sending) return;
    setSending(true);
    try {
      await adminTickets.respond(ticket.id, {
        body: body.trim(),
        used_ai_draft: fromDraft,
        ...(nextStatus ? { status: nextStatus } : {}),
      });
      toast.success("Reply sent to author", {
        description: nextStatus ? `Ticket marked ${STATUS_LABELS[nextStatus]}.` : "The author will see it instantly.",
      });
      setBody("");
      setFromDraft(false);
      onSent();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <section className={`${card} mt-6 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-brand-50 to-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-brand-600 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          {aiState === "loading" && <span className="text-slate-600">Drafting a reply from BookLeaf policy…</span>}
          {aiState === "ready" && (
            <span className="text-slate-700">{fromDraft ? "AI draft ready. Review and edit before sending." : "Write a follow-up, or click Regenerate for an AI draft"}</span>
          )}
          {aiState === "unavailable" && <span className="text-amber-700">AI is unavailable right now. Please write the reply manually.</span>}
        </div>
        <button onClick={() => loadDraft(true)} disabled={aiState === "loading"} className={btn.ghost}>
          <RefreshCw className={`h-4 w-4 ${aiState === "loading" ? "animate-spin" : ""}`} /> Regenerate
        </button>
      </div>

      {aiState === "loading" && !body ? (
        <div className="space-y-2.5 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
          }}
          rows={12}
          placeholder="Write your reply to the author…"
          className={`${input} rounded-none border-0 shadow-none`}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <span className="flex items-center gap-3 text-xs text-slate-400">
          {fromDraft && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
              <WandSparkles className="h-3 w-3" /> AI-assisted
            </span>
          )}
          {words} words · <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to send
        </span>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
            {SEND_OPTIONS.map((o) => (
              <button
                key={o.label}
                onClick={() => setNextStatus(o.value)}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                  nextStatus === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button onClick={send} disabled={sending || body.trim().length < 2} className={btn.primary}>
            {sending ? <Spinner /> : <Send className="h-4 w-4" />} Send
          </button>
        </div>
      </div>
    </section>
  );
}

function TriageCard({ ticket, me, onChange }: { ticket: AdminTicketDetail; me: User; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      onChange();
    } catch {
      toast.error("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = `${input} mt-1 py-2`;
  const aiAgrees = ticket.ai_category === ticket.category && ticket.ai_priority === ticket.priority;

  return (
    <section className={`${card} space-y-4 p-4 text-sm`}>
      <label className="block font-medium text-slate-700">
        Status
        <select
          value={ticket.status}
          disabled={busy}
          onChange={(e) => run(() => adminTickets.update(ticket.id, { status: e.target.value as TicketStatus }), "Status updated")}
          className={field}
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="block font-medium text-slate-700">
        <span className="flex justify-between">
          Category {ticket.category_overridden && <span className="text-xs font-normal text-slate-400">edited</span>}
        </span>
        <select
          value={ticket.category}
          disabled={busy}
          onChange={(e) => run(() => adminTickets.update(ticket.id, { category: e.target.value as Category }), "Category updated")}
          className={field}
        >
          {!ticket.category && <option value="">Classifying…</option>}
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="block font-medium text-slate-700">
        <span className="flex justify-between">
          Priority {ticket.priority_overridden && <span className="text-xs font-normal text-slate-400">edited</span>}
        </span>
        <select
          value={ticket.priority}
          disabled={busy}
          onChange={(e) => run(() => adminTickets.update(ticket.id, { priority: e.target.value as Priority }), "Priority updated")}
          className={field}
        >
          {!ticket.priority && <option value="">Triaging…</option>}
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <div className="rounded-xl bg-gradient-to-br from-violet-50 to-brand-50 p-3 text-xs text-slate-600">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-800">
          <Bot className="h-4 w-4 text-violet-600" /> AI triage
        </p>
        {ticket.ai_status === "pending" && (
          <p className="flex items-center gap-1.5">
            <Spinner className="h-3 w-3" /> Classifying this ticket…
          </p>
        )}
        {ticket.ai_status === "done" && (
          <>
            <p>
              Suggested <b>{ticket.ai_category && CATEGORY_LABELS[ticket.ai_category]}</b> ·{" "}
              <b>{ticket.ai_priority && PRIORITY_LABELS[ticket.ai_priority]}</b>
              {aiAgrees && <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-600" />}
            </p>
            <p className="mt-1 italic text-slate-500">&ldquo;{ticket.ai_reasoning}&rdquo;</p>
          </>
        )}
        {ticket.ai_status === "failed" && (
          <p>
            AI was unavailable, so keyword rules set these labels.{" "}
            <button className="font-medium text-brand-700 hover:underline" disabled={busy} onClick={() => run(() => adminTickets.retriage(ticket.id), "AI re-classified the ticket")}>
              Retry AI
            </button>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-slate-600">
          {ticket.assigned_to ? (
            <>Assigned to <b className="text-slate-800">{ticket.assigned_to === me.email ? "you" : ticket.assigned_to}</b></>
          ) : (
            "Unassigned"
          )}
        </span>
        {ticket.assigned_to !== me.email && (
          <button className={`${btn.secondary} px-3 py-1.5 text-xs`} disabled={busy} onClick={() => run(() => adminTickets.assignToMe(ticket.id), "Assigned to you")}>
            <UserCheck className="h-3.5 w-3.5" /> Assign to me
          </button>
        )}
      </div>
    </section>
  );
}

function AuthorCard({ ticket }: { ticket: AdminTicketDetail }) {
  const book = ticket.book_details;
  const rows: [string, string][] = book
    ? [
        ["Status", book.status],
        ["ISBN", book.isbn || "—"],
        ["Published", formatDate(book.publication_date)],
        ["Copies sold", book.total_copies_sold.toLocaleString("en-IN")],
        ["Royalty earned", formatINR(book.total_royalty_earned)],
        ["Paid", formatINR(book.royalty_paid)],
        ["Pending", formatINR(book.royalty_pending)],
        ["Last payout", formatDate(book.last_royalty_payout_date)],
      ]
    : [];
  return (
    <section className={`${card} p-4 text-sm`}>
      <div className="flex items-center gap-3">
        <Avatar name={ticket.author_name} />
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{ticket.author_name}</p>
          <a href={`mailto:${ticket.author_email}`} className="flex items-center gap-1 truncate text-xs text-slate-500 hover:text-brand-700">
            <Mail className="h-3 w-3" /> {ticket.author_email}
          </a>
        </div>
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-500">{ticket.author_id}</span>
      </div>
      {book ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 font-medium text-slate-800">
            <BookOpen className="h-4 w-4 text-brand-600" /> {book.title}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">General / account-level query (no specific book)</p>
      )}
    </section>
  );
}

function NotesCard({ ticket, onChange }: { ticket: AdminTicketDetail; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await adminTickets.addNote(ticket.id, note.trim());
      setNote("");
      toast.success("Note added");
      onChange();
    } catch {
      toast.error("Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm">
      <p className="mb-3 flex items-center gap-1.5 font-semibold text-amber-900">
        <StickyNote className="h-4 w-4" /> Internal notes
        <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-700">
          <Lock className="h-3 w-3" /> team only
        </span>
      </p>
      <ul className="mb-3 space-y-2">
        {ticket.internal_notes.length === 0 && <li className="text-xs text-amber-800/70">No notes yet.</li>}
        {ticket.internal_notes.map((n) => (
          <li key={n.id} className="rounded-xl bg-white/80 p-2.5 text-xs shadow-sm animate-fade-in">
            <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
            <p className="mt-1 text-slate-400">
              {n.author_email} · {timeAgo(n.created_at)}
            </p>
          </li>
        ))}
      </ul>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add();
        }}
        rows={2}
        placeholder="Add a note for the team…"
        className={`${input} border-amber-200 bg-white text-xs`}
      />
      <button disabled={saving || !note.trim()} onClick={add} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-50">
        {saving && <Spinner className="h-3 w-3" />} Add note
      </button>
    </section>
  );
}

function TicketWorkspace({ id, me }: { id: number; me: User }) {
  const fetchTicket = useCallback(() => adminTickets.get(id), [id]);
  const { data: ticket, error, refresh } = usePolling(fetchTicket, 5000);

  if (!ticket)
    return error ? (
      <p className="text-sm text-red-600">{error}</p>
    ) : (
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
          <Skeleton className="h-72" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );

  return (
    <>
      <Link href="/admin/tickets" className={`${btn.ghost} -ml-2.5 mb-4`}>
        <ArrowLeft className="h-4 w-4" /> Queue
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className={`${card} mb-6 p-5 animate-slide-up`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">{ticket.subject}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  #{ticket.id} · {ticket.author_name} · opened {timeAgo(ticket.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <LiveDot />
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
            </div>
            <div className="mt-5">
              <StatusTimeline status={ticket.status} />
            </div>
          </div>

          <MessageThread
            viewer="admin"
            messages={ticket.messages}
            original={{
              subject: ticket.subject,
              description: ticket.description,
              created_at: ticket.created_at,
              by: ticket.author_name,
              attachment: ticket.attachment_name,
            }}
          />

          {ticket.status === "closed" ? (
            <p className="mt-6 flex items-center gap-2 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
              <Lock className="h-4 w-4" /> This ticket is closed. Change the status to reopen it.
            </p>
          ) : (
            <Composer
              key={ticket.messages.length}
              ticket={ticket}
              autoDraft={ticket.messages.length === 0 || ticket.messages.at(-1)?.sender_role === "author"}
              onSent={refresh}
            />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <TriageCard ticket={ticket} me={me} onChange={refresh} />
          <AuthorCard ticket={ticket} />
          <NotesCard ticket={ticket} onChange={refresh} />
        </aside>
      </div>
    </>
  );
}

export default function AdminTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireRole role="admin">{(me) => <TicketWorkspace id={Number(id)} me={me} />}</RequireRole>;
}
