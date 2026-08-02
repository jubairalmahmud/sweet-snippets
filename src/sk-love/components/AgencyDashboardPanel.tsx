// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Download, Search, UserPlus, Check, X, Trash2, DollarSign, FileText, Lock } from "lucide-react";
import { api } from "../lib/api";

/**
 * Agency Partner Dashboard — wired to Laravel backend
 *   GET    /api/agency/hosts
 *   POST   /api/agency/hosts                 { user_id }
 *   DELETE /api/agency/hosts/{id}
 *   GET    /api/agency/host-requests
 *   POST   /api/agency/host-requests/{id}/approve
 *   POST   /api/agency/host-requests/{id}/reject
 *   GET    /api/agency/target
 *   GET    /api/agency/reports?range=daily|weekly|monthly&host_id=?
 *   GET    /api/agency/reports/export?range=...
 */

type TabKey = "overview" | "requests" | "hosts" | "target" | "reports" | "salary";

type SalaryRow = {
  sl: number;
  host_user_id: number;
  id_code: string;
  name: string;
  days: number;
  hours: number;
  points: number;
  salary_usd: number;
  bonus_usd: number;
  total_usd: number;
  note?: string | null;
};

type SalaryData = {
  year: number;
  month: number;
  period_start: string;
  period_end: string;
  status: "preview" | "locked";
  points_to_usd: number;
  agency_share_pct: number;
  agency_name?: string;
  summary: {
    sum_salary_usd: number;
    sum_bonus_usd: number;
    sum_total_usd: number;
    agency_share_usd: number;
    net_payable_usd: number;
  };
  rows: SalaryRow[];
};

type MonthOpt = { year: number; month: number; label: string };

type HostRow = {
  host_id: number;
  user: { id: number; name?: string; username?: string | null; avatar?: string | null; gender?: string | null };
  joined_at?: string | null;
  progress?: {
    coins_earned: number;
    live_hours: number;
    diamonds_earned: number;
    coins_pct: number | null;
    hours_pct: number | null;
    diamonds_pct: number | null;
  };
};

type RequestRow = {
  host_id: number;
  user: { id: number; name?: string; username?: string | null; avatar?: string | null };
  requested_at?: string;
  notes?: string | null;
};

type TargetRow = {
  id: number;
  coins_target?: number | null;
  live_hours_target?: number | string | null;
  diamonds_target?: number | null;
  period_start: string;
  period_end: string;
  active?: boolean;
} | null;

type ReportRow = {
  date: string;
  host_user_id: number;
  host_name?: string | null;
  coins_earned: number;
  live_hours: number;
  diamonds_earned: number;
};

const API_BASE = String(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_LARAVEL_URL ||
    "https://api.keno70.com",
).replace(/\/+$/, "");

const Avatar: React.FC<{ src?: string | null; name?: string; size?: number }> = ({ src, name, size = 32 }) => {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name || "user"}
      style={{ width: size, height: size }}
      className="rounded-full object-cover border border-slate-800"
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-emerald-900/50 border border-emerald-800 flex items-center justify-center text-emerald-300 text-[11px] font-bold"
    >
      {initial}
    </div>
  );
};

const Badge: React.FC<{ tone?: "emerald" | "amber" | "cyan" | "rose" | "slate"; children: React.ReactNode }> = ({
  tone = "slate",
  children,
}) => {
  const map: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    slate: "bg-slate-500/10 text-slate-300 border-slate-500/25",
  };
  return (
    <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border leading-none ${map[tone]}`}>
      {children}
    </span>
  );
};

const ProgressBar: React.FC<{ pct: number | null | undefined; tone?: string }> = ({ pct, tone = "bg-emerald-500" }) => {
  const w = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
      <div className={`h-full ${tone} transition-all`} style={{ width: `${w}%` }} />
    </div>
  );
};

export interface AgencyDashboardPanelProps {
  onClose: () => void;
  showToast?: (msg: string) => void;
}

const AgencyDashboardPanel: React.FC<AgencyDashboardPanelProps> = ({ onClose, showToast }) => {
  const toast = useCallback((m: string) => (showToast ? showToast(m) : console.log("[agency]", m)), [showToast]);

  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [target, setTarget] = useState<TargetRow>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportRange, setReportRange] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [reportHostId, setReportHostId] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // ---- Salary tab state ----
  const now = new Date();
  const [salYear, setSalYear] = useState<number>(now.getFullYear());
  const [salMonth, setSalMonth] = useState<number>(now.getMonth() + 1);
  const [salary, setSalary] = useState<SalaryData | null>(null);
  const [salaryMonths, setSalaryMonths] = useState<MonthOpt[]>([]);
  const [salLoading, setSalLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, r, t] = await Promise.all([
        api.get<any>("/api/agency/hosts").catch((e) => ({ __err: e.message })),
        api.get<any>("/api/agency/host-requests").catch((e) => ({ __err: e.message })),
        api.get<any>("/api/agency/target").catch((e) => ({ __err: e.message })),
      ]);
      if ((h as any).__err) throw new Error((h as any).__err);
      setHosts(Array.isArray(h?.hosts) ? h.hosts : []);
      setRequests(Array.isArray((r as any)?.requests) ? (r as any).requests : []);
      setTarget((t as any)?.target ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load agency data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ range: reportRange });
      if (reportHostId) qs.set("host_id", String(reportHostId));
      const res = await api.get<any>(`/api/agency/reports?${qs.toString()}`);
      setReports(Array.isArray(res?.rows) ? res.rows : []);
    } catch (e: any) {
      toast(e?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [reportRange, reportHostId, toast]);

  const loadSalary = useCallback(async () => {
    setSalLoading(true);
    try {
      const [m, s] = await Promise.all([
        api.get<any>("/api/agency/salary/months").catch(() => ({ months: [] })),
        api.get<any>(`/api/agency/salary?year=${salYear}&month=${salMonth}`),
      ]);
      setSalaryMonths(Array.isArray(m?.months) ? m.months : []);
      setSalary(s as SalaryData);
    } catch (e: any) {
      toast(e?.message || "Failed to load salary");
    } finally {
      setSalLoading(false);
    }
  }, [salYear, salMonth, toast]);

  const downloadSalaryPdf = () => {
    const token = (typeof window !== "undefined" && window.localStorage.getItem("sk_love_token")) || "";
    const url = `${API_BASE}/api/agency/salary/pdf?year=${salYear}&month=${salMonth}`;
    fetch(url, { headers: { Accept: "application/pdf", Authorization: token ? `Bearer ${token}` : "" } })
      .then((r) => {
        if (!r.ok) throw new Error(`PDF failed (${r.status})`);
        return r.blob().then((b) => ({ blob: b, ct: r.headers.get("content-type") || "" }));
      })
      .then(({ blob, ct }) => {
        const ext = ct.includes("pdf") ? "pdf" : "html";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `salary_${salYear}_${String(salMonth).padStart(2, "0")}.${ext}`;
        document.body.appendChild(a); a.click(); a.remove();
      })
      .catch((e) => toast(e.message || "Download failed"));
  };

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === "reports") loadReports();
  }, [tab, loadReports]);

  useEffect(() => {
    if (tab === "salary") loadSalary();
  }, [tab, loadSalary]);

  const activeCount = hosts.length;
  const pendingCount = requests.length;

  const totals = useMemo(() => {
    return hosts.reduce(
      (a, h) => {
        a.coins += h.progress?.coins_earned || 0;
        a.hours += h.progress?.live_hours || 0;
        a.diamonds += h.progress?.diamonds_earned || 0;
        return a;
      },
      { coins: 0, hours: 0, diamonds: 0 },
    );
  }, [hosts]);

  const filteredHosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        String(h.user?.id).includes(q) ||
        (h.user?.name || "").toLowerCase().includes(q) ||
        (h.user?.username || "").toLowerCase().includes(q),
    );
  }, [hosts, search]);

  const approveReq = async (id: number) => {
    try {
      await api.post(`/api/agency/host-requests/${id}/approve`);
      toast("✅ Host request approved");
      loadAll();
    } catch (e: any) {
      toast(e?.message || "Approve failed");
    }
  };
  const rejectReq = async (id: number) => {
    try {
      await api.post(`/api/agency/host-requests/${id}/reject`);
      toast("❌ Host request rejected");
      loadAll();
    } catch (e: any) {
      toast(e?.message || "Reject failed");
    }
  };
  const removeHost = async (id: number) => {
    if (!confirm("Remove this host from your agency?")) return;
    try {
      await api.delete(`/api/agency/hosts/${id}`);
      toast("🗑️ Host removed");
      loadAll();
    } catch (e: any) {
      toast(e?.message || "Remove failed");
    }
  };
  const addHost = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = parseInt(addUserId.trim(), 10);
    if (!uid) return toast("Enter a valid User ID");
    setAddBusy(true);
    try {
      await api.post("/api/agency/hosts", { user_id: uid });
      toast(`✅ Host #${uid} added`);
      setAddUserId("");
      loadAll();
    } catch (e: any) {
      toast(e?.message || "Add failed");
    } finally {
      setAddBusy(false);
    }
  };

  const exportCsv = () => {
    const token = (typeof window !== "undefined" && window.localStorage.getItem("sk_love_token")) || "";
    const url = `${API_BASE}/api/agency/reports/export?range=${reportRange}${token ? `&_t=${Date.now()}` : ""}`;
    // Use fetch to include auth header, then trigger download
    fetch(url, { headers: { Accept: "text/csv", Authorization: token ? `Bearer ${token}` : "" } })
      .then((r) => {
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `agency_report_${reportRange}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((e) => toast(e.message || "Export failed"));
  };

  const TabBtn: React.FC<{ k: TabKey; label: string; count?: number }> = ({ k, label, count }) => (
    <button
      onClick={() => setTab(k)}
      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition ${
        tab === k ? "text-emerald-300 border-b-2 border-emerald-400" : "text-slate-400 border-b-2 border-transparent hover:text-slate-200"
      }`}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[8px] border border-emerald-500/30">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="absolute inset-0 bg-[#0a0818] z-55 flex flex-col font-sans text-slate-100 animate-slideUp">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-900 bg-[#120f26] flex items-center justify-between sticky top-0 z-20 shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-100/10 flex items-center justify-center border border-slate-800 transition active:scale-95 cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <span className="font-extrabold text-[10px] tracking-wider text-emerald-400 uppercase">
          🤝 Agency Partner Dashboard
        </span>
        <button
          onClick={loadAll}
          className="w-8 h-8 rounded-full bg-slate-900/60 hover:bg-slate-100/10 flex items-center justify-center border border-slate-800 transition active:scale-95 cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#120f26] border-b border-slate-900 shrink-0">
        <TabBtn k="overview" label="Overview" />
        <TabBtn k="requests" label="Requests" count={pendingCount} />
        <TabBtn k="hosts" label="Hosts" count={activeCount} />
        <TabBtn k="target" label="Target" />
        <TabBtn k="reports" label="Reports" />
        <TabBtn k="salary" label="Salary" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin text-left">
        {error && (
          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-200">
            ⚠ {error}
          </div>
        )}

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            <div className="bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-900/40 p-4 rounded-2xl">
              <h3 className="text-sm font-black text-emerald-400">Welcome, Official Agent!</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                Manage host requests, monitor progress against the active target, and export monthly reports for payout.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-center">
                <p className="text-xl font-black text-white">{activeCount}</p>
                <p className="text-[8px] text-emerald-300 font-black uppercase">Active Hosts</p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-center">
                <p className="text-xl font-black text-white">{pendingCount}</p>
                <p className="text-[8px] text-amber-300 font-black uppercase">Pending</p>
              </div>
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-center">
                <p className="text-xl font-black text-white">{activeCount + pendingCount}</p>
                <p className="text-[8px] text-cyan-300 font-black uppercase">Total</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                <p className="text-[8px] text-slate-400 font-black uppercase">Coins This Period</p>
                <p className="text-sm font-black text-amber-300 mt-1 font-mono">{totals.coins.toLocaleString()} 🪙</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                <p className="text-[8px] text-slate-400 font-black uppercase">Live Hours</p>
                <p className="text-sm font-black text-cyan-300 mt-1 font-mono">{totals.hours.toFixed(1)} h</p>
              </div>
            </div>

            {target && (
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black uppercase text-slate-300">Active Target</h4>
                  <Badge tone="emerald">
                    {target.period_start} → {target.period_end}
                  </Badge>
                </div>
                {target.coins_target ? (
                  <div>
                    <div className="flex justify-between text-[9px] text-slate-300 mb-1">
                      <span>Coins</span>
                      <span className="font-mono">
                        {totals.coins.toLocaleString()} / {Number(target.coins_target).toLocaleString()}
                      </span>
                    </div>
                    <ProgressBar pct={(totals.coins / Number(target.coins_target)) * 100} tone="bg-amber-400" />
                  </div>
                ) : null}
                {target.live_hours_target ? (
                  <div>
                    <div className="flex justify-between text-[9px] text-slate-300 mb-1">
                      <span>Live Hours</span>
                      <span className="font-mono">
                        {totals.hours.toFixed(1)} / {Number(target.live_hours_target)}
                      </span>
                    </div>
                    <ProgressBar pct={(totals.hours / Number(target.live_hours_target)) * 100} tone="bg-cyan-400" />
                  </div>
                ) : null}
                {null}
              </div>
            )}
          </>
        )}

        {/* REQUESTS */}
        {tab === "requests" && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase text-slate-300 tracking-wider">Pending Join Requests</h4>
            {requests.length === 0 && (
              <p className="text-center text-[10px] text-slate-500 py-6">No pending requests.</p>
            )}
            {requests.map((r) => (
              <div
                key={r.host_id}
                className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar src={r.user?.avatar} name={r.user?.name} />
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-white truncate">
                      {r.user?.name || "Unknown"}
                      <span className="text-[8px] text-slate-500 font-mono ml-1">#{r.user?.id}</span>
                    </p>
                    <p className="text-[8px] text-slate-400 truncate">{r.notes || "No note"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => approveReq(r.host_id)}
                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => rejectReq(r.host_id)}
                    className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HOSTS */}
        {tab === "hosts" && (
          <div className="space-y-3">
            <form onSubmit={addHost} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-[10px] font-extrabold text-white flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Add Host by User ID
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  placeholder="Enter numeric User ID"
                  className="flex-1 bg-slate-950 p-2 text-[11px] rounded-lg text-white border border-slate-800 outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={addBusy}
                  className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] disabled:opacity-50"
                >
                  {addBusy ? "Adding…" : "Add"}
                </button>
              </div>
            </form>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, username, or ID"
                className="w-full bg-slate-900 border border-slate-800 pl-8 pr-3 py-2 rounded-lg text-[11px] text-white outline-none focus:border-emerald-500"
              />
            </div>

            {filteredHosts.length === 0 && (
              <p className="text-center text-[10px] text-slate-500 py-6">No hosts yet.</p>
            )}

            <div className="space-y-2">
              {filteredHosts.map((h) => (
                <div key={h.host_id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar src={h.user?.avatar} name={h.user?.name} size={36} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">
                          {h.user?.name || "Unknown"}
                          <span className="text-[8px] text-slate-500 font-mono ml-1">#{h.user?.id}</span>
                        </p>
                        <p className="text-[8px] text-slate-400">
                          Joined: {h.joined_at ? new Date(h.joined_at).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeHost(h.host_id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-300"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[9px]">
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-amber-300 font-bold">Coins</span>
                        <span className="text-slate-400 font-mono">
                          {(h.progress?.coins_earned || 0).toLocaleString()}
                        </span>
                      </div>
                      <ProgressBar pct={h.progress?.coins_pct} tone="bg-amber-400" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-cyan-300 font-bold">Hours</span>
                        <span className="text-slate-400 font-mono">
                          {(h.progress?.live_hours || 0).toFixed(1)}h
                        </span>
                      </div>
                      <ProgressBar pct={h.progress?.hours_pct} tone="bg-cyan-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TARGET */}
        {tab === "target" && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-black uppercase text-slate-300 tracking-wider">Active Monthly Target</h4>
            {!target && (
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900 text-[11px] text-slate-400 text-center">
                No active target set by admin.
              </div>
            )}
            {target && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-emerald-300 uppercase">Period</span>
                    <span className="text-[10px] font-mono text-white">
                      {target.period_start} → {target.period_end}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-950/60">
                      <p className="text-[8px] text-amber-300 font-black uppercase">Coins</p>
                      <p className="text-sm font-black text-white font-mono">
                        {target.coins_target ? Number(target.coins_target).toLocaleString() : "—"}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/60">
                      <p className="text-[8px] text-cyan-300 font-black uppercase">Hours</p>
                      <p className="text-sm font-black text-white font-mono">{target.live_hours_target || "—"}</p>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic text-center">
                  Targets are set by platform admins. Track your agency progress in the Overview tab.
                </p>
              </div>
            )}
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && (
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <div className="flex bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                {(["daily", "weekly", "monthly"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setReportRange(r)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase ${
                      reportRange === r ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <select
                value={reportHostId}
                onChange={(e) => setReportHostId(Number(e.target.value))}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none"
              >
                <option value={0}>All Hosts</option>
                {hosts.map((h) => (
                  <option key={h.host_id} value={h.user?.id}>
                    {h.user?.name} (#{h.user?.id})
                  </option>
                ))}
              </select>
              <button
                onClick={exportCsv}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 gap-1 px-3 py-2 text-[8px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/60">
                <span>Date</span>
                <span className="col-span-2">Host</span>
                <span className="text-right">Coins</span>
              </div>
              {reports.length === 0 && (
                <p className="text-center text-[10px] text-slate-500 py-6">No records in this range.</p>
              )}
              {reports.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-4 gap-1 px-3 py-2 text-[10px] border-b border-slate-950 last:border-0"
                >
                  <span className="font-mono text-slate-400">{row.date}</span>
                  <span className="col-span-2 text-white truncate">
                    {row.host_name || `#${row.host_user_id}`}
                    <span className="text-[8px] text-slate-500 ml-1">#{row.host_user_id}</span>
                  </span>
                  <span className="text-right font-mono text-amber-300">{row.coins_earned.toLocaleString()}</span>
                </div>
              ))}
              {reports.length > 0 && (
                <div className="grid grid-cols-4 gap-1 px-3 py-2 text-[10px] bg-slate-950/60 border-t border-slate-800 font-black">
                  <span className="col-span-3 text-slate-300">TOTAL</span>
                  <span className="text-right font-mono text-amber-300">
                    {reports.reduce((a, r) => a + r.coins_earned, 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SALARY */}
        {tab === "salary" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={`${salYear}-${salMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split("-").map(Number);
                  setSalYear(y); setSalMonth(m);
                }}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none"
              >
                {(salaryMonths.length ? salaryMonths : [{ year: salYear, month: salMonth, label: `${salYear}-${String(salMonth).padStart(2, "0")}` }]).map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
                ))}
              </select>
              <button
                onClick={loadSalary}
                className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${salLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={downloadSalaryPdf}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black flex items-center gap-1"
                title="Download PDF"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </div>

            {salary && (
              <>
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>
                    <span className="text-slate-500">Rate:</span>{" "}
                    <span className="font-mono text-white">{salary.points_to_usd}</span> USD/pt
                    <span className="mx-2 text-slate-700">|</span>
                    <span className="text-slate-500">Share:</span>{" "}
                    <span className="font-mono text-white">{salary.agency_share_pct}%</span>
                  </span>
                  <Badge tone={salary.status === "locked" ? "emerald" : "amber"}>
                    {salary.status === "locked" ? (<><Lock className="w-2.5 h-2.5 inline mr-0.5" />Locked</>) : "Preview (live)"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                    <p className="text-[8px] text-emerald-300 font-black uppercase">Total Host Salary</p>
                    <p className="text-base font-black text-white font-mono mt-1">${salary.summary.sum_salary_usd.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                    <p className="text-[8px] text-amber-300 font-black uppercase">Total Bonus</p>
                    <p className="text-base font-black text-white font-mono mt-1">${salary.summary.sum_bonus_usd.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3">
                    <p className="text-[8px] text-cyan-300 font-black uppercase">Agency Share</p>
                    <p className="text-base font-black text-white font-mono mt-1">${salary.summary.agency_share_usd.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-pink-500/25 bg-pink-500/10 p-3">
                    <p className="text-[8px] text-pink-300 font-black uppercase">Net Payable</p>
                    <p className="text-base font-black text-white font-mono mt-1">${salary.summary.net_payable_usd.toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-1 px-2 py-2 text-[8px] font-black uppercase text-slate-400 border-b border-slate-800 bg-slate-950/60">
                    <span className="col-span-1">SL</span>
                    <span className="col-span-4">Host</span>
                    <span className="col-span-1 text-right">D</span>
                    <span className="col-span-1 text-right">H</span>
                    <span className="col-span-2 text-right">Points</span>
                    <span className="col-span-1 text-right">Sal</span>
                    <span className="col-span-1 text-right">Bon</span>
                    <span className="col-span-1 text-right">Tot</span>
                  </div>
                  {salary.rows.length === 0 && (
                    <p className="text-center text-[10px] text-slate-500 py-6">No hosts in this period.</p>
                  )}
                  {salary.rows.map((r) => (
                    <div key={r.host_user_id} className="grid grid-cols-12 gap-1 px-2 py-2 text-[9.5px] border-b border-slate-950 last:border-0 items-center">
                      <span className="col-span-1 text-slate-400 font-mono">{r.sl}</span>
                      <span className="col-span-4 text-white truncate">
                        {r.name}
                        <span className="text-[8px] text-slate-500 ml-1 font-mono">#{r.id_code}</span>
                      </span>
                      <span className="col-span-1 text-right font-mono text-slate-300">{r.days}</span>
                      <span className="col-span-1 text-right font-mono text-cyan-300">{r.hours.toFixed(1)}</span>
                      <span className="col-span-2 text-right font-mono text-pink-300">{r.points.toLocaleString()}</span>
                      <span className="col-span-1 text-right font-mono text-emerald-300">${r.salary_usd.toFixed(2)}</span>
                      <span className="col-span-1 text-right font-mono text-amber-300">${r.bonus_usd.toFixed(2)}</span>
                      <span className="col-span-1 text-right font-mono text-white font-black">${r.total_usd.toFixed(2)}</span>
                    </div>
                  ))}
                  {salary.rows.length > 0 && (
                    <div className="grid grid-cols-12 gap-1 px-2 py-2 text-[9.5px] bg-slate-950/60 border-t border-slate-800 font-black">
                      <span className="col-span-8 text-slate-300">TOTAL</span>
                      <span className="col-span-1 text-right font-mono text-emerald-300">${salary.summary.sum_salary_usd.toFixed(2)}</span>
                      <span className="col-span-1 text-right font-mono text-amber-300">${salary.summary.sum_bonus_usd.toFixed(2)}</span>
                      <span className="col-span-2 text-right font-mono text-white">${salary.summary.sum_total_usd.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-slate-500 italic text-center flex items-center justify-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Auto-calculated · Rules & rates managed by Admin · This view is read-only.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgencyDashboardPanel;
