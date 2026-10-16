"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { StatusBadge } from "@/components/Badges";
import { MessageThread } from "@/components/MessageThread";
import { RequireRole } from "@/components/RequireRole";
import { usePolling } from "@/hooks/usePolling";
import { ApiError, authorTickets } from "@/lib/api";

function TicketDetail({ id }: { id: number }) {
  const fetchTicket = useCallback(() => authorTickets.get(id), [id]);
  const { data: ticket, error, refresh } = usePolling(fetchTicket, 5000);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  if (!ticket) return <p className="text-sm text-gray-500">{error || "Loading…"}</p>;

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError("");
    try {
      await authorTickets.reply(id, reply.trim());
      setReply("");
      await refresh();
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const waiting = ticket.messages.length === 0 || ticket.messages.at(-1)?.sender_role === "author";

  return (
    <div className="space-y-4">
      <Link href="/author/tickets" className="text-sm text-teal-700">
        ← All tickets
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{ticket.subject}</h1>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="text-sm text-gray-500">
        #{ticket.id} · {ticket.book?.title ?? "General / Account"}
        {ticket.attachment_name && ` · Attachment: ${ticket.attachment_name}`}
      </p>

      <MessageThread
        viewer="author"
        messages={ticket.messages}
        original={{ subject: ticket.subject, description: ticket.description, created_at: ticket.created_at, by: "You" }}
      />

      {waiting && ticket.status !== "closed" && (
        <p className="text-sm text-gray-500">Our team will reply here. This page updates automatically.</p>
      )}

      {ticket.status === "closed" ? (
        <p className="rounded bg-gray-100 p-3 text-sm text-gray-600">
          This ticket is closed. <Link href="/author/tickets/new" className="text-teal-700 underline">Raise a new ticket</Link>{" "}
          if you need more help.
        </p>
      ) : (
        <form onSubmit={sendReply} className="space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            required
            placeholder={ticket.status === "resolved" ? "Still need help? Replying will reopen this ticket." : "Add a reply…"}
            className="w-full rounded border bg-white px-3 py-2 text-sm"
          />
          {sendError && <p className="text-sm text-red-600">{sendError}</p>}
          <button disabled={sending || !reply.trim()} className="rounded bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-60">
            {sending ? "Sending…" : "Send reply"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function AuthorTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireRole role="author">{() => <TicketDetail id={Number(id)} />}</RequireRole>;
}
