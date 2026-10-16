"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { MessageThread } from "@/components/MessageThread";
import { RequireRole } from "@/components/RequireRole";
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

function ReplyBox({ ticket, onSent }: { ticket: AdminTicketDetail; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [fromDraft, setFromDraft] = useState(false);
  const [aiState, setAiState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [nextStatus, setNextStatus] = useState<TicketStatus | "">("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
      } catch {
        setAiState("unavailable");
      }
    },
    [ticket.id],
  );

  // Draft is generated the first time an admin opens the ticket, then cached server-side.
  useEffect(() => {
    if (ticket.status !== "closed") loadDraft();
  }, [loadDraft, ticket.status]);

  async function send() {
    setSending(true);
    setError("");
    try {
      await adminTickets.respond(ticket.id, {
        body: body.trim(),
        used_ai_draft: fromDraft,
        ...(nextStatus ? { status: nextStatus } : {}),
      });
      setBody("");
      setFromDraft(false);
      setNextStatus("");
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Reply to author</h2>
        <div className="flex items-center gap-3 text-xs">
          {aiState === "loading" && <span className="text-gray-500">✨ Drafting with AI…</span>}
          {aiState === "ready" && fromDraft && <span className="text-teal-700">✨ AI draft. Review and edit before sending.</span>}
          {aiState === "unavailable" && (
            <span className="text-amber-700">AI draft unavailable right now. Please write the reply manually.</span>
          )}
          <button onClick={() => loadDraft(true)} disabled={aiState === "loading"} className="text-teal-700 underline disabled:opacity-50">
            Regenerate
          </button>
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="Write your reply…"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as TicketStatus | "")} className="rounded border px-2 py-1.5 text-sm">
          <option value="">Keep status (In Progress)</option>
          <option value="resolved">Send & mark Resolved</option>
          <option value="closed">Send & Close</option>
        </select>
        <button
          onClick={send}
          disabled={sending || body.trim().length < 2}
          className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send to author"}
        </button>
      </div>
    </section>
  );
}

function Sidebar({ ticket, me, onChange }: { ticket: AdminTicketDetail; me: User; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const book = ticket.book_details;
  const field = "w-full rounded border px-2 py-1.5 text-sm";

  return (
    <aside className="space-y-4">
      <section className="space-y-3 rounded-lg border bg-white p-4 text-sm">
        <label className="block">
          Status
          <select
            value={ticket.status}
            disabled={busy}
            onChange={(e) => run(() => adminTickets.update(ticket.id, { status: e.target.value as TicketStatus }))}
            className={field}
          >
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          Category {ticket.category_overridden && <span className="text-xs text-gray-500">(changed by admin)</span>}
          <select
            value={ticket.category}
            disabled={busy}
            onChange={(e) => run(() => adminTickets.update(ticket.id, { category: e.target.value as Category }))}
            className={field}
          >
            {!ticket.category && <option value="">Classifying…</option>}
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          Priority {ticket.priority_overridden && <span className="text-xs text-gray-500">(changed by admin)</span>}
          <select
            value={ticket.priority}
            disabled={busy}
            onChange={(e) => run(() => adminTickets.update(ticket.id, { priority: e.target.value as Priority }))}
            className={field}
          >
            {!ticket.priority && <option value="">Triaging…</option>}
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className="rounded bg-gray-50 p-2 text-xs text-gray-600">
          {ticket.ai_status === "pending" && "AI is classifying this ticket…"}
          {ticket.ai_status === "done" && (
            <>
              <span className="font-medium">AI suggested:</span>{" "}
              {ticket.ai_category && CATEGORY_LABELS[ticket.ai_category]} ·{" "}
              {ticket.ai_priority && PRIORITY_LABELS[ticket.ai_priority]}
              <br />
              {ticket.ai_reasoning}
            </>
          )}
          {ticket.ai_status === "failed" && (
            <>
              AI was unavailable, so these labels came from keyword rules.{" "}
              <button className="text-teal-700 underline" disabled={busy} onClick={() => run(() => adminTickets.retriage(ticket.id))}>
                Retry AI
              </button>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span>Assignee: {ticket.assigned_to ?? "Unassigned"}</span>
          {ticket.assigned_to !== me.email && (
            <button className="text-teal-700 underline" disabled={busy} onClick={() => run(() => adminTickets.assignToMe(ticket.id))}>
              Assign to me
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm">
        <h2 className="mb-2 font-medium">Author</h2>
        <p>{ticket.author_name} <span className="text-gray-500">({ticket.author_id})</span></p>
        <p className="text-gray-500">{ticket.author_email}</p>
        {book ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            <dt className="text-gray-500">Book</dt><dd>{book.title}</dd>
            <dt className="text-gray-500">Status</dt><dd>{book.status}</dd>
            <dt className="text-gray-500">ISBN</dt><dd>{book.isbn || "—"}</dd>
            <dt className="text-gray-500">Published</dt><dd>{formatDate(book.publication_date)}</dd>
            <dt className="text-gray-500">Copies sold</dt><dd>{book.total_copies_sold}</dd>
            <dt className="text-gray-500">Royalty paid</dt><dd>{formatINR(book.royalty_paid)}</dd>
            <dt className="text-gray-500">Pending</dt><dd>{formatINR(book.royalty_pending)}</dd>
            <dt className="text-gray-500">Last payout</dt><dd>{formatDate(book.last_royalty_payout_date)}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-gray-500">General / account-level query</p>
        )}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
        <h2 className="mb-2 font-medium">Internal notes <span className="text-xs font-normal text-gray-500">(not visible to author)</span></h2>
        <ul className="mb-2 space-y-2">
          {ticket.internal_notes.map((n) => (
            <li key={n.id} className="text-xs">
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-gray-500">{n.author_email} · {timeAgo(n.created_at)}</p>
            </li>
          ))}
        </ul>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded border px-2 py-1 text-xs" placeholder="Add a note for the team…" />
        <button
          disabled={busy || !note.trim()}
          onClick={() => run(async () => { await adminTickets.addNote(ticket.id, note.trim()); setNote(""); })}
          className="mt-1 rounded bg-amber-600 px-3 py-1 text-xs text-white disabled:opacity-60"
        >
          Add note
        </button>
      </section>
    </aside>
  );
}

function TicketWorkspace({ id, me }: { id: number; me: User }) {
  const fetchTicket = useCallback(() => adminTickets.get(id), [id]);
  const { data: ticket, error, refresh } = usePolling(fetchTicket, 5000);

  if (!ticket) return <p className="text-sm text-gray-500">{error || "Loading…"}</p>;

  return (
    <div className="space-y-4">
      <Link href="/admin/tickets" className="text-sm text-teal-700">← Queue</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <MessageThread
            viewer="admin"
            messages={ticket.messages}
            original={{ subject: ticket.subject, description: ticket.description, created_at: ticket.created_at, by: ticket.author_name }}
          />
          {ticket.attachment_name && <p className="text-xs text-gray-500">Attachment: {ticket.attachment_name}</p>}
          {ticket.status !== "closed" && <ReplyBox ticket={ticket} onSent={refresh} />}
        </div>
        <Sidebar ticket={ticket} me={me} onChange={refresh} />
      </div>
    </div>
  );
}

export default function AdminTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireRole role="admin">{(me) => <TicketWorkspace id={Number(id)} me={me} />}</RequireRole>;
}
