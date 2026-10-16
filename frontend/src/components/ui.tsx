import { Loader2, type LucideIcon } from "lucide-react";

export const card = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 hover:shadow active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  ghost:
    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50",
};

export const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm transition placeholder:text-slate-400 focus:outline-none";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden />;
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Avatar({ name, size = "md", tone = "brand" }: { name: string; size?: "sm" | "md"; tone?: "brand" | "slate" | "amber" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm" };
  const tones = {
    brand: "bg-gradient-to-br from-brand-500 to-brand-700 text-white",
    slate: "bg-slate-200 text-slate-700",
    amber: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
  };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${tones[tone]}`}>
      {initials || "?"}
    </span>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "brand",
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "brand" | "red" | "amber" | "slate" | "blue";
  onClick?: () => void;
  active?: boolean;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`${card} group flex w-full items-center gap-3 p-3 text-left transition sm:gap-4 sm:p-4 ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${active ? "!border-brand-200 !bg-brand-50" : ""}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tones[tone]} transition group-hover:scale-110`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className="block truncate text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">{value}</span>
        {hint && <span className="block truncate text-xs text-slate-500">{hint}</span>}
      </span>
    </Comp>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${card} flex flex-col items-center px-6 py-14 text-center animate-fade-in`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-7 w-7" />
      </span>
      <p className="font-semibold text-slate-900">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LiveDot({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{children}</kbd>
  );
}
