"use client";

import { BookOpen, CalendarClock, Hammer, Info, MessageCircleQuestion, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { RequireRole } from "@/components/RequireRole";
import { card, EmptyState, PageHeader, Skeleton, StatCard } from "@/components/ui";
import { getMyBooks, type Book, type User } from "@/lib/api";
import { formatDate, formatINR, PAYOUT_THRESHOLD } from "@/lib/format";

const COVER_GRADIENTS = [
  "from-brand-500 to-brand-800",
  "from-amber-400 to-orange-600",
  "from-indigo-400 to-violet-700",
  "from-rose-400 to-pink-700",
  "from-sky-400 to-blue-700",
];

function BookCover({ book, index }: { book: Book; index: number }) {
  return (
    <div
      className={`relative flex h-36 w-24 shrink-0 flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br p-2.5 text-white shadow-md transition duration-300 group-hover:-rotate-2 group-hover:scale-105 ${
        COVER_GRADIENTS[index % COVER_GRADIENTS.length]
      }`}
    >
      <span className="absolute inset-y-0 left-1.5 w-px bg-white/30" />
      <p className="line-clamp-4 pl-1 text-[11px] font-semibold leading-tight">{book.title}</p>
      <BookOpen className="h-4 w-4 self-end opacity-70" />
    </div>
  );
}

function RoyaltyBar({ book }: { book: Book }) {
  const earned = Number(book.total_royalty_earned);
  const paid = Number(book.royalty_paid);
  const pending = Number(book.royalty_pending);
  const paidPct = earned > 0 ? Math.round((paid / earned) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-slate-500">Royalty paid</span>
        <span className="font-medium text-slate-700">{earned > 0 ? `${paidPct}%` : "—"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-1000 ease-out"
          style={{ width: `${paidPct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span className="text-slate-600">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-500" />
          Paid {formatINR(paid)}
        </span>
        <span className="text-slate-600">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />
          Pending {formatINR(pending)}
        </span>
      </div>
      {pending > 0 && pending < PAYOUT_THRESHOLD && (
        <p className="mt-3 flex gap-2 rounded-xl bg-blue-50 p-2.5 text-xs text-blue-800">
          <Info className="h-4 w-4 shrink-0" />
          Below the ₹1,000 payout minimum, so this rolls over to next quarter.
        </p>
      )}
    </div>
  );
}

function BookCard({ book, index }: { book: Book; index: number }) {
  return (
    <article className={`${card} group flex gap-5 p-5 transition hover:-translate-y-0.5 hover:shadow-lg`}>
      <BookCover book={book} index={index} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{book.title}</h2>
            <p className="text-xs text-slate-500">
              {book.genre} · ISBN {book.isbn || "—"}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              book.is_published ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
            }`}
          >
            {book.is_published ? <ShoppingBag className="h-3 w-3" /> : <Hammer className="h-3 w-3" />}
            {book.status}
          </span>
        </div>

        {book.is_published ? (
          <>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <dt className="text-slate-500">Published</dt>
                <dd className="font-medium text-slate-800">{formatDate(book.publication_date)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dt className="text-slate-500">MRP</dt>
                <dd className="font-medium text-slate-800">{formatINR(book.mrp)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <dt className="text-slate-500">Copies sold</dt>
                <dd className="font-medium text-slate-800">{book.total_copies_sold.toLocaleString("en-IN")}</dd>
              </div>
            </dl>
            <RoyaltyBar book={book} />
            {book.available_on.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {book.available_on.map((store) => (
                  <span key={store} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {store}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Your book is still in production. Sales and royalty details will appear here once it&apos;s published.
          </p>
        )}

        <Link
          href={`/author/tickets/new?book=${book.id}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 opacity-80 transition hover:opacity-100"
        >
          <MessageCircleQuestion className="h-4 w-4" /> Ask about this book
        </Link>
      </div>
    </article>
  );
}

function BooksDashboard({ user }: { user: User }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyBooks().then(setBooks).catch(() => setError("Could not load your books."));
  }, []);

  const totals = useMemo(() => {
    const list = books ?? [];
    const sum = (key: keyof Book) => list.reduce((acc, b) => acc + Number(b[key] ?? 0), 0);
    const lastPayout = list
      .map((b) => b.last_royalty_payout_date)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    return { copies: sum("total_copies_sold"), earned: sum("total_royalty_earned"), pending: sum("royalty_pending"), lastPayout };
  }, [books]);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]} 👋`}
        subtitle="Here's how your books are doing."
        action={
          <Link href="/author/tickets/new" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700">
            <MessageCircleQuestion className="h-4 w-4" /> Get help
          </Link>
        }
      />

      {error && <p className="text-red-600">{error}</p>}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 stagger">
        {books ? (
          <>
            <StatCard icon={BookOpen} label="Books" value={books.length} hint={`${books.filter((b) => b.is_published).length} published`} />
            <StatCard icon={TrendingUp} label="Copies sold" value={totals.copies.toLocaleString("en-IN")} tone="blue" />
            <StatCard icon={Wallet} label="Royalty earned" value={formatINR(totals.earned)} tone="amber" />
            <StatCard icon={CalendarClock} label="Pending payout" value={formatINR(totals.pending)} hint={`Last payout ${formatDate(totals.lastPayout)}`} tone="slate" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[84px]" />)
        )}
      </div>

      {!books ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : books.length === 0 ? (
        <EmptyState icon={BookOpen} title="No books yet" body="Once BookLeaf starts working on your manuscript, it will show up here." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 stagger">
          {books.map((book, i) => (
            <BookCard key={book.id} book={book} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

export default function MyBooksPage() {
  return <RequireRole role="author">{(user) => <BooksDashboard user={user} />}</RequireRole>;
}
