"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RequireRole } from "@/components/RequireRole";
import { ApiError, authorTickets, getMyBooks, type Book } from "@/lib/api";

function NewTicketForm() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyBooks().then(setBooks).catch(() => setBooks([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const ticket = await authorTickets.create({
        book_id: bookId || null,
        subject: subject.trim(),
        description: description.trim(),
        attachment_name: attachment?.name ?? "",
      });
      router.push(`/author/tickets/${ticket.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErrors(
          Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)])),
        );
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-lg border bg-white p-6">
      <label className="block text-sm">
        Which book is this about?
        <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          <option value="">General / Account Level</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        {errors.book_id && <span className="text-red-600">{errors.book_id}</span>}
      </label>

      <label className="block text-sm">
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={5}
          maxLength={200}
          placeholder="e.g. Royalty for last quarter not received"
          className="mt-1 w-full rounded border px-3 py-2"
        />
        {errors.subject && <span className="text-red-600">{errors.subject}</span>}
      </label>

      <label className="block text-sm">
        Describe the issue
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={15}
          rows={6}
          placeholder="Include any dates, amounts or order numbers that help us look into it."
          className="mt-1 w-full rounded border px-3 py-2"
        />
        {errors.description && <span className="text-red-600">{errors.description}</span>}
      </label>

      <label className="block text-sm">
        Attachment (optional)
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          className="mt-1 block text-sm"
        />
        <span className="text-xs text-gray-500">e.g. a photo of a defective copy. (File upload is a UI preview in this demo.)</span>
      </label>

      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
      <button
        disabled={submitting}
        className="rounded bg-teal-700 px-5 py-2 text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}

export default function NewTicketPage() {
  return (
    <RequireRole role="author">
      {() => (
        <>
          <h1 className="mb-1 text-2xl font-semibold">Get help from BookLeaf</h1>
          <p className="mb-4 text-sm text-gray-600">Our author support team usually replies within 48 hours.</p>
          <NewTicketForm />
        </>
      )}
    </RequireRole>
  );
}
