// @ts-nocheck
import { useState, type FormEvent } from "react";
import { api } from "@/sk-love/lib/api";

export function AdminLoginPage() {
  const [email, setEmail] = useState("admin@sklove.nit.bd");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const normalized = email.trim().toLowerCase();
      const data: any = await api.post(
        "/api/login",
        { email: normalized, password },
        { auth: false },
      );
      const user = data?.user;
      if (!data?.token || !user) throw new Error("Login response was incomplete.");
      if (user.role !== "admin" && user.isAdmin !== true && user.is_admin !== true) {
        throw new Error("This account is not allowed to open the admin dashboard.");
      }

      localStorage.setItem("sk_love_token", data.token);
      localStorage.setItem(
        "sk_love_user",
        JSON.stringify({
          ...user,
          role: "admin",
          isAdmin: true,
        }),
      );
      window.location.assign("/admin-panel");
    } catch (err: any) {
      setError(err?.message || "Admin login failed. Please check credentials.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#070417] via-[#131024] to-[#1b0829] p-4">
      <div className="w-full max-w-[360px] bg-[#131024]/95 border border-pink-500/35 p-6 rounded-[18px] shadow-2xl text-center">
        <div className="text-5xl mb-3 leading-none">👑</div>
        <h1 className="text-white text-xl font-black tracking-wide">SK Love Admin</h1>
        <p className="text-indigo-200 text-xs mt-1 mb-6">শুধুমাত্র অনুমোদিত এডমিনদের জন্য</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-left">
          <div>
            <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              Admin Email
            </label>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900/70 border border-indigo-500/40 focus:border-pink-500 outline-none rounded-lg px-3 py-2.5 text-sm text-white"
              placeholder="admin@sklove.nit.bd"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 mb-1 uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/70 border border-indigo-500/40 focus:border-pink-500 outline-none rounded-lg px-3 py-2.5 text-sm text-white"
              placeholder="Password"
            />
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 text-white text-sm font-black py-3 rounded-xl transition shadow"
          >
            {submitting ? "Logging in..." : "👑 Admin লগইন"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="mt-5 text-[11px] text-indigo-200 hover:text-white transition"
        >
          ← সাধারণ ইউজার লগইনে ফিরুন
        </button>
      </div>
    </div>
  );
}
