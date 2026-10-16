"use client";

import { Paperclip } from "lucide-react";
import { useEffect, useRef } from "react";

import type { Message, TicketStatus } from "@/lib/api";
import { STATUS_LABELS, timeAgo } from "@/lib/labels";

import { Avatar } from "./ui";

// BookLeaf team messages are always amber; the author's own messages (seen by the author) are brand teal.
const onBrand = (isTeam: boolean, mine: boolean) => mine && !isTeam;
const bubbleColor = (isTeam: boolean, mine: boolean) =>
  isTeam
    ? "border border-amber-100 bg-amber-50/70 text-slate-800"
    : onBrand(isTeam, mine)
      ? "bg-brand-600 text-white"
      : "border border-slate-200 bg-white text-slate-800";

/** Chat-style conversation. The viewer's own messages sit on the right. Scrolls to the newest message when one arrives. */
export function MessageThread({
  original,
  messages,
  viewer,
}: {
  original: { subject: string; description: string; created_at: string; by: string; attachment?: string };
  messages: Message[];
  viewer: "author" | "admin";
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const count = useRef(messages.length);

  useEffect(() => {
    if (messages.length > count.current) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    count.current = messages.length;
  }, [messages.length]);

  const items = [
    { id: "original", body: original.description, name: original.by, role: "author" as const, at: original.created_at, original: true },
    ...messages.map((m) => ({ id: m.id, body: m.body, name: m.sender_name, role: m.sender_role, at: m.created_at, original: false })),
  ];

  return (
    <ol className="space-y-5">
      {items.map((m) => {
        const mine = m.role === viewer;
        const isTeam = m.role === "admin";
        return (
          <li key={m.id} className={`flex gap-3 animate-slide-up ${mine ? "flex-row-reverse" : ""}`}>
            <Avatar name={isTeam ? "BookLeaf Support" : m.name} size="sm" tone={isTeam ? "amber" : "brand"} />
            <div className={`max-w-[85%] ${mine ? "items-end text-right" : ""} flex flex-col`}>
              <div className={`mb-1 flex items-center gap-2 text-xs text-slate-500 ${mine ? "flex-row-reverse" : ""}`}>
                <span className="font-medium text-slate-700">{isTeam ? "BookLeaf Support" : m.name}</span>
                <span>{timeAgo(m.at)}</span>
                {m.original && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Original query</span>}
              </div>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-sm leading-relaxed shadow-sm ${
                  mine ? "rounded-tr-sm" : "rounded-tl-sm"
                } ${bubbleColor(isTeam, mine)}`}
              >
                {m.original && <p className={`mb-1 font-semibold ${onBrand(isTeam, mine) ? "text-white" : "text-slate-900"}`}>{original.subject}</p>}
                {m.body}
                {m.original && original.attachment && (
                  <p className={`mt-2 flex items-center gap-1.5 text-xs ${onBrand(isTeam, mine) ? "text-brand-100" : "text-slate-500"}`}>
                    <Paperclip className="h-3.5 w-3.5" /> {original.attachment}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
      <div ref={endRef} />
    </ol>
  );
}

const STEPS: TicketStatus[] = ["open", "in_progress", "resolved"];

/** Progress stepper: Open → In Progress → Resolved (Closed shows as fully complete). */
export function StatusTimeline({ status }: { status: TicketStatus }) {
  const current = status === "closed" ? STEPS.length : STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < current || status === "closed" || (status === "resolved" && i === 2);
        const active = i === current && status !== "resolved" && status !== "closed";
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                done ? "bg-brand-600 text-white" : active ? "bg-brand-100 text-brand-800 ring-4 ring-brand-50" : "bg-slate-100 text-slate-400"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`text-xs font-medium ${done || active ? "text-slate-800" : "text-slate-400"}`}>{STATUS_LABELS[step]}</span>
            {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < current ? "bg-brand-500" : "bg-slate-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
