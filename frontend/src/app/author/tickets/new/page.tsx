"use client";

import { FileText, Paperclip, Send, UploadCloud, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RequireRole } from "@/components/RequireRole";
import { btn, card, input, PageHeader, Spinner } from "@/components/ui";
import { ApiError, authorTickets, getMyBooks, type Book } from "@/lib/api";

// Common reasons authors write in. Clicking one pre-fills the subject; the author still writes the details.
const QUICK_TOPICS = [
  "Royalty payment not received",
  "Royalty amount looks wrong",
  "ISBN or book details incorrect",
  "Print quality issue",
  "Book unavailable on Amazon / Flipkart",
  "When will my book be published?",
];

function NewTicketForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fileInput = useRef<HTMLInputElement>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState(params.get("book") ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
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
      toast.success("Ticket submitted", { description: "Our team will reply here, usually within 48 hours." });
      router.push(`/author/tickets/${ticket.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErrors(
          Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)])),
        );
      } else {
        toast.error("Couldn't submit your ticket. Please try again.");
      }
      setSubmitting(false);
    }
  }

  const selectedBook = books.find((b) => b.id === bookId);

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className={`${card} space-y-5 p-6 animate-slide-up`}>
        <label className="block text-sm font-medium text-slate-700">
          Which book is this about?
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} className={`${input} mt-1.5`}>
            <option value="">General / Account level</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          {errors.book_id && <span className="mt-1 block text-xs text-red-600">{errors.book_id}</span>}
        </label>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">What&apos;s it about?</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TOPICS.map((topic) => (
              <button
                type="button"
                key={topic}
                onClick={() => setSubject(topic)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 ${
                  subject === topic
                    ? "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            minLength={5}
            maxLength={200}
            placeholder="A short summary of your question"
            className={`${input} mt-1.5`}
          />
          {errors.subject && <span className="mt-1 block text-xs text-red-600">{errors.subject}</span>}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          <span className="flex justify-between">
            Describe the issue
            <span className={`text-xs font-normal ${description.trim().length < 15 ? "text-slate-400" : "text-emerald-600"}`}>
              {description.trim().length < 15 ? `${15 - description.trim().length} more characters` : "Looks good"}
            </span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={15}
            maxLength={5000}
            rows={7}
            placeholder="Include any dates, amounts or order numbers that help us look into it quickly."
            className={`${input} mt-1.5 resize-y`}
          />
          {errors.description && <span className="mt-1 block text-xs text-red-600">{errors.description}</span>}
        </label>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Attachment (optional)</p>
          {attachment ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 animate-fade-in">
              <FileText className="h-5 w-5 text-brand-600" />
              <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
              <span className="text-xs text-slate-500">{Math.max(1, Math.round(attachment.size / 1024))} KB</span>
              <button type="button" onClick={() => setAttachment(null)} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files[0]) setAttachment(e.dataTransfer.files[0]);
              }}
              className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-sm transition ${
                dragging ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-slate-50"
              }`}
            >
              <UploadCloud className="h-6 w-6" />
              <span>
                <span className="font-medium text-brand-700">Click to upload</span> or drag and drop
              </span>
              <span className="text-xs text-slate-400">Photos of a defective copy, screenshots, PDFs</span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={() => router.back()} className={btn.secondary}>
            Cancel
          </button>
          <button disabled={submitting || description.trim().length < 15 || subject.trim().length < 5} className={btn.primary}>
            {submitting ? <Spinner /> : <Send className="h-4 w-4" />} Submit ticket
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        {selectedBook && (
          <div className={`${card} p-4 text-sm animate-fade-in`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected book</p>
            <p className="mt-1 font-semibold text-slate-900">{selectedBook.title}</p>
            <p className="text-xs text-slate-500">{selectedBook.status}</p>
          </div>
        )}
        <div className={`${card} p-4 text-sm text-slate-600`}>
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-900">
            <Paperclip className="h-4 w-4 text-brand-600" /> Tips for a faster reply
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-xs">
            <li>Pick the right book so we can see its records.</li>
            <li>For print issues, attach a photo of the defect.</li>
            <li>For royalty questions, mention the quarter or month.</li>
          </ul>
        </div>
      </aside>
    </form>
  );
}

export default function NewTicketPage() {
  return (
    <RequireRole role="author">
      {() => (
        <>
          <PageHeader title="Get help from BookLeaf" subtitle="Our author support team usually replies within 48 hours." />
          <Suspense>
            <NewTicketForm />
          </Suspense>
        </>
      )}
    </RequireRole>
  );
}
