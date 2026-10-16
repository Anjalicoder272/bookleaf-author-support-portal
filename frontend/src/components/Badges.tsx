import type { Category, Priority, TicketStatus } from "@/lib/api";
import { CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";

const base = "inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${base} ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority | "" }) {
  if (!priority) return <span className={`${base} bg-gray-100 text-gray-500`}>Triaging…</span>;
  return <span className={`${base} ${PRIORITY_STYLES[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function CategoryBadge({ category }: { category: Category | "" }) {
  if (!category) return <span className="text-xs text-gray-400">Classifying…</span>;
  return <span className={`${base} bg-teal-50 text-teal-800`}>{CATEGORY_LABELS[category]}</span>;
}
