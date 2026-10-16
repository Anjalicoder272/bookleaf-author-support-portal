"use client";

import { useEffect, useState } from "react";

import { RequireRole } from "@/components/RequireRole";
import { getMyBooks, type Book } from "@/lib/api";
import { formatDate, formatINR, PAYOUT_THRESHOLD } from "@/lib/format";

function BooksList() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyBooks().then(setBooks).catch(() => setError("Could not load your books."));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!books) return <p className="text-sm text-gray-500">Loading books…</p>;
  if (books.length === 0) return <p className="text-gray-600">You don&apos;t have any books with BookLeaf yet.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {books.map((book) => {
        const pending = Number(book.royalty_pending);
        return (
          <article key={book.id} className="rounded-lg border bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{book.title}</h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  book.is_published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {book.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {book.genre} · ISBN {book.isbn || "—"}
            </p>

            {book.is_published ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Published</dt>
                <dd>{formatDate(book.publication_date)}</dd>
                <dt className="text-gray-500">MRP</dt>
                <dd>{formatINR(book.mrp)}</dd>
                <dt className="text-gray-500">Copies sold</dt>
                <dd>{book.total_copies_sold}</dd>
                <dt className="text-gray-500">Royalty earned</dt>
                <dd>{formatINR(book.total_royalty_earned)}</dd>
                <dt className="text-gray-500">Royalty paid</dt>
                <dd>{formatINR(book.royalty_paid)}</dd>
                <dt className="text-gray-500">Royalty pending</dt>
                <dd>{formatINR(book.royalty_pending)}</dd>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-gray-600">
                This book is still in production. Sales and royalty details will appear once it&apos;s published.
              </p>
            )}

            {book.is_published && pending > 0 && pending < PAYOUT_THRESHOLD && (
              <p className="mt-3 rounded bg-blue-50 p-2 text-xs text-blue-800">
                Pending royalty is below the ₹1,000 payout minimum, so it will roll over to next quarter.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default function MyBooksPage() {
  return (
    <RequireRole role="author">
      {() => (
        <>
          <h1 className="mb-4 text-2xl font-semibold">My Books</h1>
          <BooksList />
        </>
      )}
    </RequireRole>
  );
}
