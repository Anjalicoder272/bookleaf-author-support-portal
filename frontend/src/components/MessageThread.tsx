import type { Message } from "@/lib/api";
import { timeAgo } from "@/lib/labels";

/** The visible conversation: the original query first, then replies. `viewer` decides which side is "you". */
export function MessageThread({
  original,
  messages,
  viewer,
}: {
  original: { subject: string; description: string; created_at: string; by: string };
  messages: Message[];
  viewer: "author" | "admin";
}) {
  return (
    <ol className="space-y-3">
      <li className="rounded-lg border bg-white p-4">
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span className="font-medium text-gray-700">{original.by} · original query</span>
          <span>{timeAgo(original.created_at)}</span>
        </div>
        <p className="font-medium">{original.subject}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{original.description}</p>
      </li>
      {messages.map((m) => {
        const mine = m.sender_role === viewer;
        return (
          <li
            key={m.id}
            className={`rounded-lg border p-4 ${m.sender_role === "admin" ? "border-teal-200 bg-teal-50" : "bg-white"} ${
              mine ? "ml-8" : "mr-8"
            }`}
          >
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span className="font-medium text-gray-700">{m.sender_name}</span>
              <span>{timeAgo(m.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
