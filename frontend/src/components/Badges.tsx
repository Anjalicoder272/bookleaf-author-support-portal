import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Circle, CircleDot, Clock, Loader2, Lock, Minus } from "lucide-react";

import type { Category, Priority, TicketStatus } from "@/lib/api";
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/labels";

const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

const STATUS: Record<TicketStatus, { cls: string; Icon: typeof Circle }> = {
  open: { cls: "bg-blue-50 text-blue-700 ring-blue-200", Icon: CircleDot },
  in_progress: { cls: "bg-amber-50 text-amber-700 ring-amber-200", Icon: Clock },
  resolved: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  closed: { cls: "bg-slate-100 text-slate-600 ring-slate-200", Icon: Lock },
};

const PRIORITY: Record<Priority, { cls: string; Icon: typeof Circle }> = {
  critical: { cls: "bg-red-600 text-white ring-red-600 animate-pulse", Icon: AlertTriangle },
  high: { cls: "bg-orange-50 text-orange-700 ring-orange-200", Icon: ArrowUp },
  medium: { cls: "bg-yellow-50 text-yellow-800 ring-yellow-200", Icon: Minus },
  low: { cls: "bg-slate-50 text-slate-600 ring-slate-200", Icon: ArrowDown },
};

export const PRIORITY_BAR: Record<Priority | "", string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-slate-300",
  "": "bg-slate-200",
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { cls, Icon } = STATUS[status];
  return (
    <span className={`${base} ${cls}`}>
      <Icon className="h-3 w-3" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | "" }) {
  if (!priority)
    return (
      <span className={`${base} bg-slate-50 text-slate-500 ring-slate-200`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Triaging
      </span>
    );
  const { cls, Icon } = PRIORITY[priority];
  return (
    <span className={`${base} ${cls}`}>
      <Icon className="h-3 w-3" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: Category | "" }) {
  if (!category)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Classifying
      </span>
    );
  return <span className={`${base} bg-brand-50 text-brand-800 ring-brand-200`}>{CATEGORY_LABELS[category]}</span>;
}
