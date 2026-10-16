"use client";

import { AlertTriangle, Bot, Hourglass, Inbox, RotateCcw, Search, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { CategoryBadge, PRIORITY_BAR, PriorityBadge, StatusBadge } from "@/components/Badges";
import { RequireRole } from "@/components/RequireRole";
import { Avatar, btn, card, EmptyState, input, LiveDot, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { usePolling } from "@/hooks/usePolling";
import { adminTickets } from "@/lib/api";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, timeAgo } from "@/lib/labels";

interface Filters {
  status: string; // "" = all, "active" = open + in progress
  category: string;
  priority: string;
  assigned: string;
  created_after: string;
  created_before: string;
  search: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "active",
  category: "",
  priority: "",
  assigned: "",
  created_after: "",
  created_before: "",
  search: "",
};

const STALE_HOURS = 48;

function toParams(f: Filters) {
  const params = new URLSearchParams();
  if (f.status === "active") ["open", "in_progress"].forEach((s) => params.append("status", s));
  else if (f.status) params.append("status", f.status);
  (["category", "priority", "assigned", "created_after", "created_before", "search"] as const).forEach((k) => {
    if (f[k]) params.append(k, f[k]);
  });
  params.append("page_size", "50");
  return params;
}

const ACTIVE_PARAMS = toParams(DEFAULT_FILTERS);
// Filter controls size to their content (the shared `input` style is full-width).
const select =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none";

function Queue() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  const quickFilter = (patch: Partial<Filters>) => setFilters({ ...DEFAULT_FILTERS, ...patch });

  const fetchQueue = useCallback(() => adminTickets.list(toParams(filters)), [filters]);
  const { data, error } = usePolling(fetchQueue, 10000);

  // Headline numbers always reflect all active tickets, independent of the table filters.
  const fetchActive = useCallback(() => adminTickets.list(ACTIVE_PARAMS), []);
  const { data: active } = usePolling(fetchActive, 10000);
  const stats = useMemo(() => {
    const list = active?.results ?? [];
    return {
      open: active?.count ?? 0,
      critical: list.filter((t) => t.priority === "critical").length,
      unassigned: list.filter((t) => !t.assigned_to).length,
      stale: list.filter((t) => t.age_hours >= STALE_HOURS).length,
    };
  }, [active]);

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 stagger">
        {active ? (
          <>
            <StatCard icon={Inbox} label="Active tickets" value={stats.open} onClick={() => quickFilter({})} active={isDefault} />
            <StatCard
              icon={AlertTriangle}
              label="Critical"
              value={stats.critical}
              tone="red"
              onClick={() => quickFilter({ priority: "critical" })}
              active={filters.priority === "critical"}
            />
            <StatCard
              icon={UserX}
              label="Unassigned"
              value={stats.unassigned}
              tone="amber"
              onClick={() => quickFilter({ assigned: "unassigned" })}
              active={filters.assigned === "unassigned"}
            />
            <StatCard icon={Hourglass} label={`Waiting ${STALE_HOURS}h+`} value={stats.stale} tone="slate" hint="Oldest shown first" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[84px]" />)
        )}
      </div>

      <div className={`${card} mb-4 flex flex-wrap items-center gap-2 p-3`}>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={set("search")} placeholder="Search subject or author…" className={`${input} py-2 pl-9`} />
        </div>
        <select value={filters.status} onChange={set("status")} className={select} aria-label="Status">
          <option value="active">Open + In Progress</option>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filters.category} onChange={set("category")} className={select} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={set("priority")} className={select} aria-label="Priority">
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filters.assigned} onChange={set("assigned")} className={select} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <input type="date" value={filters.created_after} onChange={set("created_after")} className={select} aria-label="Created from" />
        <input type="date" value={filters.created_before} onChange={set("created_before")} className={select} aria-label="Created to" />
        {!isDefault && (
          <button onClick={() => setFilters(DEFAULT_FILTERS)} className={btn.ghost}>
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      {!data ? (
        error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        )
      ) : data.results.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={isDefault ? "Inbox zero 🎉" : "No tickets match these filters"}
          body={isDefault ? "Every active ticket has been handled. New ones will appear here automatically." : "Try clearing a filter."}
        />
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pl-5 pr-3">Ticket</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Assignee</th>
                  <th className="px-3 py-3 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.results.map((t) => {
                  const stale = (t.status === "open" || t.status === "in_progress") && t.age_hours >= STALE_HOURS;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/admin/tickets/${t.id}`)}
                      className={`group relative cursor-pointer transition hover:bg-brand-50/40 ${
                        t.priority === "critical" ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="relative py-3.5 pl-5 pr-3">
                        <span className={`absolute inset-y-2 left-0 w-1 rounded-r ${PRIORITY_BAR[t.priority]}`} />
                        <div className="flex items-center gap-3">
                          <Avatar name={t.author_name} size="sm" tone="slate" />
                          <div className="min-w-0">
                            <p className="max-w-md truncate font-medium text-slate-900 group-hover:text-brand-700">{t.subject}</p>
                            <p className="truncate text-xs text-slate-500">
                              {t.author_name} · {t.book?.title ?? "General / Account"} · #{t.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={t.priority} />
                          {t.ai_status === "failed" && (
                            <span title="AI was unavailable; labelled by keyword rules" className="text-slate-400">
                              <Bot className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5"><CategoryBadge category={t.category} /></td>
                      <td className="px-3 py-3.5"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-3.5 text-xs text-slate-600">
                        {t.assigned_to ?? <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className={`px-3 py-3.5 text-right text-xs ${stale ? "font-semibold text-red-600" : "text-slate-500"}`}>
                        {stale && <Hourglass className="mr-1 inline h-3.5 w-3.5" />}
                        {timeAgo(t.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            {data.count} ticket{data.count === 1 ? "" : "s"} · sorted by unresolved, priority, then oldest first
          </p>
        </div>
      )}
    </>
  );
}

export default function AdminTicketsPage() {
  return (
    <RequireRole role="admin">
      {() => (
        <>
          <PageHeader title="Ticket Queue" subtitle="Most urgent and oldest unresolved tickets are on top. Click a tile to filter." action={<LiveDot />} />
          <Queue />
        </>
      )}
    </RequireRole>
  );
}
