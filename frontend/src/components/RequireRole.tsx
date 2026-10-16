"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe, tokenStore, type Role, type User } from "@/lib/api";

const AUTHOR_LINKS = [
  { href: "/author/books", label: "My Books" },
  { href: "/author/tickets", label: "My Tickets" },
  { href: "/author/tickets/new", label: "Get Help" },
];
const ADMIN_LINKS = [{ href: "/admin/tickets", label: "Ticket Queue" }];

/** Guards a page: sends logged-out users to /login and wrong-role users to their own home. */
export function RequireRole({ role, children }: { role: Role; children: (user: User) => React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then((me) => {
        if (me.role !== role) router.replace(me.role === "admin" ? "/admin/tickets" : "/author/books");
        else setUser(me);
      })
      .catch(() => router.replace("/login"));
  }, [role, router]);

  if (!user) return <p className="p-8 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-teal-800">
            BookLeaf {role === "admin" ? "Support Desk" : "Author Portal"}
          </span>
          <nav className="flex gap-4 text-sm">
            {(role === "admin" ? ADMIN_LINKS : AUTHOR_LINKS).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? "font-medium text-teal-800" : "text-gray-600 hover:text-gray-900"}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">{user.name}</span>
          <button
            className="text-gray-500 hover:text-gray-900"
            onClick={() => {
              tokenStore.clear();
              router.replace("/login");
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children(user)}</main>
    </div>
  );
}
