"use client";

import { ArrowRight, BookOpen, Bot, Eye, EyeOff, Headset, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { btn, input, Spinner } from "@/components/ui";
import { ApiError, login } from "@/lib/api";

// Demo accounts from the seeded sample dataset, so reviewers can try both portals in one click.
const DEMO_ACCOUNTS = [
  { label: "Author", sub: "Priya Sharma", email: "priya.sharma@email.com", password: "author123", icon: UserRound },
  { label: "Support admin", sub: "BookLeaf team", email: "admin@bookleaf.com", password: "admin123", icon: Headset },
];

const FEATURES = [
  { icon: BookOpen, text: "Track every book, sale and royalty payout in one place" },
  { icon: Bot, text: "AI sorts and prioritises every query the moment it arrives" },
  { icon: Sparkles, text: "Replies drafted from BookLeaf policy and your real numbers" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(emailValue: string, passwordValue: string) {
    setError("");
    setLoading(true);
    try {
      const user = await login(emailValue.trim(), passwordValue);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}!`);
      router.replace(user.role === "admin" ? "/admin/tickets" : "/author/books");
    } catch (err) {
      setError(err instanceof ApiError ? "Incorrect email or password." : "Could not reach the server. Is the backend running?");
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-300/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">BookLeaf Publishing</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Support that keeps up with <span className="text-amber-300">every author.</span>
          </h1>
          <ul className="mt-8 space-y-4 stagger">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-50">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-sm text-brand-100">
          <ShieldCheck className="h-4 w-4" /> 22,000+ titles · authors across India and the US
        </p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 lg:hidden">
            <span className="text-lg font-semibold text-brand-800">BookLeaf Publishing</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Welcome back. Use your author or support account.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn(email, password);
            }}
            className="mt-8 space-y-4"
          >
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={`${input} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${input} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 animate-fade-in">{error}</p>}

            <button disabled={loading} className={`${btn.primary} w-full py-3`}>
              {loading ? <Spinner /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="mt-10">
            <div className="relative mb-4 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
              <span className="relative z-10 bg-[#f6f8f8] px-3">Try a demo account</span>
              <span className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map(({ label, sub, email: demoEmail, password: demoPassword, icon: Icon }) => (
                <button
                  key={demoEmail}
                  disabled={loading}
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword(demoPassword);
                    signIn(demoEmail, demoPassword);
                  }}
                  className="group rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md disabled:opacity-50"
                >
                  <Icon className="mb-2 h-5 w-5 text-brand-600 transition group-hover:scale-110" />
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">All sample authors use the password author123</p>
          </div>
        </div>
      </section>
    </main>
  );
}
