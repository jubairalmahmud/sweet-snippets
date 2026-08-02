// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import {
  useAdminReports,
  useReviewReport,
  useAdminSettings,
  useUpsertSetting,
  useDeleteSetting,
  useAuditLogs,
} from "@/sk-love/lib/hooks";
import { api } from "@/sk-love/lib/api";
import AdminPanel, { type Agency, type AgencyHost } from "@/sk-love/components/AdminPanel";

const DEFAULT_ADMIN_BANNERS = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=450&auto=format&fit=crop&q=60",
    title: "Celebrate love and real-time live events!",
    mediaType: "image" as const,
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=450&auto=format&fit=crop&q=60",
    title: "Find the absolute best premium broadcasters!",
    mediaType: "image" as const,
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=450&auto=format&fit=crop&q=60",
    title: "Start your agency and earn real cash-outs!",
    mediaType: "image" as const,
  },
];

type AdminBanner = {
  id: number;
  url: string;
  title: string;
  mediaType?: "image" | "video" | "gif";
};

const detectBannerMediaType = (url?: string): "image" | "video" | "gif" => {
  const value = String(url || "").toLowerCase();
  if (value.startsWith("data:video/") || value.includes(".mp4")) return "video";
  if (value.startsWith("data:image/gif") || value.includes(".gif")) return "gif";
  return "image";
};

const normalizeBannerRecord = (row: any, index: number): AdminBanner => ({
  id: Number(row?.id || index + 1),
  url: row?.image || row?.url || DEFAULT_ADMIN_BANNERS[index]?.url || DEFAULT_ADMIN_BANNERS[0].url,
  title:
    row?.title ||
    row?.subtitle ||
    DEFAULT_ADMIN_BANNERS[index]?.title ||
    DEFAULT_ADMIN_BANNERS[0].title,
  mediaType: row?.mediaType || detectBannerMediaType(row?.image || row?.url),
});

export const Route = createFileRoute("/admin-panel")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard - SK Love" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPanelPage,
});

type Tab = "control" | "reports" | "audit" | "settings";

export function AdminPanelPage() {
  const [tab, setTab] = useState<Tab>("control");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const raw = localStorage.getItem("sk_love_user");
        const token = localStorage.getItem("sk_love_token");
        if (!raw || !token) {
          window.location.assign("/admin");
          return;
        }
        const cached = JSON.parse(raw);
        if (cached?.role !== "admin" && cached?.isAdmin !== true && cached?.is_admin !== true) {
          window.location.assign("/admin");
          return;
        }
        const me: any = await api.get("/api/me");
        const user = me?.user || {};
        if (user.role !== "admin" && user.isAdmin !== true && user.is_admin !== true) {
          window.location.assign("/admin");
          return;
        }
        if (active) setAuthed(true);
      } catch {
        window.location.assign("/admin");
      }
    };
    verify();
    return () => {
      active = false;
    };
  }, []);

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0820] via-[#131024] to-[#1a0a2a] text-white">
      <header className="border-b border-pink-500/20 bg-[#131024]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👑</span>
            <h1 className="text-lg font-black">SK Love Admin</h1>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("sk_love_token");
              localStorage.removeItem("sk_love_user");
              window.location.assign("/admin");
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            লগআউট
          </button>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 text-sm overflow-x-auto">
          {(
            [
              ["control", "🎛️ Control Center"],
              ["reports", "🚩 Reports"],
              ["audit", "📜 Audit Logs"],
              ["settings", "⚙️ App Settings"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 -mb-px border-b-2 transition whitespace-nowrap ${
                tab === key
                  ? "border-pink-500 text-pink-300 font-bold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "control" && <ControlCenterTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "audit" && <AuditTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}

function ControlCenterTab() {
  const [agencyList, setAgencyList] = useState<Agency[]>([]);
  const [depositsList, setDepositsList] = useState<any[]>([]);
  const [newAgency, setNewAgency] = useState({
    name: "",
    code: "",
    commission: 10,
    monthlyTarget: 100000,
    targetHours: 40,
    baseSalaryRules: "",
  });
  const [appLogo, setAppLogo] = useState("🌹 SK LOVE");
  const [sliderBanners, setSliderBanners] = useState<AdminBanner[]>(DEFAULT_ADMIN_BANNERS);
  const bannerSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingBanners = useRef(false);
  const [configurableGifts, setConfigurableGifts] = useState<any[]>([]);
  const [callApiSettings, setCallApiSettings] = useState({
    rtcAppId: "",
    rtcServerUrl: "",
    isRealStreamEnabled: false,
    maxCallDuration: 30,
  });
  const [bannedUserIds, setBannedUserIds] = useState<number[]>([]);
  const [bannedEmails, setBannedEmails] = useState<string[]>([]);
  const [simulatedUsers, setSimulatedUsers] = useState<any[]>([]);
  const [globalTheme, setGlobalTheme] = useState("default");
  const [deepArLicenseKey, setDeepArLicenseKey] = useState("");
  const [deepArEffects, setDeepArEffects] = useState<any[]>([]);
  const [agencyHosts, setAgencyHosts] = useState<AgencyHost[]>([]);
  const [feedback, setFeedback] = useState("");

  const normalizeAgency = (agency: any): Agency => ({
    id: Number(agency.id),
    name: agency.name,
    code: agency.code,
    commission: Number(agency.commission || 0),
    hostsCount: Number(agency.hosts_count ?? agency.hostsCount ?? 0),
    status: agency.status || "active",
    monthlyTarget: Number(agency.monthly_target ?? agency.monthlyTarget ?? 0),
    targetHours: Number(agency.target_hours ?? agency.targetHours ?? 0),
    baseSalaryRules: agency.base_salary_rules ?? agency.baseSalaryRules ?? "",
  });

  const normalizeDeposit = (deposit: any) => ({
    id: Number(deposit.id),
    amount: Number(deposit.amount || 0),
    method: deposit.method || "",
    txId: deposit.tx_id || deposit.txId || "",
    diamonds: Number(deposit.diamonds || 0),
    status: deposit.status || "pending",
    date: String(deposit.created_at || deposit.date || "").substring(0, 10),
  });

  const normalizeUser = (user: any) => ({
    id: Number(user.id),
    name: user.name || user.email || `User ${user.id}`,
    username: user.username || (user.email ? user.email.split("@")[0] : `user${user.id}`),
    avatar: user.avatar || "👤",
    vipLevel: Number(user.vip_level ?? user.vipLevel ?? 1),
    status: user.is_banned ? "Suspended" : "Active",
    rCoins: Number(user.r_coins ?? user.rCoins ?? 0),
    bio: user.bio || "",
    email: user.email || "",
  });

  const normalizeHost = (host: any): AgencyHost => ({
    id: Number(host.id),
    name: host.name || host.username || `Host ${host.id}`,
    username: host.username || "",
    status: host.status || "Active",
    liveHours: Number(host.live_hours ?? host.liveHours ?? 0),
    diamondsReceived: Number(host.diamonds_received ?? host.diamondsReceived ?? 0),
    agencyCode: host.agency_code ?? host.agencyCode ?? "",
    salaryReleased: Boolean(host.salary_released ?? host.salaryReleased ?? false),
  });

  const loadBannerSettings = async () => {
    isLoadingBanners.current = true;
    try {
      const response = await api.get<any>("/api/admin/banners?placement=home");
      const rows = Array.isArray(response?.data) ? response.data.slice(0, 3) : [];
      const completeRows = [...rows];

      for (let index = completeRows.length; index < 3; index += 1) {
        const fallback = DEFAULT_ADMIN_BANNERS[index];
        const created = await api.post<any>("/api/admin/banners", {
          title: fallback.title,
          subtitle: fallback.title,
          image: fallback.url,
          placement: "home",
          sortOrder: index,
          active: true,
        });
        completeRows.push(created?.data);
      }

      setSliderBanners(completeRows.slice(0, 3).map(normalizeBannerRecord));
    } catch (err: any) {
      setFeedback(err?.message || "Banner settings load failed.");
    } finally {
      isLoadingBanners.current = false;
    }
  };

  const persistBannerSettings = async (nextBanners: AdminBanner[]) => {
    try {
      const saved = await Promise.all(
        nextBanners.slice(0, 3).map(async (banner, index) => {
          const fallback = DEFAULT_ADMIN_BANNERS[index];
          const payload = {
            title: banner.title || fallback.title,
            subtitle: banner.title || fallback.title,
            image: banner.url || fallback.url,
            placement: "home",
            sortOrder: index,
            active: true,
          };

          if (banner.id) {
            try {
              const updated = await api.patch<any>(`/api/admin/banners/${banner.id}`, payload);
              return updated?.data;
            } catch (err: any) {
              if (err?.status !== 404) throw err;
            }
          }

          const created = await api.post<any>("/api/admin/banners", payload);
          return created?.data;
        }),
      );

      setSliderBanners((current) =>
        current.map((banner, index) =>
          saved[index] ? { ...banner, ...normalizeBannerRecord(saved[index], index) } : banner,
        ),
      );
      setFeedback("Banner slider saved.");
    } catch (err: any) {
      setFeedback(err?.message || "Banner slider save failed.");
    }
  };

  const setPersistedSliderBanners: React.Dispatch<React.SetStateAction<AdminBanner[]>> = (
    value,
  ) => {
    setSliderBanners((previous) => {
      const next = typeof value === "function" ? value(previous) : value;

      if (!isLoadingBanners.current) {
        if (bannerSaveTimer.current) clearTimeout(bannerSaveTimer.current);
        bannerSaveTimer.current = setTimeout(() => {
          void persistBannerSettings(next);
        }, 500);
      }

      return next;
    });
  };

  const loadControlData = async () => {
    try {
      setFeedback("");
      const [deposits, agencies, users] = await Promise.all([
        api.get<any>("/api/admin/deposits").catch((err) => ({ error: err, deposits: [] })),
        api.get<any>("/api/agencies").catch((err) => ({ error: err, agencies: [] })),
        api.get<any>("/api/admin/users").catch((err) => ({ error: err, users: [] })),
      ]);

      setDepositsList((deposits.deposits || deposits.data || []).map(normalizeDeposit));
      const agencyRows = (agencies.agencies || agencies.data || []).map(normalizeAgency);
      setAgencyList(agencyRows);
      setSimulatedUsers((users.users || users.data || []).map(normalizeUser));

      const hostLists = await Promise.all(
        agencyRows.map((agency: Agency) =>
          api
            .get<any>(`/api/admin/agencies/${agency.code}/hosts`)
            .then((res) => res.hosts || res.data || [])
            .catch(() => []),
        ),
      );
      setAgencyHosts(hostLists.flat().map(normalizeHost));
    } catch (err: any) {
      setFeedback(err?.message || "Admin control data load failed.");
    }
  };

  useEffect(() => {
    void loadControlData();
    void loadBannerSettings();
    return () => {
      if (bannerSaveTimer.current) clearTimeout(bannerSaveTimer.current);
    };
  }, []);

  const approveDeposit = async (id: number) => {
    await api.post(`/api/admin/deposits/${id}/approve`);
    await loadControlData();
  };

  const rejectDeposit = async (id: number) => {
    await api.post(`/api/admin/deposits/${id}/reject`);
    await loadControlData();
  };

  const generateUniqueNumberId = () =>
    Math.floor(Date.now() % 1_000_000_000) + Math.floor(Math.random() * 1000);

  const handleAddAgency = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newAgency.name.trim() || !newAgency.code.trim()) return;
    try {
      const response = await api.post<any>("/api/admin/agencies", newAgency);
      const created = normalizeAgency(response.agency || response.data || {});
      setAgencyList((previous) => [created, ...previous.filter((a) => a.id !== created.id)]);
      setNewAgency({
        name: "",
        code: "",
        commission: 10,
        monthlyTarget: 100000,
        targetHours: 40,
        baseSalaryRules: "",
      });
      setFeedback(`Agency ${created.code} created.`);
    } catch (err: any) {
      setFeedback(err?.message || "Agency create failed.");
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="rounded-lg border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-xs text-pink-100">
          {feedback}
        </div>
      )}
      <AdminPanel
        agencyList={agencyList}
        depositsList={depositsList}
        setDepositsList={setDepositsList}
        approveDeposit={(id) => void approveDeposit(id)}
        rejectDeposit={(id) => void rejectDeposit(id)}
        newAgency={newAgency}
        setNewAgency={setNewAgency}
        handleAddAgency={handleAddAgency}
        appLogo={appLogo}
        setAppLogo={setAppLogo}
        sliderBanners={sliderBanners}
        setSliderBanners={setPersistedSliderBanners}
        generateUniqueNumberId={generateUniqueNumberId}
        configurableGifts={configurableGifts}
        setConfigurableGifts={setConfigurableGifts}
        callApiSettings={callApiSettings}
        setCallApiSettings={setCallApiSettings}
        bannedUserIds={bannedUserIds}
        setBannedUserIds={setBannedUserIds}
        bannedEmails={bannedEmails}
        setBannedEmails={setBannedEmails}
        simulatedUsers={simulatedUsers}
        setSimulatedUsers={setSimulatedUsers}
        globalTheme={globalTheme}
        setGlobalTheme={setGlobalTheme}
        deepArLicenseKey={deepArLicenseKey}
        setDeepArLicenseKey={setDeepArLicenseKey}
        deepArEffects={deepArEffects}
        setDeepArEffects={setDeepArEffects}
        agencyHosts={agencyHosts}
        setAgencyHosts={setAgencyHosts}
      />
    </div>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState<"pending" | "resolved" | "rejected">("pending");
  const { data, isLoading, error } = useAdminReports(status);
  const review = useReviewReport();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">User Reports</h2>
        <div className="flex gap-1 text-xs">
          {(["pending", "resolved", "rejected"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className={`px-3 py-1.5 rounded-lg ${
                status === item ? "bg-pink-600" : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">Load failed: {(error as any)?.message}</p>}

      <div className="space-y-2">
        {(data?.data ?? []).map((report: any) => (
          <div
            key={report.id}
            className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3"
          >
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[10px] bg-pink-600/20 text-pink-300 rounded">
                  {report.target_type}#{report.target_id}
                </span>
                <span className="text-slate-400 text-xs">by user #{report.reporter_id}</span>
              </div>
              <div className="font-semibold">{report.reason}</div>
              {report.description && (
                <p className="text-slate-400 text-xs mt-1">{report.description}</p>
              )}
            </div>
            {status === "pending" && (
              <div className="flex gap-2">
                <button
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: report.id, status: "resolved" })}
                  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                >
                  Resolve
                </button>
                <button
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: report.id, status: "rejected" })}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {!isLoading && (data?.data ?? []).length === 0 && (
          <p className="text-slate-500 text-sm text-center py-12">No {status} reports.</p>
        )}
      </div>
    </section>
  );
}

function AuditTab() {
  const [action, setAction] = useState("");
  const { data, isLoading, error } = useAuditLogs({ action: action || undefined, limit: 100 });

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-xl font-bold">Audit Logs</h2>
        <input
          value={action}
          onChange={(event) => setAction(event.target.value)}
          placeholder="filter action"
          className="bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-1.5 text-xs w-64"
        />
      </div>
      {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">Load failed: {(error as any)?.message}</p>}
      <div className="overflow-x-auto bg-slate-900/60 border border-slate-700/60 rounded-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400 border-b border-slate-700/60">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((log: any) => (
              <tr key={log.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-xs">#{log.actor_id}</td>
                <td className="px-3 py-2 text-xs font-mono text-pink-300">{log.action}</td>
                <td className="px-3 py-2 text-xs text-slate-300">
                  {log.target_type ? `${log.target_type}#${log.target_id}` : "-"}
                </td>
                <td className="px-3 py-2 text-[11px] text-slate-500 font-mono max-w-md truncate">
                  {log.meta ? JSON.stringify(log.meta) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsTab() {
  const { data, isLoading } = useAdminSettings();
  const upsert = useUpsertSetting();
  const del = useDeleteSetting();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim()) return;
    let parsed: any = value;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
    await upsert.mutateAsync({ key: key.trim(), value: parsed });
    setKey("");
    setValue("");
  };

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">Global App Settings</h2>
      <form
        onSubmit={submit}
        className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 mb-5 flex flex-col md:flex-row gap-2 md:items-end"
      >
        <div className="flex-1">
          <label className="block text-[10px] text-slate-400 mb-1 uppercase">Key</label>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="e.g. min_withdraw"
            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] text-slate-400 mb-1 uppercase">Value</label>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder='100 or {"enabled":true}'
            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          disabled={upsert.isPending}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold disabled:opacity-60"
        >
          {upsert.isPending ? "Saving..." : "Save"}
        </button>
      </form>
      {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
      <div className="overflow-x-auto bg-slate-900/60 border border-slate-700/60 rounded-xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-400 border-b border-slate-700/60">
            <tr>
              <th className="px-3 py-2">Key</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((setting: any) => (
              <tr
                key={setting.key}
                className="border-b border-slate-800/60 hover:bg-slate-800/30"
              >
                <td className="px-3 py-2 font-mono text-xs text-pink-300">{setting.key}</td>
                <td className="px-3 py-2 text-xs text-slate-300 font-mono break-all">
                  {typeof setting.value === "string"
                    ? setting.value
                    : JSON.stringify(setting.value)}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => del.mutate(setting.key)}
                    className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/40"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
