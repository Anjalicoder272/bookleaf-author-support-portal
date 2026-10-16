"use client";

import { ChevronRight, MessagesSquare, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/Badges";
import { RequireRole } from "@/components/RequireRole";
import { btn, card, EmptyState, input, LiveDot, PageHeader, Skeleton } from "@/components/ui";
import { usePolling } from "@/hooks/usePolling";
import { authorTickets, type TicketStatus } from "@/lib/api";
import { timeAgo } from "@/lib/labels";

const TABS: { key: "all" | "active" | "done"; label: string; match: (s: TicketStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "active", label: "Active", match: (s) => s === "open" || s === "in_progress" },
  { key: "done", label: "Resolved", match: (s) => s === "resolved" || s === "closed" },
];

function TicketList() {
  const { data, error } = usePolling(authorTickets.list, 8000);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");

  const tickets = useMemo(() => {
    const matcher = TABS.find((t) => t.key === tab)!.match;
    const q = query.trim().toLowerCase();
    return (data?.results ?? []).filter(
      (t) => matcher(t.status) && (!q || t.subject.toLowerCase().includes(q) || t.book?.title.toLowerCase().includes(q)),
    );
  }, [data, tab, query]);

  if (!data)
    return error ? (
      <p className="text-sm text-red-600">{error}</p>
    ) : (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );

  if (data.results.length === 0)
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No tickets yet"
        body="Have a question about royalties, your ISBN, printing or distribution? Our team is here to help."
        action={
          <Link href="/author/tickets/new" className={btn.primary}>
            <Plus className="h-4 w-4" /> Raise your first ticket
          </Link>
        }
      />
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => {
            const count = data.results.filter((x) => t.match(x.status)).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label} <span className="ml-1 text-xs text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets…" className={`${input} pl-9`} />
        </div>
      </div>

      {tickets.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No tickets match.</p>
      ) : (
        <ul className="space-y-3 stagger">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/author/tickets/${t.id}`}
                className={`${card} group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <MessagesSquare className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{t.subject}</p>
                  <p className="truncate text-sm text-slate-500">
                    {t.book?.title ?? "General / Account"} · #{t.id} · updated {timeAgo(t.updated_at)}
                  </p>
                </div>
                {t.reply_count > 0 && (
                  <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:inline">
                    {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                  </span>
                )}
                <StatusBadge status={t.status} />
                <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MyTicketsPage() {
  return (
    <RequireRole role="author">
      {() => (
        <>
          <PageHeader
            title="My Tickets"
            subtitle="Track your questions and our replies. Updates appear automatically."
            action={
              <div className="flex items-center gap-3">
                <LiveDot />
                <Link href="/author/tickets/new" className={btn.primary}>
                  <Plus className="h-4 w-4" /> New ticket
                </Link>
              </div>
            }
          />
          <TicketList />
        </>
      )}
    </RequireRole>
  );
}
