"use client";

import { ArrowLeft, BookOpen, Lock, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/Badges";
import { MessageThread, StatusTimeline } from "@/components/MessageThread";
import { RequireRole } from "@/components/RequireRole";
import { btn, card, input, Kbd, LiveDot, Skeleton, Spinner } from "@/components/ui";
import { usePolling } from "@/hooks/usePolling";
import { ApiError, authorTickets } from "@/lib/api";
import { timeAgo } from "@/lib/labels";

function TicketDetail({ id }: { id: number }) {
  const fetchTicket = useCallback(() => authorTickets.get(id), [id]);
  const { data: ticket, error, refresh } = usePolling(fetchTicket, 5000);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  if (!ticket)
    return error ? (
      <p className="text-sm text-red-600">{error}</p>
    ) : (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );

  async function sendReply() {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await authorTickets.reply(id, reply.trim());
      setReply("");
      toast.success(ticket?.status === "resolved" ? "Reply sent. Ticket reopened." : "Reply sent");
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const awaitingTeam = ticket.messages.length === 0 || ticket.messages.at(-1)?.sender_role === "author";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/author/tickets" className={`${btn.ghost} -ml-2.5 mb-4`}>
        <ArrowLeft className="h-4 w-4" /> All tickets
      </Link>

      <div className={`${card} mb-6 p-5 animate-slide-up`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{ticket.subject}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <BookOpen className="h-4 w-4" /> {ticket.book?.title ?? "General / Account"} · #{ticket.id} · opened {timeAgo(ticket.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot />
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        <div className="mt-5">
          <StatusTimeline status={ticket.status} />
        </div>
      </div>

      <MessageThread
        viewer="author"
        messages={ticket.messages}
        original={{
          subject: ticket.subject,
          description: ticket.description,
          created_at: ticket.created_at,
          by: "You",
          attachment: ticket.attachment_name,
        }}
      />

      {awaitingTeam && ticket.status !== "closed" && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-sm text-slate-500 animate-fade-in">
          <span className="flex gap-1">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
          Our team will reply here. This page updates on its own, no need to refresh.
        </div>
      )}

      {ticket.status === "closed" ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
          <Lock className="h-4 w-4" />
          This ticket is closed.
          <Link href="/author/tickets/new" className="font-medium text-brand-700 hover:underline">
            Raise a new ticket
          </Link>
          if you need more help.
        </div>
      ) : (
        <div className={`${card} mt-6 p-3`}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply();
            }}
            rows={3}
            placeholder={ticket.status === "resolved" ? "Still need help? Replying will reopen this ticket." : "Write a reply…"}
            className={`${input} resize-none border-0 shadow-none`}
          />
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs text-slate-400">
              <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to send
            </span>
            <button onClick={sendReply} disabled={sending || !reply.trim()} className={btn.primary}>
              {sending ? <Spinner /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthorTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireRole role="author">{() => <TicketDetail id={Number(id)} />}</RequireRole>;
}
