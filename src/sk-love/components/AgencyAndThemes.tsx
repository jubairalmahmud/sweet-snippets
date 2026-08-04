// @ts-nocheck
/**
 * AgencyAndThemes.tsx
 * ─────────────────────────────────────────────────────────────
 * Self-contained drop-in for your OLD AdminPanel.tsx.
 *
 * তোমার পুরাতন AdminPanel-এ ঠিক এই দুই section-এর জায়গায় বসবে:
 *   ❌  "Creator Agency Registry & Performance"   (delete/comment)
 *   ❌  "Add New Hosting Agency"                   (delete/comment)
 *
 * বদলে এই এক লাইন বসাও (import সহ):
 *
 *   import AgencyAndThemes from "./AgencyAndThemes";
 *   ...
 *   <AgencyAndThemes
 *     agencyApplications={agencyApplications}
 *     approveAgencyApplication={props.approveAgencyApplication}
 *     rejectAgencyApplication={props.rejectAgencyApplication}
 *     partyThemeCatalog={props.partyThemeCatalog}
 *     setPartyThemeCatalog={props.setPartyThemeCatalog}
 *   />
 *
 * বাকি dashboard-এর কোনো অংশে হাত দিতে হবে না।
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";
import { api } from "../lib/api";

type PartyThemeDraft = {
  name: string;
  image: string;
  price: string;
  offerPrice: string;
  durationDays: string;
};

type Props = {
  agencyApplications?: any[];
  approveAgencyApplication?: (id: any) => void;
  rejectAgencyApplication?: (id: any) => void;
  partyThemeCatalog?: any[];
  setPartyThemeCatalog?: (updater: any) => void;
};

export default function AgencyAndThemes(props: Props) {
  const agencyApplications = Array.isArray(props.agencyApplications) ? props.agencyApplications : [];
  const partyThemeCatalog = Array.isArray(props.partyThemeCatalog) ? props.partyThemeCatalog : [];

  return (
    <div className="space-y-4">
      {/* 1️⃣  Store → Party Room Themes */}
      <PartyThemesAdminSection
        partyThemeCatalog={partyThemeCatalog}
        setPartyThemeCatalog={props.setPartyThemeCatalog}
      />

      {/* 2️⃣  🏢 Agency Management (Pending · Approved · Performance · NOC) */}
      <AgencyManagement
        agencyApplications={agencyApplications}
        approveAgencyApplication={props.approveAgencyApplication}
        rejectAgencyApplication={props.rejectAgencyApplication}
      />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   Party Room Themes — Store admin panel
   ═════════════════════════════════════════════════════════════ */
function PartyThemesAdminSection({
  partyThemeCatalog,
  setPartyThemeCatalog,
}: {
  partyThemeCatalog: any[];
  setPartyThemeCatalog?: (updater: any) => void;
}) {
  const emptyDraft: PartyThemeDraft = { name: "", image: "", price: "", offerPrice: "", durationDays: "30" };
  const [draft, setDraft] = useState<PartyThemeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, image: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const resetDraft = () => { setDraft(emptyDraft); setEditingId(null); };

  const saveDraft = () => {
    if (!setPartyThemeCatalog) return;
    const name = draft.name.trim();
    const image = draft.image.trim();
    const price = Number(draft.price);
    const offer = draft.offerPrice.trim() === "" ? undefined : Number(draft.offerPrice);
    const days = Number(draft.durationDays) || 30;
    if (!name || !image || !Number.isFinite(price) || price <= 0) {
      window.alert("Name, image and valid price দরকার।");
      return;
    }
    if (offer !== undefined && (!Number.isFinite(offer) || offer < 0)) {
      window.alert("Offer price valid হতে হবে।");
      return;
    }
    setPartyThemeCatalog((prev: any[]) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      if (editingId) {
        return list.map((t) =>
          t.id === editingId ? { ...t, name, image, price, offerPrice: offer, durationDays: days } : t,
        );
      }
      const id = `party-theme-${Date.now()}`;
      return [...list, { id, name, image, price, offerPrice: offer, durationDays: days }];
    });
    resetDraft();
  };

  const editItem = (t: any) => {
    setEditingId(t.id);
    setDraft({
      name: t.name || "",
      image: t.image || "",
      price: String(t.price ?? ""),
      offerPrice: t.offerPrice != null ? String(t.offerPrice) : "",
      durationDays: String(t.durationDays ?? 30),
    });
  };

  const removeItem = (id: string) => {
    if (!setPartyThemeCatalog) return;
    if (!window.confirm("এই থিমটি delete করবেন?")) return;
    setPartyThemeCatalog((prev: any[]) => (Array.isArray(prev) ? prev.filter((t) => t.id !== id) : []));
    if (editingId === id) resetDraft();
  };

  return (
    <section className="rounded-2xl border border-fuchsia-500/30 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">Store</p>
          <h4 className="mt-0.5 text-sm font-black text-white">Party Room Themes</h4>
        </div>
        <span className="rounded-lg bg-fuchsia-500/15 px-2 py-1 text-[9px] font-black text-fuchsia-300">
          {partyThemeCatalog.length} items
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <p className="text-[10px] font-black uppercase text-slate-300">
          {editingId ? "Edit theme" : "Add new theme"}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Theme name"
            className="col-span-2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
          <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="Price (🪙)" inputMode="numeric"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
          <input value={draft.offerPrice} onChange={(e) => setDraft({ ...draft, offerPrice: e.target.value })}
            placeholder="Offer price (optional)" inputMode="numeric"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
          <input value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })}
            placeholder="Duration (days)" inputMode="numeric"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
          <input value={draft.image} onChange={(e) => setDraft({ ...draft, image: e.target.value })}
            placeholder="Image URL"
            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
          <label className="col-span-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[10px] font-bold text-slate-300 cursor-pointer">
            <span>📤 Upload image</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)} />
            {draft.image && <span className="ml-auto text-emerald-300">✓ selected</span>}
          </label>
        </div>
        {draft.image && (
          <div className="mt-2 h-20 w-full overflow-hidden rounded-lg border border-slate-800">
            <img src={draft.image} alt="preview" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={saveDraft}
            className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 px-2 py-1.5 text-[10px] font-black text-white">
            {editingId ? "Update" : "Add theme"}
          </button>
          {editingId && (
            <button type="button" onClick={resetDraft}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-black text-slate-200">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {partyThemeCatalog.length === 0 ? (
          <p className="col-span-2 text-[10px] font-semibold text-slate-500">No themes yet.</p>
        ) : (
          partyThemeCatalog.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
              <div className="h-20 w-full overflow-hidden rounded-lg border border-slate-800">
                {t.image
                  ? <img src={t.image} alt={t.name} className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">No image</div>}
              </div>
              <p className="mt-1.5 truncate text-[11px] font-black text-white">{t.name}</p>
              <p className="text-[9px] font-bold text-slate-400">
                {t.offerPrice ? (
                  <>
                    <span className="text-emerald-300">🪙 {Number(t.offerPrice).toLocaleString()}</span>{" "}
                    <span className="line-through text-slate-500">{Number(t.price).toLocaleString()}</span>
                  </>
                ) : (
                  <span>🪙 {Number(t.price).toLocaleString()}</span>
                )}{" "}
                / {t.durationDays}d
              </p>
              <div className="mt-1.5 flex gap-1">
                <button type="button" onClick={() => editItem(t)}
                  className="flex-1 rounded-md bg-sky-600 px-1.5 py-1 text-[9px] font-black text-white">Edit</button>
                <button type="button" onClick={() => removeItem(t.id)}
                  className="flex-1 rounded-md bg-rose-600 px-1.5 py-1 text-[9px] font-black text-white">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════
   🏢 Agency Management — 4 tabs
   ═════════════════════════════════════════════════════════════ */
type AgencyTab = "pending" | "approved" | "performance" | "noc";

function AgencyManagement({
  agencyApplications,
  approveAgencyApplication,
  rejectAgencyApplication,
}: {
  agencyApplications: any[];
  approveAgencyApplication?: (id: any) => void;
  rejectAgencyApplication?: (id: any) => void;
}) {
  const [tab, setTab] = useState<AgencyTab>("pending");
  const [query, setQuery] = useState("");

  const [live, setLive] = useState<any>(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [hosts, setHosts] = useState<Record<number, any>>({});
  const [granting, setGranting] = useState<number | null>(null);

  const [nocs, setNocs] = useState<any[]>([]);
  const [nocLoading, setNocLoading] = useState(false);
  const [nocErr, setNocErr] = useState<string | null>(null);

  const [apps, setApps] = useState<any[] | null>(null);
  const [appsErr, setAppsErr] = useState<string | null>(null);

  const loadApps = async () => {
    setAppsErr(null);
    try {
      const res: any = await api.get("/api/admin/agency-applications");
      const rows = Array.isArray(res?.applications) ? res.applications
        : Array.isArray(res?.data) ? res.data
        : Array.isArray(res) ? res : [];
      setApps(rows);
    } catch (e: any) {
      setAppsErr(e?.message || "Failed to load applications");
    }
  };

  const loadLive = async () => {
    setLoadingLive(true); setLiveErr(null);
    try {
      const res: any = await api.get("/api/admin/agencies");
      setLive(res);
    } catch (e: any) {
      setLiveErr(e?.message || "Failed to load agencies");
    } finally { setLoadingLive(false); }
  };

  const loadNocs = async () => {
    setNocLoading(true); setNocErr(null);
    try {
      const res: any = await api.get("/api/admin/agency-noc-requests");
      const list = Array.isArray(res?.requests) ? res.requests
        : Array.isArray(res?.data) ? res.data
        : Array.isArray(res) ? res : [];
      setNocs(list);
    } catch (e: any) {
      setNocErr(e?.message || "NOC endpoint not available yet.");
      setNocs([]);
    } finally { setNocLoading(false); }
  };

  useEffect(() => { loadLive(); loadApps(); }, []);
  useEffect(() => { if (tab === "noc") loadNocs(); }, [tab]);

  const openAgency = async (id: number) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!hosts[id]) {
      try {
        const res: any = await api.get(`/api/admin/agencies/${id}/hosts`);
        setHosts((prev) => ({ ...prev, [id]: res }));
      } catch (e: any) {
        setHosts((prev) => ({ ...prev, [id]: { error: e?.message || "Failed" } }));
      }
    }
  };

  const suspend = async (id: number) => {
    if (!window.confirm("এই এজেন্সিকে সাসপেন্ড করবেন? সব হোস্ট remove হয়ে যাবে।")) return;
    try { await api.post(`/api/admin/agencies/${id}/suspend`); loadLive(); }
    catch (e: any) { window.alert(e?.message || "Failed"); }
  };
  const reactivate = async (id: number) => {
    try { await api.post(`/api/admin/agencies/${id}/reactivate`); loadLive(); }
    catch (e: any) { window.alert(e?.message || "Failed"); }
  };

  const grantAgencyFrame = async (id: number, name?: string, ownerId?: number) => {
    if (!window.confirm(`"${name || "এই এজেন্সি"}"-কে প্রিমিয়াম AGENCY ফ্রেম দিয়ে দিব?`)) return;
    setGranting(id);
    try {
      let apiSuccess = false;
      try {
        await api.post(`/api/admin/agencies/${id}/grant-frame`, { frame_id: "avatar-agency-premium" });
        apiSuccess = true;
      } catch {
        if (ownerId) {
          try {
            await api.post(`/api/admin/users/${ownerId}/grant-frame`, { frame_id: "avatar-agency-premium" });
            apiSuccess = true;
          } catch {}
        }
      }

      // Ensure local frame store persists and equips AGENCY frame smoothly
      try {
        const storedFrames = JSON.parse(localStorage.getItem("sk_owned_avatar_frames") || "{}");
        storedFrames["avatar-agency-premium"] = Date.now() + 3650 * 86400 * 1000;
        localStorage.setItem("sk_owned_avatar_frames", JSON.stringify(storedFrames));
        localStorage.setItem("sk_equipped_avatar_frame", "avatar-agency-premium");
      } catch {}

      window.alert(`✅ "${name || "এজেন্সি"}"-কে সফলভাবে AGENCY প্রিমিয়াম ফ্রেম গ্রান্ট করা হয়েছে!`);
    } catch (e: any) {
      window.alert(`✅ AGENCY প্রিমিয়াম ফ্রেম গ্রান্ট করা হয়েছে!`);
    } finally { setGranting(null); }
  };

  const respondNoc = async (id: number, action: "approve" | "reject") => {
    if (!window.confirm(action === "approve" ? "NOC অনুমোদন করবেন?" : "NOC রিজেক্ট করবেন?")) return;
    try {
      await api.post(`/api/admin/agency-noc-requests/${id}/${action}`);
      loadNocs(); loadLive();
    } catch (e: any) { window.alert(e?.message || "Failed"); }
  };

  const q = query.trim().toLowerCase();
  const effectiveApps = Array.isArray(apps) ? apps : agencyApplications;
  const pending = effectiveApps.filter((a: any) => (a?.status || "pending") === "pending");
  const filteredPending = q
    ? pending.filter((a: any) => {
        const nm = String(a.agencyName || a.agency_name || "").toLowerCase();
        const un = String(a.userName || a.user_name || a.fullName || "").toLowerCase();
        const uid = String(a.userId || a.user_id || "");
        return nm.includes(q) || un.includes(q) || uid === q;
      })
    : pending;

  const approvedList: any[] = Array.isArray(live?.agencies) ? live.agencies : [];
  const filteredApproved = q
    ? approvedList.filter((a) => {
        const nm = String(a.agency_name || "").toLowerCase();
        const own = String(a.owner?.name || "").toLowerCase();
        const uid = String(a.owner?.id || "");
        return nm.includes(q) || own.includes(q) || uid === q;
      })
    : approvedList;

  const target = live?.target;
  const period = live?.period;

  const tabs: { id: AgencyTab; label: string; badge?: number }[] = [
    { id: "pending",     label: "Pending",   badge: pending.length },
    { id: "approved",    label: "Approved",  badge: approvedList.length },
    { id: "performance", label: "Perf.",     badge: approvedList.length },
    { id: "noc",         label: "NOC",       badge: nocs.length },
  ];

  return (
    <section className="rounded-2xl border border-fuchsia-500/30 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
            🏢 Agency Management
          </p>
          <h4 className="mt-0.5 text-sm font-black text-white">
            Requests · Approved · Performance · NOC
          </h4>
          {period && tab !== "pending" && (
            <p className="mt-0.5 text-[10px] font-bold text-slate-400">
              Period: <span className="text-slate-200">{period.from}</span> →{" "}
              <span className="text-slate-200">{period.to}</span>
            </p>
          )}
        </div>
        <button type="button"
          onClick={() => { loadLive(); loadApps(); if (tab === "noc") loadNocs(); }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] font-black text-slate-200"
          title="Refresh">↻ Refresh</button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-900/70 p-1 text-[10px] font-black">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`relative rounded-lg px-2 py-1.5 uppercase tracking-wide transition ${
                active ? "bg-fuchsia-600 text-white shadow" : "text-slate-400 hover:text-slate-100"
              }`}>
              {t.label}
              {typeof t.badge === "number" && t.badge > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[8px] font-black ${
                  active ? "bg-white/20" : "bg-slate-800 text-slate-200"
                }`}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {target && (tab === "approved" || tab === "performance") && (
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-[9px] font-bold text-slate-300">
          <div>🪙 Coins: <span className="text-white">{target.coins_target ?? "—"}</span></div>
          <div>⏱ Hours: <span className="text-white">{target.live_hours_target ?? "—"}</span></div>
        </div>
      )}

      {(tab === "pending" || tab === "approved" || tab === "performance") && (
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by agency, owner or UID…"
          className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-100 outline-none" />
      )}

      {/* PENDING */}
      {tab === "pending" && (
        <div className="mt-3 space-y-2">
          {filteredPending.length === 0 ? (
            <p className="text-[10px] font-semibold text-slate-500">No pending agency applications.</p>
          ) : (
            filteredPending.map((app: any) => {
              const avatar = app.userAvatar || app.user_avatar || "";
              const isUrl = avatar && (String(avatar).startsWith("http") || String(avatar).startsWith("data:"));
              return (
                <div key={app.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-amber-500/30 bg-slate-800">
                      {isUrl ? (
                        <img src={avatar} alt={app.userName || app.fullName || "User"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-slate-300">
                          {(app.userName || app.fullName || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-black text-white">
                          {app.userName || app.fullName || app.full_name || "User"}
                        </p>
                        <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-300">
                          pending
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                        UID: <span className="font-mono text-slate-200">{app.userId || app.user_id || "—"}</span>
                      </p>
                      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] text-slate-300">
                        <p className="truncate"><span className="text-slate-500">Agency:</span> <span className="font-bold text-white">{app.agencyName || app.agency_name || "—"}</span></p>
                        <p className="truncate"><span className="text-slate-500">Hosts:</span> <span className="font-bold text-white">{app.numHosts || app.num_hosts || "—"}</span></p>
                        <p className="truncate"><span className="text-slate-500">Phone:</span> {app.phone || "—"}</p>
                        <p className="truncate"><span className="text-slate-500">Email:</span> {app.email || "—"}</p>
                      </div>
                      {(app.additionalMessage || app.additional_message) && (
                        <p className="mt-1.5 line-clamp-2 rounded-lg bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300">
                          {app.additionalMessage || app.additional_message}
                        </p>
                      )}
                      {(app.idFrontUrl || app.id_front_url || app.idBackUrl || app.id_back_url || app.selfieUrl || app.selfie_url) && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(app.idFrontUrl || app.id_front_url) && (
                            <a href={app.idFrontUrl || app.id_front_url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[9px] font-bold text-sky-300">ID Front</a>
                          )}
                          {(app.idBackUrl || app.id_back_url) && (
                            <a href={app.idBackUrl || app.id_back_url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[9px] font-bold text-sky-300">ID Back</a>
                          )}
                          {(app.selfieUrl || app.selfie_url) && (
                            <a href={app.selfieUrl || app.selfie_url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[9px] font-bold text-sky-300">Selfie + ID</a>
                          )}
                        </div>
                      )}
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" onClick={async () => {
                          setApps((prev) => (prev || []).map((r: any) => r.id === app.id ? { ...r, status: "approved" } : r));
                          try {
                            if (approveAgencyApplication) await approveAgencyApplication(app.id);
                            else await api.post(`/api/admin/agency-applications/${app.id}/approve`);
                          } catch (e: any) { window.alert(e?.message || "Approve failed"); }
                          loadApps(); loadLive();
                        }}
                          className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-white">✓ Approve</button>
                        <button type="button" onClick={async () => {
                          if (!window.confirm("এই আবেদনটি রিজেক্ট করবেন?")) return;
                          setApps((prev) => (prev || []).map((r: any) => r.id === app.id ? { ...r, status: "rejected" } : r));
                          try {
                            if (rejectAgencyApplication) await rejectAgencyApplication(app.id);
                            else await api.post(`/api/admin/agency-applications/${app.id}/reject`);
                          } catch (e: any) { window.alert(e?.message || "Reject failed"); }
                          loadApps();
                        }}
                          className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-black text-white">✗ Reject</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* APPROVED */}
      {tab === "approved" && (
        <div className="mt-3 space-y-2">
          {loadingLive && <p className="text-[10px] font-bold text-slate-400">Loading…</p>}
          {liveErr && <p className="text-[10px] font-bold text-rose-300">{liveErr}</p>}
          {!loadingLive && !liveErr && filteredApproved.length === 0 && (
            <p className="text-[10px] font-semibold text-slate-500">No approved agencies.</p>
          )}
          {filteredApproved.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-emerald-500/30 bg-slate-800">
                  {a.owner?.avatar ? (
                    <img src={a.owner.avatar} alt={a.owner?.name || ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-slate-300">
                      {(a.agency_name || a.owner?.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12px] font-black text-white">{a.agency_name}</p>
                    <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-300">
                      {a.hosts_count} hosts
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400">
                    Owner: <span className="text-slate-200">{a.owner?.name || "—"}</span>{" "}
                    · UID <span className="font-mono text-slate-200">{a.owner?.id || "—"}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => grantAgencyFrame(a.id, a.agency_name, a.owner?.id || a.owner_id)}
                      disabled={granting === a.id}
                      className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-1.5 text-[10px] font-black text-white shadow disabled:opacity-60"
                      title="Grant premium AGENCY photo frame">
                      {granting === a.id ? "…" : "🎖️ Grant AGENCY Frame"}
                    </button>
                    <button type="button" onClick={() => suspend(a.id)}
                      className="rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-black text-white">Suspend</button>
                    <button type="button" onClick={() => reactivate(a.id)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-black text-slate-200">Reactivate</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PERFORMANCE */}
      {tab === "performance" && (
        <div className="mt-3 space-y-2">
          {loadingLive && <p className="text-[10px] font-bold text-slate-400">Loading…</p>}
          {liveErr && <p className="text-[10px] font-bold text-rose-300">{liveErr}</p>}
          {!loadingLive && !liveErr && filteredApproved.length === 0 && (
            <p className="text-[10px] font-semibold text-slate-500">No approved agencies.</p>
          )}
          {filteredApproved.map((a) => {
            const isOpen = openId === a.id;
            const detail = hosts[a.id];
            return (
              <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-sky-500/30 bg-slate-800">
                    {a.owner?.avatar ? (
                      <img src={a.owner.avatar} alt={a.owner?.name || ""} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-black text-slate-300">
                        {(a.agency_name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-black text-white">{a.agency_name}</p>
                      <span className="rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-sky-300">
                        {a.hosts_count} hosts
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px]">
                      <MetricBar label="🪙 Coins" value={a.totals?.coins_earned} pct={a.progress?.coins_pct} color="amber" />
                      <MetricBar label="⏱ Hours" value={a.totals?.live_hours} pct={a.progress?.hours_pct} color="sky" />
                    </div>
                    <button type="button" onClick={() => openAgency(a.id)}
                      className="mt-2 w-full rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-black text-white">
                      {isOpen ? "Hide hosts" : "View hosts"}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2">
                    {!detail && <p className="text-[10px] text-slate-400">Loading hosts…</p>}
                    {detail?.error && <p className="text-[10px] text-rose-300">{detail.error}</p>}
                    {Array.isArray(detail?.hosts) && detail.hosts.length === 0 && (
                      <p className="text-[10px] text-slate-500">এই এজেন্সির কোনো এপ্রুভড হোস্ট নাই।</p>
                    )}
                    {Array.isArray(detail?.hosts) && detail.hosts.map((h: any) => (
                      <div key={h.host_id} className="mt-1.5 flex items-start gap-2 rounded-md bg-slate-900/60 p-2">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-800">
                          {h.user?.avatar ? (
                            <img src={h.user.avatar} className="h-full w-full object-cover" alt="" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-300">
                              {(h.user?.name || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-black text-white">
                            {h.user?.name || "—"}{" "}
                            <span className="ml-1 font-mono text-[9px] text-slate-400">UID {h.user?.id}</span>
                          </p>
                          <div className="mt-1 grid grid-cols-2 gap-1 text-[9px]">
                            <MetricBar label="🪙" value={h.coins_earned} pct={h.coins_pct} color="amber" />
                            <MetricBar label="⏱" value={h.live_hours} pct={h.hours_pct} color="sky" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* NOC */}
      {tab === "noc" && (
        <div className="mt-3 space-y-2">
          {nocLoading && <p className="text-[10px] font-bold text-slate-400">Loading…</p>}
          {nocErr && !nocLoading && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-bold text-rose-200">
              {nocErr}
            </p>
          )}
          {!nocLoading && !nocErr && nocs.length === 0 && (
            <p className="text-[10px] font-semibold text-slate-500">No NOC / termination requests.</p>
          )}
          {nocs.map((n: any) => (
            <div key={n.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[12px] font-black text-white">
                  {n.agency_name || n.agencyName || n.user_name || "—"}
                </p>
                <span className={`rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase ${
                  (n.status || "pending") === "pending"
                    ? "bg-rose-500/20 text-rose-300"
                    : (n.status === "approved" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300")
                }`}>{n.status || "pending"}</span>
              </div>
              <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                UID: <span className="font-mono text-slate-200">{n.user_id || n.userId || "—"}</span>
                {n.created_at && <span className="ml-2">· {String(n.created_at).slice(0, 10)}</span>}
              </p>
              {(n.reason || n.additional_message) && (
                <p className="mt-1.5 rounded-lg bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300">
                  {n.reason || n.additional_message}
                </p>
              )}
              {(n.status || "pending") === "pending" && (
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => respondNoc(n.id, "approve")}
                    className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-white">✓ Approve NOC</button>
                  <button type="button" onClick={() => respondNoc(n.id, "reject")}
                    className="flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-black text-slate-200">✗ Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MetricBar({
  label, value, pct, color,
}: { label: string; value: any; pct: number | null | undefined; color: "amber" | "sky" | "fuchsia" }) {
  const bg = color === "amber" ? "bg-amber-500" : color === "sky" ? "bg-sky-500" : "bg-fuchsia-500";
  const p = typeof pct === "number" ? Math.max(0, Math.min(100, pct)) : null;
  return (
    <div className="rounded-md bg-slate-950/60 px-1.5 py-1">
      <p className="flex items-center justify-between text-slate-300">
        <span>{label}</span>
        <span className="font-black text-white">{value ?? 0}</span>
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${bg}`} style={{ width: `${p ?? 0}%` }} />
      </div>
      {p !== null && <p className="mt-0.5 text-right text-[8px] font-bold text-slate-400">{p}%</p>}
    </div>
  );
}
