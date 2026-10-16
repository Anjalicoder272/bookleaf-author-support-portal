"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { CategoryBadge, PriorityBadge, StatusBadge } from "@/components/Badges";
import { RequireRole } from "@/components/RequireRole";
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

const selectClass = "rounded border bg-white px-2 py-1.5 text-sm";

function Queue() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  const fetchQueue = useCallback(() => adminTickets.list(toParams(filters)), [filters]);
  const { data, error } = usePolling(fetchQueue, 10000);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={filters.status} onChange={set("status")} className={selectClass} aria-label="Status">
          <option value="active">Open + In Progress</option>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filters.category} onChange={set("category")} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={set("priority")} className={selectClass} aria-label="Priority">
          <option value="">All priorities</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filters.assigned} onChange={set("assigned")} className={selectClass} aria-label="Assignee">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <input type="date" value={filters.created_after} onChange={set("created_after")} className={selectClass} aria-label="From" />
        <input type="date" value={filters.created_before} onChange={set("created_before")} className={selectClass} aria-label="To" />
        <input
          value={filters.search}
          onChange={set("search")}
          placeholder="Search subject or author…"
          className={`${selectClass} min-w-48 flex-1`}
        />
        <button onClick={() => setFilters(DEFAULT_FILTERS)} className="text-sm text-gray-500 hover:text-gray-900">
          Reset
        </button>
      </div>

      {!data ? (
        <p className="text-sm text-gray-500">{error || "Loading queue…"}</p>
      ) : data.results.length === 0 ? (
        <p className="rounded-lg border bg-white p-8 text-center text-gray-600">No tickets match these filters. 🎉</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">Priority</th>
                <th className="p-3">Ticket</th>
                <th className="p-3">Category</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assignee</th>
                <th className="p-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.results.map((t) => {
                const stale = (t.status === "open" || t.status === "in_progress") && t.age_hours >= 48;
                return (
                  <tr key={t.id} className={t.priority === "critical" ? "bg-red-50" : undefined}>
                    <td className="p-3">
                      <PriorityBadge priority={t.priority} />
                      {t.ai_status === "failed" && (
                        <span className="ml-1 text-xs text-gray-400" title="AI was unavailable; labelled by rules">
                          (rules)
                        </span>
                      )}
                    </td>
                    <td className="max-w-md p-3">
                      <Link href={`/admin/tickets/${t.id}`} className="font-medium text-gray-900 hover:text-teal-700">
                        {t.subject}
                      </Link>
                      <p className="text-xs text-gray-500">
                        #{t.id} · {t.author_name} · {t.book?.title ?? "General / Account"}
                      </p>
                    </td>
                    <td className="p-3"><CategoryBadge category={t.category} /></td>
                    <td className="p-3"><StatusBadge status={t.status} /></td>
                    <td className="p-3 text-xs text-gray-600">{t.assigned_to ?? "—"}</td>
                    <td className={`p-3 text-xs ${stale ? "font-semibold text-red-700" : "text-gray-600"}`}>
                      {timeAgo(t.created_at)}
                      {stale && " ⚠"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t p-3 text-xs text-gray-500">
            {data.count} ticket{data.count === 1 ? "" : "s"} · sorted by unresolved, priority, then oldest first · ⚠ = waiting 48h+
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
          <h1 className="mb-4 text-2xl font-semibold">Ticket Queue</h1>
          <Queue />
        </>
      )}
    </RequireRole>
  );
}
