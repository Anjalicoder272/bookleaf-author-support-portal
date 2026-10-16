"use client";

import { BookOpen, Inbox, LifeBuoy, LogOut, Menu, MessagesSquare, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe, tokenStore, type Role, type User } from "@/lib/api";

import { ThemeToggle } from "./Theme";
import { Avatar, Spinner } from "./ui";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const AUTHOR_LINKS: NavLink[] = [
  { href: "/author/books", label: "My Books", icon: BookOpen },
  { href: "/author/tickets", label: "My Tickets", icon: MessagesSquare },
  { href: "/author/tickets/new", label: "Get Help", icon: LifeBuoy },
];
const ADMIN_LINKS: NavLink[] = [{ href: "/admin/tickets", label: "Ticket Queue", icon: Inbox }];

function isActive(pathname: string, href: string, links: NavLink[]) {
  // Pick the most specific matching link, so "/author/tickets/new" doesn't also light up "My Tickets".
  const best = links
    .filter((l) => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}

/** Guards a page: logged-out users go to /login, wrong-role users go to their own home. Renders the app shell. */
export function RequireRole({ role, children }: { role: Role; children: (user: User) => React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!user)
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading your workspace…
      </div>
    );

  const links = role === "admin" ? ADMIN_LINKS : AUTHOR_LINKS;
  const logout = () => {
    tokenStore.clear();
    router.replace("/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow">
          <BookOpen className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">BookLeaf</p>
          <p className="text-xs leading-tight text-brand-200">{role === "admin" ? "Support Desk" : "Author Portal"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href, links);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-white/15 text-white shadow-inner" : "text-brand-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 transition group-hover:scale-110 ${active ? "text-white" : "text-brand-200"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-2xl bg-white/10 p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size="sm" tone={role === "admin" ? "amber" : "brand"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-brand-200">{user.email}</p>
          </div>
          <ThemeToggle className="text-brand-200 hover:bg-white/10 hover:text-white" />
          <button onClick={logout} title="Log out" className="rounded-lg p-1.5 text-brand-200 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="brand-panel fixed inset-y-0 left-0 hidden w-64 bg-gradient-to-b from-brand-900 to-brand-800 lg:block">{sidebar}</aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
        <span className="font-semibold text-brand-700">BookLeaf</span>
        <div className="flex items-center gap-1">
          <ThemeToggle className="p-2 text-slate-600 hover:bg-slate-100" />
          <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 animate-fade-in" onClick={() => setMenuOpen(false)} />
          <aside className="brand-panel absolute inset-y-0 left-0 w-64 bg-gradient-to-b from-brand-900 to-brand-800 animate-slide-up">
            <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-5 text-brand-200" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children(user)}</main>
    </div>
  );
}
