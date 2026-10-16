"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/Badges";
import { RequireRole } from "@/components/RequireRole";
import { usePolling } from "@/hooks/usePolling";
import { authorTickets } from "@/lib/api";
import { timeAgo } from "@/lib/labels";

function TicketList() {
  const { data, error } = usePolling(authorTickets.list, 8000);

  if (!data) return <p className="text-sm text-gray-500">{error || "Loading tickets…"}</p>;
  if (data.results.length === 0)
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-gray-600">You haven&apos;t raised any support tickets yet.</p>
        <Link href="/author/tickets/new" className="mt-3 inline-block text-teal-700 underline">
          Ask the BookLeaf team a question
        </Link>
      </div>
    );

  return (
    <ul className="divide-y rounded-lg border bg-white">
      {data.results.map((t) => (
        <li key={t.id}>
          <Link href={`/author/tickets/${t.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-gray-50">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.subject}</p>
              <p className="text-sm text-gray-500">
                {t.book?.title ?? "General / Account"} · #{t.id} · updated {timeAgo(t.updated_at)}
                {t.reply_count > 0 && ` · ${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"}`}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MyTicketsPage() {
  return (
    <RequireRole role="author">
      {() => (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">My Tickets</h1>
            <Link href="/author/tickets/new" className="rounded bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800">
              New ticket
            </Link>
          </div>
          <TicketList />
        </>
      )}
    </RequireRole>
  );
}
