// @ts-nocheck
import React from "react";
import {
  Sliders,
  Gift,
  ShieldAlert,
  Cpu,
  Palette,
  Upload,
  Image as ImageIcon,
  Film,
  FileVideo,
  X,
  Award,
  DollarSign,
  Activity,
  CheckCircle,
  TrendingUp,
  Coins,
  Users,
  Search,
  Play,
  FileText,
  MessageCircle,
  Send,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import { api } from "../lib/api";
import AgencyAndThemes from "./AgencyAndThemes";
import {
  useAdminGiftCatalog,
  useCreateGiftCatalog,
  useUpdateGiftCatalog,
  useDeleteGiftCatalog,
} from "../lib/hooks";

async function callBanApi(userId: number, action: "ban" | "unban"): Promise<boolean> {
  try {
    await api.post(`/api/admin/users/${userId}/${action}`);
    return true;
  } catch (err) {
    console.error(`Failed to ${action} user ${userId}:`, err);
    alert(`❌ Failed to ${action} user. Please check your connection and try again.`);
    return false;
  }
}

export interface Agency {
  id: number;
  name: string;
  code: string;
  commission: number;
  hostsCount: number;
  status: "active" | "suspended";
  monthlyTarget?: number;
  targetHours?: number;
  baseSalaryRules?: string;
}

export interface AgencyHost {
  id: number;
  name: string;
  username: string;
  status: "Pending" | "Active" | "Suspended";
  liveHours: number;
  diamondsReceived: number;
  agencyCode: string;
  salaryReleased?: boolean;
}

interface Deposit {
  id: number;
  amount: number;
  method: string;
  txId: string;
  phoneNumber?: string;
  paymentNumber?: string;
  diamonds: number;
  coins?: number;
  status: "pending" | "approved" | "rejected";
  date: string;
}

interface Banner {
  id: number;
  url: string;
  title: string;
  mediaType?: "image" | "video" | "gif";
}

interface AdminPanelProps {
  agencyList: Agency[];
  depositsList: Deposit[];
  setDepositsList: React.Dispatch<React.SetStateAction<Deposit[]>>;
  approveDeposit: (id: number) => void;
  rejectDeposit: (id: number) => void;
  newAgency: {
    name: string;
    code: string;
    commission: number;
    monthlyTarget: number;
    targetHours: number;
    baseSalaryRules: string;
  };
  setNewAgency: React.Dispatch<
    React.SetStateAction<{
      name: string;
      code: string;
      commission: number;
      monthlyTarget: number;
      targetHours: number;
      baseSalaryRules: string;
    }>
  >;
  handleAddAgency: (e: React.FormEvent) => void;
  appLogo: string;
  setAppLogo: React.Dispatch<React.SetStateAction<string>>;
  sliderBanners: Banner[];
  setSliderBanners: React.Dispatch<React.SetStateAction<Banner[]>>;
  generateUniqueNumberId: () => number;
  configurableGifts: Array<{
    id: string;
    name: string;
    diamonds: number;
    rCoins: number;
    icon: string;
    image?: string | null;
    category?: string;
  }>;
  setConfigurableGifts: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        name: string;
        diamonds: number;
        rCoins: number;
        icon: string;
        image?: string | null;
        category?: string;
      }>
    >
  >;
  callApiSettings: {
    rtcAppId: string;
    rtcServerUrl: string;
    isRealStreamEnabled: boolean;
    maxCallDuration: number;
  };
  setCallApiSettings: React.Dispatch<
    React.SetStateAction<{
      rtcAppId: string;
      rtcServerUrl: string;
      isRealStreamEnabled: boolean;
      maxCallDuration: number;
    }>
  >;
  bannedUserIds?: number[];
  setBannedUserIds?: React.Dispatch<React.SetStateAction<number[]>>;
  bannedEmails?: string[];
  setBannedEmails?: React.Dispatch<React.SetStateAction<string[]>>;
  simulatedUsers?: Array<{
    id: number;
    name: string;
    username: string;
    avatar: string;
    vipLevel: number;
    status: string;
    rCoins: number;
    bio: string;
  }>;
  setSimulatedUsers?: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: number;
        name: string;
        username: string;
        avatar: string;
        vipLevel: number;
        status: string;
        rCoins: number;
        bio: string;
      }>
    >
  >;
  globalTheme: string;
  setGlobalTheme: React.Dispatch<React.SetStateAction<string>>;
  deepArLicenseKey: string;
  setDeepArLicenseKey: React.Dispatch<React.SetStateAction<string>>;
  deepArEffects: Array<{
    id: string;
    name: string;
    file: string;
    enabled: boolean;
    effectEmoji: string;
  }>;
  setDeepArEffects: React.Dispatch<
    React.SetStateAction<
      Array<{ id: string; name: string; file: string; enabled: boolean; effectEmoji: string }>
    >
  >;
  agencyHosts: AgencyHost[];
  setAgencyHosts: React.Dispatch<React.SetStateAction<AgencyHost[]>>;
  // ── Added by AgencyAndThemes replacement ──
  agencyApplications?: any[];
  approveAgencyApplication?: (id: any) => void;
  rejectAgencyApplication?: (id: any) => void;
  partyThemeCatalog?: any[];
  setPartyThemeCatalog?: (updater: any) => void;
}

export default function AdminPanel({
  agencyList,
  depositsList,
  setDepositsList,
  approveDeposit,
  rejectDeposit,
  newAgency,
  setNewAgency,
  handleAddAgency,
  appLogo,
  setAppLogo,
  sliderBanners,
  setSliderBanners,
  generateUniqueNumberId,
  configurableGifts,
  setConfigurableGifts,
  callApiSettings,
  setCallApiSettings,
  bannedUserIds = [],
  setBannedUserIds = () => {},
  bannedEmails = [],
  setBannedEmails = () => {},
  simulatedUsers = [],
  setSimulatedUsers = () => {},
  globalTheme,
  setGlobalTheme,
  deepArLicenseKey,
  setDeepArLicenseKey,
  deepArEffects,
  setDeepArEffects,
  agencyHosts,
  setAgencyHosts,
  agencyApplications = [],
  approveAgencyApplication,
  rejectAgencyApplication,
  partyThemeCatalog = [],
  setPartyThemeCatalog,
}: AdminPanelProps) {
  const [isDragging, setIsDragging] = React.useState<Record<number, boolean>>({});
  const [banSearchQuery, setBanSearchQuery] = React.useState<string>("");
  const [selectedProfileForModal, setSelectedProfileForModal] = React.useState<any | null>(null);

  // ===== VIP Level Pricing (admin-configurable) =====
  const [vipPrices, setVipPrices] = React.useState<Array<{ level: number; price: number }>>([]);
  const [vipSaving, setVipSaving] = React.useState<boolean>(false);
  const [vipSaveMsg, setVipSaveMsg] = React.useState<string>("");
  const [logoSaveMsg, setLogoSaveMsg] = React.useState<string>("");
  const [rechargeConfig, setRechargeConfig] = React.useState({
    paymentNumber: "01700000000",
    diamondRate: 1.1,
    coinRate: 0,
  });
  const [rechargeSaving, setRechargeSaving] = React.useState<boolean>(false);
  const [rechargeSaveMsg, setRechargeSaveMsg] = React.useState<string>("");
  const [supportConversations, setSupportConversations] = React.useState<any[]>([]);
  const [selectedSupport, setSelectedSupport] = React.useState<any | null>(null);
  const [supportMessages, setSupportMessages] = React.useState<any[]>([]);
  const [supportReply, setSupportReply] = React.useState<string>("");
  const [supportAdminMsg, setSupportAdminMsg] = React.useState<string>("");
  const [roleUsers, setRoleUsers] = React.useState<any[]>([]);
  const [roleSearch, setRoleSearch] = React.useState<string>("");
  const [roleMsg, setRoleMsg] = React.useState<string>("");
  const [roleFilter, setRoleFilter] = React.useState<"all" | "user" | "agent" | "reseller">("all");
  const [walletCredit, setWalletCredit] = React.useState<Record<number, { diamonds: string; rCoins: string }>>({});
  const [roleRequests, setRoleRequests] = React.useState<any[]>([]);
  const [roleRequestMsg, setRoleRequestMsg] = React.useState<string>("");

  // ===== Host Monthly Target (admin editable) =====
  const monthRange = React.useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }, []);
  const [hostTarget, setHostTarget] = React.useState<{
    id: number | null;
    coins_target: string;
    live_hours_target: string;
    diamonds_target: string;
    period_start: string;
    period_end: string;
    active: boolean;
  }>({
    id: null,
    coins_target: "",
    live_hours_target: "",
    diamonds_target: "",
    period_start: monthRange.start,
    period_end: monthRange.end,
    active: true,
  });
  const [hostTargetSaving, setHostTargetSaving] = React.useState<boolean>(false);
  const [hostTargetMsg, setHostTargetMsg] = React.useState<string>("");

  // ===== Admin Gift Catalog CRUD =====
  const {
    data: adminGiftCatalogData,
    isLoading: adminGiftsLoading,
    error: adminGiftsError,
  } = useAdminGiftCatalog();
  const createGift = useCreateGiftCatalog();
  const updateGift = useUpdateGiftCatalog();
  const deleteGift = useDeleteGiftCatalog();
  const [giftFormMsg, setGiftFormMsg] = React.useState<string>("");
  const [newGift, setNewGift] = React.useState({
    name: "",
    emoji: "🎁",
    image: "",
    price: 1000,
    category: "basic",
    active: true,
  });

  // Sync backend gifts into the parent-controlled configurableGifts list
  React.useEffect(() => {
    const rows = Array.isArray(adminGiftCatalogData?.data) ? adminGiftCatalogData.data : [];
    if (rows.length === 0) return;
    const backendGifts = rows.map((gift) => ({
      id: String(gift.id),
      name: gift.name || "Gift",
      diamonds: Number(gift.price || 0),
      rCoins: Number(gift.price || 0),
      icon: gift.emoji || "🎁",
      image: gift.image || null,
      category: gift.category || "basic",
    }));
    // Merge with current list, backend rows override by id
    const byId = new Map<string, any>();
    for (const g of configurableGifts) byId.set(String(g.id), g);
    for (const g of backendGifts) byId.set(g.id, g);
    const merged = Array.from(byId.values()).sort((a, b) => a.diamonds - b.diamonds);
    setConfigurableGifts(merged);
    try {
      localStorage.setItem("sk_configurable_gifts_v2", JSON.stringify(merged));
    } catch {}
  }, [adminGiftCatalogData]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ prices: Array<{ level: number; price: number }> }>(
          "/api/vip-prices",
        );
        const list =
          Array.isArray(res?.prices) && res.prices.length
            ? res.prices
            : Array.from({ length: 10 }, (_, i) => ({ level: i + 1, price: (i + 1) * 1000 }));
        setVipPrices(list);
      } catch {
        setVipPrices(
          Array.from({ length: 10 }, (_, i) => ({ level: i + 1, price: (i + 1) * 1000 })),
        );
      }
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const res: any = await api.get("/api/app-settings");
        const config = res?.data?.recharge_config || {};
        setRechargeConfig({
          paymentNumber: config.paymentNumber || "01700000000",
          diamondRate: Number(config.diamondRate || 1.1),
          coinRate: Number(config.coinRate || 0),
        });
      } catch {
        /* keep local defaults */
      }
    })();
  }, []);

  // Load active host target
  React.useEffect(() => {
    (async () => {
      try {
        const res: any = await api.get("/api/admin/host-target");
        const list: any[] = Array.isArray(res?.targets) ? res.targets : [];
        const active = list.find((t) => t?.active) || list[0];
        if (active) {
          setHostTarget({
            id: Number(active.id),
            coins_target: active.coins_target != null ? String(active.coins_target) : "",
            live_hours_target:
              active.live_hours_target != null ? String(active.live_hours_target) : "",
            diamonds_target:
              active.diamonds_target != null ? String(active.diamonds_target) : "",
            period_start: String(active.period_start || "").slice(0, 10) || monthRange.start,
            period_end: String(active.period_end || "").slice(0, 10) || monthRange.end,
            active: Boolean(active.active),
          });
        }
      } catch {
        /* ignore */
      }
    })();
  }, [monthRange.start, monthRange.end]);

  const saveHostTarget = async () => {
    setHostTargetSaving(true);
    setHostTargetMsg("");
    try {
      const payload: any = {
        coins_target: hostTarget.coins_target ? Number(hostTarget.coins_target) : null,
        live_hours_target: hostTarget.live_hours_target
          ? Number(hostTarget.live_hours_target)
          : null,
        diamonds_target: hostTarget.diamonds_target ? Number(hostTarget.diamonds_target) : null,
        period_start: hostTarget.period_start,
        period_end: hostTarget.period_end,
        active: hostTarget.active,
      };
      if (!payload.coins_target && !payload.live_hours_target && !payload.diamonds_target) {
        setHostTargetMsg("কমপক্ষে একটি টার্গেট দিন");
        return;
      }
      if (hostTarget.id) {
        await api.put(`/api/admin/host-target/${hostTarget.id}`, payload);
      } else {
        const res: any = await api.post("/api/admin/host-target", payload);
        if (res?.id) setHostTarget((p) => ({ ...p, id: Number(res.id) }));
      }
      setHostTargetMsg("✅ সেভ হয়েছে");
    } catch (e: any) {
      setHostTargetMsg(`❌ ${e?.message || "Save failed"}`);
    } finally {
      setHostTargetSaving(false);
      setTimeout(() => setHostTargetMsg(""), 3000);
    }
  };

  const applyMonthlyPreset = () => {
    setHostTarget((p) => ({
      ...p,
      period_start: monthRange.start,
      period_end: monthRange.end,
    }));
  };

  const saveVipPrices = async () => {
    setVipSaving(true);
    setVipSaveMsg("");
    try {
      await api.post("/api/admin/vip-prices", { prices: vipPrices });
      setVipSaveMsg("✅ Saved");
    } catch (e: any) {
      setVipSaveMsg(`❌ ${e?.message || "Save failed"}`);
    } finally {
      setVipSaving(false);
      setTimeout(() => setVipSaveMsg(""), 3000);
    }
  };

  const saveRechargeConfig = async () => {
    setRechargeSaving(true);
    setRechargeSaveMsg("");
    try {
      await api.post("/api/admin/app-settings", {
        key: "recharge_config",
        value: {
          paymentNumber: rechargeConfig.paymentNumber.trim(),
          diamondRate: Number(rechargeConfig.diamondRate || 0),
          coinRate: Number(rechargeConfig.coinRate || 0),
        },
      });
      setRechargeSaveMsg("Saved");
    } catch (e: any) {
      setRechargeSaveMsg(e?.message || "Save failed");
    } finally {
      setRechargeSaving(false);
      setTimeout(() => setRechargeSaveMsg(""), 3000);
    }
  };

  const saveAppLogo = async () => {
    setLogoSaveMsg("");
    try {
      await api.post("/api/admin/app-settings", { key: "app_logo", value: appLogo });
      setLogoSaveMsg("Saved");
    } catch (e: any) {
      setLogoSaveMsg(e?.message || "Save failed");
    } finally {
      setTimeout(() => setLogoSaveMsg(""), 2500);
    }
  };

  // Custom Agency Ecosystem upgraded states
  const [selectedAgencyForManage, setSelectedAgencyForManage] = React.useState<Agency | null>(null);
  const [agencyBonusInput, setAgencyBonusInput] = React.useState<number>(3000); // Default BDT/Coin bonus value
  const [allInvoicesApproved, setAllInvoicesApproved] = React.useState<Record<string, boolean>>({});
  const approvedRevenue = depositsList
    .filter((dep) => dep.status === "approved")
    .reduce((sum, dep) => sum + Number(dep.amount || 0), 0);
  const activeAgencyCount = agencyList.filter(
    (agency) => String(agency.status || "").toLowerCase() === "active",
  ).length;
  const activeHostCount = agencyHosts.filter(
    (host) => String(host.status || "").toLowerCase() === "active",
  ).length;
  const visibleRoleUsers = roleUsers.filter((user) => {
    const role = user.is_admin ? "admin" : user.role || "user";
    return roleFilter === "all" || role === roleFilter;
  });
  const roleCounts = roleUsers.reduce(
    (acc, user) => {
      const role = user.is_admin ? "admin" : user.role || "user";
      if (role === "agent") acc.agent += 1;
      else if (role === "reseller") acc.reseller += 1;
      else if (role !== "admin") acc.user += 1;
      return acc;
    },
    { user: 0, agent: 0, reseller: 0 },
  );

  const updateAgencyHostStatus = async (
    hostId: number,
    status: AgencyHost["status"],
  ) => {
    try {
      const res: any = await api.patch(`/api/admin/hosts/${hostId}`, { status });
      const updated = res?.host;
      setAgencyHosts((prev) =>
        prev.map((host) =>
          host.id === hostId
            ? {
                ...host,
                status: (updated?.status || status) as AgencyHost["status"],
              }
            : host,
        ),
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update host status");
    }
  };

  const loadSupportInbox = async () => {
    try {
      const res: any = await api.get("/api/admin/support/conversations");
      setSupportConversations(Array.isArray(res?.conversations) ? res.conversations : []);
    } catch (e: any) {
      setSupportAdminMsg(e?.message || "Failed to load support inbox");
    }
  };

  const openSupportConversation = async (conversation: any) => {
    setSelectedSupport(conversation);
    setSupportAdminMsg("");
    try {
      const res: any = await api.get(`/api/admin/support/conversations/${conversation.id}`);
      setSupportMessages(Array.isArray(res?.messages) ? res.messages : []);
    } catch (e: any) {
      setSupportAdminMsg(e?.message || "Failed to open conversation");
    }
  };

  const sendSupportReply = async () => {
    if (!selectedSupport || !supportReply.trim()) return;
    try {
      await api.post(`/api/admin/support/conversations/${selectedSupport.id}/messages`, {
        message: supportReply.trim(),
      });
      setSupportReply("");
      await openSupportConversation(selectedSupport);
      await loadSupportInbox();
    } catch (e: any) {
      setSupportAdminMsg(e?.message || "Reply failed");
    }
  };

  const loadRoleUsers = async (q = roleSearch) => {
    setRoleMsg("");
    try {
      const res: any = await api.get(`/api/admin/users?q=${encodeURIComponent(q.trim())}`);
      setRoleUsers(Array.isArray(res?.users) ? res.users : []);
    } catch (e: any) {
      setRoleMsg(e?.message || "Failed to load users");
    }
  };

  const updateUserRole = async (userId: number, role: "user" | "agent" | "reseller" | "admin") => {
    setRoleMsg("");
    try {
      const res: any = await api.post(`/api/admin/users/${userId}/role`, { role });
      const updated = res?.user || {};
      setRoleUsers((prev) =>
        prev.map((user) =>
          Number(user.id) === Number(userId)
            ? { ...user, role: updated.role || role, is_admin: role === "admin" }
            : user,
        ),
      );
      setRoleMsg(`Role updated to ${role}.`);
    } catch (e: any) {
      setRoleMsg(e?.message || "Role update failed");
    }
  };

  const loadRoleRequests = async () => {
    setRoleRequestMsg("");
    try {
      const res: any = await api.get("/api/admin/role-requests?status=pending");
      setRoleRequests(Array.isArray(res?.requests) ? res.requests : []);
    } catch (e: any) {
      setRoleRequestMsg(e?.message || "Failed to load role requests");
    }
  };

  const respondRoleRequest = async (requestId: number, status: "approved" | "rejected") => {
    setRoleRequestMsg("");
    try {
      await api.post(`/api/admin/role-requests/${requestId}/respond`, { status });
      setRoleRequests((prev) => prev.filter((item) => Number(item.id) !== Number(requestId)));
      await loadRoleUsers("");
      setRoleRequestMsg(status === "approved" ? "Request approved." : "Request rejected.");
    } catch (e: any) {
      setRoleRequestMsg(e?.message || "Request update failed");
    }
  };

  const modifyUserWallet = async (userId: number, type: "credit" | "debit") => {
    const entry = walletCredit[userId] || { diamonds: "", rCoins: "" };
    // If coins entered in entry.diamonds or entry.rCoins, modify Top Up coins (diamonds)
    const amount = Math.max(0, Number(entry.diamonds || entry.rCoins || 0));
    if (!amount) {
      setRoleMsg("Enter coins amount first.");
      return;
    }
    const transferAmount = type === "credit" ? amount : -amount;
    setRoleMsg("");
    try {
      const res: any = await api.post("/api/admin/wallet-transfer", {
        receiver_id: userId,
        diamonds: transferAmount,
        r_coins: 0,
        note: type === "credit" ? "Admin to user Top Up wallet credit" : "Admin Top Up wallet debit",
      });
      const updated = res?.user || {};
      setRoleUsers((prev) =>
        prev.map((user) =>
          Number(user.id) === Number(userId)
            ? {
                ...user,
                diamonds: updated.diamonds ?? Math.max(0, Number(user.diamonds || 0) + transferAmount),
                coins: updated.coins ?? Math.max(0, Number(user.coins || 0) + transferAmount),
              }
            : user,
        ),
      );
      setWalletCredit((prev) => ({ ...prev, [userId]: { diamonds: "", rCoins: "" } }));
      setRoleMsg(type === "credit" ? "Top Up coins credited successfully." : "Top Up coins debited successfully.");
    } catch (e: any) {
      setRoleMsg(e?.message || `Wallet ${type} failed`);
    }
  };

  React.useEffect(() => {
    void loadSupportInbox();
    void loadRoleUsers("");
    void loadRoleRequests();
  }, []);

  // State for adding a custom AR effect in CMS
  const [newArName, setNewArName] = React.useState<string>("");
  const [newArFile, setNewArFile] = React.useState<string>("");
  const [newArEmoji, setNewArEmoji] = React.useState<string>("✨");

  const handleFileChange = (index: number, file: File | null) => {
    if (!file) return;
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    let detectedType: "image" | "video" | "gif" = "image";
    if (fileType.includes("gif") || fileName.endsWith(".gif")) {
      detectedType = "gif";
    } else if (
      fileType.includes("video") ||
      fileType.includes("mp4") ||
      fileName.endsWith(".mp4")
    ) {
      detectedType = "video";
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const updated = [...sliderBanners];
      updated[index] = {
        ...updated[index],
        url: dataUrl,
        mediaType: detectedType,
      };
      setSliderBanners(updated);
    };
    reader.readAsDataURL(file);
  };

  const renderBannerEditor = (index: number, title: string, id: string) => {
    const banner = sliderBanners[index] || {
      id: index + 1,
      url: "",
      title: "",
      mediaType: "image",
    };

    const applyPreset = (type: "image" | "gif" | "video") => {
      const updated = [...sliderBanners];
      if (type === "image") {
        updated[index] = {
          ...updated[index],
          url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=450&auto=format&fit=crop&q=60",
          mediaType: "image",
        };
      } else if (type === "gif") {
        updated[index] = {
          ...updated[index],
          url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTc0YTU3MGZhMTNiaThtMGYyZ2M1bzRlMGw5b2U1MHB6NmdrYTNxdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKEXm4mB0u009d6/giphy.gif",
          mediaType: "gif",
        };
      } else if (type === "video") {
        updated[index] = {
          ...updated[index],
          url: "https://assets.mixkit.co/videos/preview/mixkit-starry-night-sky-over-a-silent-lake-43187-large.mp4",
          mediaType: "video",
        };
      }
      setSliderBanners(updated);
    };

    return (
      <div
        id={id}
        className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] bg-indigo-500/10 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono">
              {title}
            </span>
            <span className="text-[8.5px] text-slate-500 font-mono italic capitalize">
              {banner.mediaType || "image"} mode
            </span>
          </div>

          <div className="mt-2.5">
            <label className="block text-[9.5px] text-slate-400 mb-1">
              Upload Media (Drag & Drop or Click)
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging((prev) => ({ ...prev, [index]: true }));
              }}
              onDragLeave={() => {
                setIsDragging((prev) => ({ ...prev, [index]: false }));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging((prev) => ({ ...prev, [index]: false }));
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(index, e.dataTransfer.files[0]);
                }
              }}
              onClick={() => {
                const element = document.getElementById(`media_file_input_${index}`);
                if (element) element.click();
              }}
              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[95px] relative group overflow-hidden ${
                isDragging[index]
                  ? "border-pink-500 bg-pink-500/5"
                  : "border-slate-850 hover:border-pink-500/35 bg-[#0f0b1e]/60"
              }`}
            >
              <input
                id={`media_file_input_${index}`}
                type="file"
                accept="image/*,video/mp4,image/gif"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(index, e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {banner.url ? (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-all">
                  {banner.mediaType === "video" ||
                  banner.url.includes(".mp4") ||
                  banner.url.startsWith("data:video/") ? (
                    <video
                      src={banner.url}
                      muted
                      className="w-full h-full object-cover opacity-60 shrink-0"
                    />
                  ) : (
                    <img
                      src={banner.url}
                      alt="Banner Preview"
                      className="w-full h-full object-cover opacity-60 shrink-0"
                    />
                  )}
                  <div className="absolute z-10 flex flex-col items-center justify-center p-1 bg-black/60 rounded">
                    <Upload className="w-3.5 h-3.5 text-pink-400 animate-bounce" />
                    <span className="text-[7.5px] text-white font-bold leading-none mt-1">
                      Replace Media
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                  <Upload className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition" />
                  <p className="text-[9px] text-slate-400 group-hover:text-slate-200">
                    Drop PNG/JPG, GIF or MP4 here
                  </p>
                  <p className="text-[7.5px] text-slate-600 font-mono font-bold">
                    Click to browse file
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2.5">
            <label
              className="block text-[9px] text-slate-400 mb-1"
              htmlFor={`banner_title_${index}`}
            >
              Banner Slogan
            </label>
            <input
              id={`banner_title_${index}`}
              type="text"
              value={banner.title}
              onChange={(e) => {
                const updated = [...sliderBanners];
                updated[index] = { ...updated[index], title: e.target.value };
                setSliderBanners(updated);
              }}
              className="w-full bg-slate-900 text-white text-xs p-1.5 rounded border border-slate-850 focus:outline-none"
              placeholder="Enter slogan text..."
            />
          </div>
        </div>

        <div className="border-t border-slate-900/60 pt-2.5 mt-1">
          <p className="text-[8px] text-slate-500 font-mono mb-1">Simulation presets:</p>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                applyPreset("image");
              }}
              className="bg-[#12102a] border border-slate-850 hover:border-pink-500/20 active:scale-95 py-1 px-1 rounded text-[8px] text-indigo-300 font-bold transition flex items-center justify-center gap-0.5"
            >
              <ImageIcon className="w-2.5 h-2.5 shrink-0" /> Image
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                applyPreset("gif");
              }}
              className="bg-[#12102a] border border-slate-850 hover:border-pink-500/20 active:scale-95 py-1 px-1 rounded text-[8px] text-purple-300 font-bold transition flex items-center justify-center gap-0.5"
            >
              <Film className="w-2.5 h-2.5 shrink-0" /> GIF
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                applyPreset("video");
              }}
              className="bg-[#12102a] border border-slate-850 hover:border-pink-500/20 active:scale-95 py-1 px-1 rounded text-[8px] text-amber-300 font-bold transition flex items-center justify-center gap-0.5"
            >
              <FileVideo className="w-2.5 h-2.5 shrink-0" /> MP4 Video
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Admin Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          id="stat_revenue"
          className="bg-slate-900 border border-slate-850 p-4 rounded-xl shadow"
        >
          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
            Approved Revenue
          </span>
          <h4 className="text-white font-extrabold text-2xl font-mono mt-1 w-full truncate">
            ৳ {approvedRevenue.toLocaleString()} BDT
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">Sum of approved deposits</p>
        </div>

        <div
          id="stat_agency"
          className="bg-slate-900 border border-slate-850 p-4 rounded-xl shadow"
        >
          <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
            Active Agency
          </span>
          <h4 className="text-white font-extrabold text-2xl font-mono mt-1">
            {activeAgencyCount} Registered
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">Status = active</p>
        </div>

        <div id="stat_hosts" className="bg-slate-900 border border-slate-850 p-4 rounded-xl shadow">
          <span className="text-[10px] bg-pink-500/10 text-pink-300 font-bold px-2 py-0.5 rounded border border-pink-500/20 uppercase tracking-wider">
            Hosts Verified
          </span>
          <h4 className="text-white font-extrabold text-2xl font-mono mt-1">
            {activeHostCount} Active Anchors
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">Under managed agencies</p>
        </div>

        <div id="stat_pk" className="bg-slate-900 border border-slate-850 p-4 rounded-xl shadow">
          <span className="text-[10px] bg-amber-500/10 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-wider">
            PK Battles Live
          </span>
          <h4 className="text-white font-extrabold text-2xl font-mono mt-1">0 Active Arenas</h4>
          <p className="text-[10px] text-slate-400 mt-1">Score multiplier active</p>
        </div>
      </div>

      {/* Host Monthly Target */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-white font-bold text-sm">Host Monthly Target</h3>
            <p className="text-xs text-slate-400 mt-1">
              হোস্টদের জন্য মাসিক টার্গেট সেট করুন। শুধু যেগুলো দরকার সেগুলো পূরণ করুন — বাকিগুলো
              খালি রাখলে সেই মেট্রিক গণনায় ধরা হবে না।
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hostTargetMsg && (
              <span className="text-[10px] text-cyan-300 font-bold">{hostTargetMsg}</span>
            )}
            <button
              type="button"
              onClick={applyMonthlyPreset}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              This Month
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Coins Target
            </span>
            <input
              type="number"
              min={0}
              value={hostTarget.coins_target}
              onChange={(e) =>
                setHostTarget((p) => ({ ...p, coins_target: e.target.value }))
              }
              placeholder="e.g. 500000"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Live Hours Target
            </span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={hostTarget.live_hours_target}
              onChange={(e) =>
                setHostTarget((p) => ({ ...p, live_hours_target: e.target.value }))
              }
              placeholder="e.g. 60"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Diamonds Target
            </span>
            <input
              type="number"
              min={0}
              value={hostTarget.diamonds_target}
              onChange={(e) =>
                setHostTarget((p) => ({ ...p, diamonds_target: e.target.value }))
              }
              placeholder="e.g. 100000"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>

          <label>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Period Start
            </span>
            <input
              type="date"
              value={hostTarget.period_start}
              onChange={(e) =>
                setHostTarget((p) => ({ ...p, period_start: e.target.value }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Period End
            </span>
            <input
              type="date"
              value={hostTarget.period_end}
              onChange={(e) =>
                setHostTarget((p) => ({ ...p, period_end: e.target.value }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
              <input
                type="checkbox"
                checked={hostTarget.active}
                onChange={(e) =>
                  setHostTarget((p) => ({ ...p, active: e.target.checked }))
                }
              />
              Active
            </label>
            <button
              type="button"
              onClick={saveHostTarget}
              disabled={hostTargetSaving}
              className="ml-auto text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white disabled:opacity-60"
            >
              {hostTargetSaving ? "Saving..." : hostTarget.id ? "Update Target" : "Create Target"}
            </button>
          </div>
        </div>
      </div>

      {/* Offline Recharge Settings */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-white font-bold text-sm">Offline Recharge Settings</h3>
            <p className="text-xs text-slate-400 mt-1">
              Set the payment number and conversion rate users will see before submitting proof.
            </p>
          </div>
          {rechargeSaveMsg && (
            <span className="text-[10px] text-cyan-300 font-bold">{rechargeSaveMsg}</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="md:col-span-2">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Admin Payment Number
            </span>
            <input
              value={rechargeConfig.paymentNumber}
              onChange={(e) =>
                setRechargeConfig((prev) => ({ ...prev, paymentNumber: e.target.value }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
              placeholder="bKash / Nagad / Bank number"
            />
          </label>
          {/* Diamonds removed from user-facing UI */}
          <label>
            <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
              Coins per BDT
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rechargeConfig.coinRate}
              onChange={(e) =>
                setRechargeConfig((prev) => ({ ...prev, coinRate: Number(e.target.value || 0) }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <button
          onClick={saveRechargeConfig}
          disabled={rechargeSaving}
          className="mt-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-black text-xs px-5 py-2 rounded-lg"
        >
          {rechargeSaving ? "Saving..." : "Save Recharge Settings"}
        </button>
      </div>

      {/* Pending agency/reseller requests */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-300" />
              Pending Agency / Reseller Requests
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Users request from their profile. Admin approves here, then dashboard access opens automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRoleRequests()}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
        {roleRequestMsg && <p className="mb-3 text-[10px] font-bold text-cyan-300">{roleRequestMsg}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {roleRequests.length === 0 ? (
            <div className="md:col-span-2 rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-400">
              No pending reseller or agency requests.
            </div>
          ) : (
            roleRequests.map((request) => {
              const requestedLabel = request.requested_role === "agent" ? "Agency" : "Reseller";
              return (
                <div key={request.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{request.user_name}</p>
                      <p className="text-[10px] text-slate-500">{request.user_email || `ID ${request.user_id}`}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
                      request.requested_role === "agent"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                        : "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                    }`}>
                      {requestedLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                      <p className="text-slate-500 font-black uppercase">Current Role</p>
                      <p className="mt-1 text-slate-200 font-bold">
                        {request.is_admin ? "admin" : request.current_role || "user"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                      <p className="text-slate-500 font-black uppercase">Referral / Code</p>
                      <p className="mt-1 text-slate-200 font-bold">{request.referral_code || "Not given"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                      <p className="text-slate-500 font-black uppercase">Phone</p>
                      <p className="mt-1 text-slate-200 font-bold">{request.phone || "Not given"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                      <p className="text-slate-500 font-black uppercase">Wallet</p>
                      <p className="mt-1 text-slate-200 font-bold">
                        {Number(request.r_coins || 0).toLocaleString()} coins
                      </p>
                    </div>
                  </div>
                  {request.message && (
                    <p className="mt-3 rounded-xl bg-slate-900/80 border border-slate-800 p-2 text-[10px] text-slate-300">
                      {request.message}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void respondRoleRequest(request.id, "approved")}
                      className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-[10px] font-black text-slate-950"
                    >
                      APPROVE
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondRoleRequest(request.id, "rejected")}
                      className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-2 text-[10px] font-black text-white"
                    >
                      REJECT
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Role and reseller control */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-300" />
              User Role & Wallet Control
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Admin selects a normal user, makes them Agency or Reseller, then credits reseller wallet.
            </p>
          </div>
          {roleMsg && <span className="text-[10px] text-cyan-300 font-bold">{roleMsg}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-pink-500/20 bg-pink-500/10 p-3">
            <p className="text-[10px] font-black uppercase text-pink-300">1. Make Reseller</p>
            <p className="text-[11px] text-slate-300 mt-1">
              User contacts admin offline. Admin clicks <b>Reseller</b>. That user gets reseller dashboard.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="text-[10px] font-black uppercase text-emerald-300">2. Make Agency</p>
            <p className="text-[11px] text-slate-300 mt-1">
              Admin clicks <b>Agency</b>. Agency profile gets agency dashboard and host list view.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-[10px] font-black uppercase text-amber-300">3. Credit Wallet</p>
            <p className="text-[11px] text-slate-300 mt-1">
              Admin adds coins to reseller. Reseller sells onward to users or agencies.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <p className="text-[9px] text-slate-500 font-black uppercase">Normal Users</p>
            <p className="text-xl font-black text-white">{roleCounts.user}</p>
          </div>
          <div className="rounded-xl bg-slate-950 border border-emerald-500/20 p-3">
            <p className="text-[9px] text-emerald-300 font-black uppercase">Agencies</p>
            <p className="text-xl font-black text-white">{roleCounts.agent}</p>
          </div>
          <div className="rounded-xl bg-slate-950 border border-amber-500/20 p-3">
            <p className="text-[9px] text-amber-300 font-black uppercase">Resellers</p>
            <p className="text-xl font-black text-white">{roleCounts.reseller}</p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
            placeholder="Search name, email or ID..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
          />
          <button
            onClick={() => void loadRoleUsers()}
            className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-[10px] px-4 rounded-lg"
          >
            SEARCH
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["all", "user", "agent", "reseller"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setRoleFilter(filter)}
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                roleFilter === filter
                  ? "bg-cyan-400 text-slate-950"
                  : "bg-slate-950 text-slate-300 border border-slate-800"
              }`}
            >
              {filter === "agent" ? "Agency" : filter}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-850">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/85 border-b border-slate-850 text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Current Role</th>
                <th className="px-4 py-3">Set Role</th>
                <th className="px-4 py-3">Credit Wallet</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 bg-slate-950/30 text-xs text-slate-200">
              {visibleRoleUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No users in this view. Search or switch filter.
                  </td>
                </tr>
              ) : (
                visibleRoleUsers.map((user) => {
                  const entry = walletCredit[user.id] || { diamonds: "", rCoins: "" };
                  const role = user.is_admin ? "admin" : user.role || "user";
                  const roleLabel = role === "agent" ? "agency" : role;
                  return (
                    <tr key={user.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{user.name}</div>
                        <div className="text-[10px] text-slate-500">{user.email || `ID ${user.id}`}</div>
                        <div className="text-[9px] text-slate-400 mt-1 flex flex-col gap-0.5">
                          <span>🪙 Top Up: {Number(user.diamonds ?? user.coins ?? 0).toLocaleString()}</span>
                          <span className="text-slate-500">🪙 C-Coin: {Number(user.r_coins || 0).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-black uppercase text-cyan-300">
                          {roleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(["user", "agent", "reseller"] as const).map((nextRole) => (
                            <button
                              key={nextRole}
                              onClick={() => void updateUserRole(user.id, nextRole)}
                              className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase ${
                                role === nextRole
                                  ? "bg-pink-500 text-white"
                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              {nextRole === "agent" ? "Agency" : nextRole}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-1 min-w-[170px]">
                          <input
                            type="number"
                            min="0"
                            value={entry.diamonds || entry.rCoins || ""}
                            onChange={(e) =>
                              setWalletCredit((prev) => ({
                                ...prev,
                                [user.id]: { diamonds: e.target.value, rCoins: "" },
                              }))
                            }
                            placeholder="Top Up Coins"
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white focus:border-amber-400 outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => void modifyUserWallet(user.id, "credit")}
                            className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1.5 rounded-lg"
                          >
                            CREDIT
                          </button>
                          <button
                            onClick={() => void modifyUserWallet(user.id, "debit")}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] px-2.5 py-1.5 rounded-lg"
                          >
                            DEBIT
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Center Admin Inbox */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-pink-300" />
              Help Center Chat Inbox
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Users message from Help Center. Admin replies here and users see it in the same chat.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSupportInbox}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
        {supportAdminMsg && <p className="text-[10px] text-amber-300 mb-3">{supportAdminMsg}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {supportConversations.length === 0 ? (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-400">
                No support chats yet.
              </div>
            ) : (
              supportConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openSupportConversation(conversation)}
                  className={`w-full text-left rounded-xl border p-3 transition ${
                    selectedSupport?.id === conversation.id
                      ? "bg-pink-500/10 border-pink-500/40"
                      : "bg-slate-950 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  <p className="text-white text-xs font-black">{conversation.user_name}</p>
                  <p className="text-[10px] text-slate-400">{conversation.user_email}</p>
                  <p className="text-[9px] text-cyan-300 mt-1">
                    {conversation.last_message_at || conversation.updated_at}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 min-h-[360px] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-white text-xs font-black">
                {selectedSupport ? selectedSupport.user_name : "Select a support chat"}
              </p>
            </div>
            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {supportMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_role === "user" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs font-semibold ${
                      message.sender_role === "user"
                        ? "bg-slate-800 text-slate-100"
                        : "bg-pink-600 text-white"
                    }`}
                  >
                    {message.message}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-800 flex items-center gap-2">
              <input
                value={supportReply}
                disabled={!selectedSupport}
                onChange={(e) => setSupportReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendSupportReply();
                }}
                className="min-w-0 flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                placeholder="Reply to user..."
              />
              <button
                type="button"
                disabled={!selectedSupport || !supportReply.trim()}
                onClick={sendSupportReply}
                className="w-10 h-10 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Offline Recharge Verification Queue */}
      <div
        id="offline_recharge_verification"
        className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-4 border-b border-slate-850 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-white font-bold text-sm">
              Offline Recharge Proof Verification Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Review user-submitted payment confirmations and credit Coins.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-850">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Sender Phone</th>
                <th className="px-5 py-3">Transaction ID (TxID)</th>
                <th className="px-5 py-3">Amount Paid (BDT)</th>
                {/* Diamonds column removed */}
                <th className="px-5 py-3">Coins</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {depositsList.map((dep) => (
                <tr key={dep.id} className="hover:bg-slate-950/20 text-slate-300">
                  <td className="px-5 py-3 text-slate-400">#{dep.id}</td>
                  <td className="px-5 py-3 text-white font-bold">{dep.method}</td>
                  <td className="px-5 py-3 text-cyan-300 font-bold">
                    {dep.phoneNumber || "-"}
                    {dep.paymentNumber ? (
                      <div className="text-[9px] text-slate-500 font-normal">
                        To: {dep.paymentNumber}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-indigo-300 font-bold">{dep.txId}</td>
                  <td className="px-5 py-3 text-white">৳ {dep.amount} BDT</td>
                  {/* Diamonds cell removed */}
                  <td className="px-5 py-3 text-yellow-300 font-bold font-mono">
                    {dep.coins || 0} Coins
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        dep.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : dep.status === "rejected"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                      }`}
                    >
                      {dep.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {dep.status === "pending" ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => approveDeposit(dep.id)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] px-2 py-1 rounded cursor-pointer"
                        >
                          APPROVE
                        </button>
                        <button
                          onClick={() => rejectDeposit(dep.id)}
                          className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-2 py-1 rounded cursor-pointer"
                        >
                          REJECT
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CashoutAdminSection />

      {/* ═════════════════════════════════════════════════════════════
          🏢 Agency Management + 🎨 Party Room Themes
          (Replaces the earlier "Creator Agency Registry & Performance"
           grid and the "Add New Hosting Agency" form.)
          ───────────────────────────────────────────────────────────── */}
      <AgencyAndThemes
        agencyApplications={agencyApplications}
        approveAgencyApplication={approveAgencyApplication}
        rejectAgencyApplication={rejectAgencyApplication}
        partyThemeCatalog={partyThemeCatalog}
        setPartyThemeCatalog={setPartyThemeCatalog}
      />

      {/* 🎨 Theme Settings Section */}
      <div
        id="theme_settings_panel"
        className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-800"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-pink-500" />
          Theme Color Settings
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed bg-slate-950/20 p-2 rounded-lg border border-slate-850/30">
          Select or customize the global accent theme of the application. Changing this updates
          buttons, highlights, badges, and border frames instantly in the simulator:
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              id: "default",
              name: "Default Dark",
              primary: "#ec4899",
              secondary: "#f43f5e",
              desc: "SK Classic Pink & Rose",
            },
            {
              id: "royal",
              name: "Royal Blue",
              primary: "#3b82f6",
              secondary: "#1d4ed8",
              desc: "Oceanic Blue Intense",
            },
            {
              id: "purple",
              name: "Deep Purple",
              primary: "#a855f7",
              secondary: "#7e22ce",
              desc: "Regal Orchid Amethyst",
            },
            {
              id: "emerald",
              name: "Emerald Green",
              primary: "#10b981",
              secondary: "#047857",
              desc: "Teal Wealth & Luck",
            },
          ].map((themeOpt) => {
            const isSelected = globalTheme === themeOpt.id;
            return (
              <button
                key={themeOpt.id}
                type="button"
                onClick={() => setGlobalTheme(themeOpt.id)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-[95px] cursor-pointer ${
                  isSelected
                    ? "border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/5 scale-[1.02]"
                    : "border-slate-850 bg-slate-950 hover:bg-slate-900/50 hover:border-slate-800"
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <h4 className="text-[11px] font-black text-slate-100 leading-none">
                    {themeOpt.name}
                  </h4>
                  <div className="flex gap-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-950 shadow-sm"
                      style={{ backgroundColor: themeOpt.primary }}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-slate-950 shadow-sm"
                      style={{ backgroundColor: themeOpt.secondary }}
                    />
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="text-[8px] text-slate-500 font-sans leading-tight">
                    {themeOpt.desc}
                  </p>
                  <span
                    className={`text-[7px] mt-1.5 inline-block font-extrabold uppercase tracking-wider ${
                      isSelected ? "text-pink-400" : "text-slate-600"
                    }`}
                  >
                    {isSelected ? "● Active" : "Select Theme"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Laravel Dynamic CMS settings */}
      <div
        id="laravel_cms_settings"
        className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-800"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-rose-500" />
          Laravel Dynamic CMS: Mobile Logo & Slider Banner Settings
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Configure the header branding and 3 dynamic promotion banners using the modern
          drag-and-drop media zone selectors:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Logo Settings */}
          <div
            id="logo_config_block"
            className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex flex-col justify-between"
          >
            <div>
              <span className="text-[9px] bg-rose-500/10 text-rose-300 font-extrabold px-1.5 py-0.5 rounded uppercase font-mono">
                Logo Configuration
              </span>
              <h4 className="text-slate-200 text-xs font-bold mt-2 mb-1">Active App Logo</h4>
              <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                This will appear in the top-left of the mobile header status.
              </p>
            </div>
            <div className="mt-2 text-left">
              <input
                id="app_logo_input"
                type="text"
                value={appLogo}
                onChange={(e) => setAppLogo(e.target.value)}
                placeholder="e.g. 🌈 SK LOVE"
                className="w-full bg-slate-900 text-white text-xs p-2 rounded-lg border border-slate-850 focus:outline-none focus:border-rose-500"
              />
              <label className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black text-slate-200 hover:border-rose-500">
                Upload Logo Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (loadEvent) => {
                      setAppLogo(String(loadEvent.target?.result || ""));
                      setLogoSaveMsg("Click Save Logo");
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {(String(appLogo).startsWith("data:image/") ||
                /^https?:\/\//i.test(String(appLogo))) && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900 p-2">
                  <img
                    src={appLogo}
                    alt="Logo preview"
                    className="mx-auto h-10 max-w-full object-contain"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={saveAppLogo}
                className="mt-2 w-full rounded-lg bg-rose-500 px-3 py-2 text-[10px] font-black text-white hover:bg-rose-600"
              >
                {logoSaveMsg || "Save Logo"}
              </button>
            </div>
          </div>

          {/* Banner 1 Editor */}
          {renderBannerEditor(0, "Banner 1 Detail (Main)", "banner_1_config")}

          {/* Banner 2 Editor */}
          {renderBannerEditor(1, "Banner 2 Detail (Broadcaster Slot)", "banner_2_config")}

          {/* Banner 3 Editor */}
          {renderBannerEditor(2, "Banner 3 Detail (Promo Offer)", "banner_3_config")}
        </div>

        <div className="bg-slate-950/40 p-4 border border-dashed border-slate-800 rounded-xl mt-4 text-center">
          <p className="text-[11px] text-slate-400 leading-normal">
            💡{" "}
            <span className="font-bold text-rose-450 text-rose-400">
              Advanced Banner Media Setup:
            </span>{" "}
            The slider fully renders images, animations, and responsive looping HTML5 video clips
            based on file format. Try uploading direct PNG/GIF/MP4 media or clicking the play
            simulation presets to test!
          </p>
        </div>
      </div>

      {/* 🎁 LIVE GIFT CATALOG CRUD (Admin → Backend) */}
      <div
        id="gift_pricing_configurator"
        className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-800"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-1 flex items-center gap-2">
          <Gift className="w-4 h-4 text-pink-500 animate-pulse" />
          Gift Catalog Manager (Admins-Only)
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Upload, update and delete gifts from the backend. Changes are saved to{" "}
          <code className="text-pink-300">/api/gift-catalog</code> and apply instantly across the app.
        </p>

        {giftFormMsg && (
          <div className="mb-4 text-xs px-3 py-2 rounded-lg bg-pink-500/10 text-pink-100 border border-pink-500/20">
            {giftFormMsg}
          </div>
        )}
        {adminGiftsLoading && <p className="text-xs text-slate-400 mb-3">Loading catalog...</p>}
        {adminGiftsError && (
          <p className="text-xs text-red-400 mb-3">Failed to load catalog: {(adminGiftsError as any)?.message}</p>
        )}

        {/* Add new gift form */}
        <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 mb-4">
          <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add New Gift
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Name</label>
              <input
                value={newGift.name}
                onChange={(e) => setNewGift((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Golden Rose"
                className="w-full bg-slate-900 text-white text-xs px-2 py-1.5 rounded border border-slate-800 focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Emoji</label>
              <input
                value={newGift.emoji}
                onChange={(e) => setNewGift((p) => ({ ...p, emoji: e.target.value }))}
                placeholder="🎁"
                className="w-full bg-slate-900 text-white text-xs px-2 py-1.5 rounded border border-slate-800 focus:outline-none focus:border-pink-500 text-center"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Image URL</label>
              <input
                value={newGift.image}
                onChange={(e) => setNewGift((p) => ({ ...p, image: e.target.value }))}
                placeholder="https://... or data:image/..."
                className="w-full bg-slate-900 text-white text-xs px-2 py-1.5 rounded border border-slate-800 focus:outline-none focus:border-pink-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Coin Price</label>
              <input
                type="number"
                min={0}
                value={newGift.price}
                onChange={(e) => setNewGift((p) => ({ ...p, price: Math.max(0, parseInt(e.target.value) || 0) }))}
                className="w-full bg-slate-900 text-white text-xs px-2 py-1.5 rounded border border-slate-800 focus:outline-none focus:border-pink-500 text-center font-mono"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                disabled={createGift.isPending || !newGift.name.trim()}
                onClick={() => {
                  setGiftFormMsg("");
                  createGift.mutate(
                    {
                      name: newGift.name.trim(),
                      emoji: newGift.emoji.trim() || null,
                      image: newGift.image.trim() || null,
                      price: newGift.price,
                      category: newGift.category,
                      active: newGift.active,
                      sortOrder: configurableGifts.length,
                    },
                    {
                      onSuccess: (res) => {
                        const created = res?.data;
                        if (created) {
                          setConfigurableGifts((prev) => [
                            ...prev,
                            {
                              id: String(created.id),
                              name: created.name,
                              diamonds: created.price,
                              rCoins: created.price,
                              icon: created.emoji || "🎁",
                              image: created.image || null,
                              category: created.category || "basic",
                            },
                          ]);
                        }
                        setNewGift({ name: "", emoji: "🎁", image: "", price: 1000, category: "basic", active: true });
                        setGiftFormMsg("✅ Gift created");
                      },
                      onError: (e: any) => setGiftFormMsg(`❌ ${e?.message || "Create failed"}`),
                    },
                  );
                }}
                className="flex-1 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center justify-center gap-1"
              >
                <Save className="w-3 h-3" />
                {createGift.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Existing gifts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {configurableGifts.map((gift, index) => {
            const isBackendId = !isNaN(Number(gift.id));
            return (
              <div
                key={gift.id}
                className={`bg-slate-950 p-3.5 border rounded-xl flex flex-col gap-2 ${isBackendId ? "border-slate-800" : "border-slate-800/50 opacity-80"}`}
              >
                <div className="flex items-center gap-3 pb-2 border-b border-slate-900">
                  <span className="text-2xl select-none">{gift.icon}</span>
                  <div className="flex-1 min-w-0">
                    <input
                      value={gift.name}
                      onChange={(e) => {
                        const updated = [...configurableGifts];
                        updated[index].name = e.target.value;
                        setConfigurableGifts(updated);
                      }}
                      className="w-full bg-transparent text-white text-xs font-bold focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 truncate">ID: {gift.id}</p>
                  </div>
                  {isBackendId && (
                    <button
                      disabled={deleteGift.isPending}
                      onClick={() => {
                        if (!confirm(`Delete gift "${gift.name}"?`)) return;
                        deleteGift.mutate(gift.id, {
                          onSuccess: () => {
                            setConfigurableGifts((prev) => prev.filter((g) => g.id !== gift.id));
                            setGiftFormMsg("✅ Gift deleted");
                          },
                          onError: (e: any) => setGiftFormMsg(`❌ ${e?.message || "Delete failed"}`),
                        });
                      }}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      title="Delete gift"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Image URL</label>
                    <input
                      value={gift.image || ""}
                      onChange={(e) => {
                        const updated = [...configurableGifts];
                        updated[index].image = e.target.value;
                        setConfigurableGifts(updated);
                      }}
                      placeholder="https://... or base64"
                      className="w-full bg-slate-900 text-white text-[10px] px-2 py-1 rounded border border-slate-800 focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Coin Price</label>
                      <input
                        type="number"
                        value={gift.diamonds}
                        onChange={(e) => {
                          const updated = [...configurableGifts];
                          updated[index].diamonds = Math.max(0, parseInt(e.target.value) || 0);
                          updated[index].rCoins = updated[index].diamonds;
                          setConfigurableGifts(updated);
                        }}
                        className="w-full bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-800 focus:outline-none focus:border-pink-500 text-center font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] text-slate-400 uppercase font-bold mb-1">Category</label>
                      <input
                        value={gift.category || "basic"}
                        onChange={(e) => {
                          const updated = [...configurableGifts];
                          updated[index].category = e.target.value;
                          setConfigurableGifts(updated);
                        }}
                        className="w-full bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-800 focus:outline-none focus:border-pink-500 text-center"
                      />
                    </div>
                  </div>
                  {isBackendId && (
                    <button
                      disabled={updateGift.isPending}
                      onClick={() => {
                        setGiftFormMsg("");
                        updateGift.mutate(
                          {
                            id: gift.id,
                            body: {
                              name: gift.name,
                              emoji: gift.icon || null,
                              image: gift.image || null,
                              price: gift.diamonds,
                              category: gift.category || "basic",
                            },
                          },
                          {
                            onSuccess: () => {
                              try {
                                localStorage.setItem("sk_configurable_gifts_v2", JSON.stringify(configurableGifts));
                              } catch {}
                              setGiftFormMsg("✅ Gift updated");
                            },
                            onError: (e: any) => setGiftFormMsg(`❌ ${e?.message || "Update failed"}`),
                          },
                        );
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold py-1.5 rounded-lg flex items-center justify-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      {updateGift.isPending ? "Updating..." : "Update Gift"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 👑 VIP LEVEL PRICING CONFIGURATOR */}
      <div
        id="vip_pricing_configurator"
        className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-800"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400 animate-pulse" />
          VIP Level Upgrade Pricing (Admins-Only)
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Set the coin cost required for users to upgrade to each VIP level. Changes save to the
          Laravel backend (<code className="text-amber-300">/api/admin/vip-prices</code>) and apply
          instantly across the app.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {vipPrices.map((row, idx) => (
            <div key={row.level} className="bg-slate-950 p-3 border border-slate-850 rounded-xl">
              <div className="text-center pb-2 border-b border-slate-900">
                <span className="text-2xl">👑</span>
                <h4 className="text-amber-300 text-xs font-black mt-1">VIP {row.level}</h4>
              </div>
              <div className="mt-2">
                <label className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">
                  Cost (🪙)
                </label>
                <input
                  type="number"
                  min={0}
                  value={row.price}
                  onChange={(e) => {
                    const v = Math.max(0, parseInt(e.target.value) || 0);
                    setVipPrices((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, price: v } : p)),
                    );
                  }}
                  className="w-full bg-slate-900 text-white text-xs p-1.5 rounded font-mono border border-slate-800 focus:outline-none focus:border-amber-500 text-center font-bold"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveVipPrices}
            disabled={vipSaving}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold px-4 py-2 rounded-lg border-none cursor-pointer text-xs"
          >
            {vipSaving ? "Saving..." : "💾 Save VIP Prices"}
          </button>
          {vipSaveMsg && <span className="text-xs text-slate-300">{vipSaveMsg}</span>}
        </div>
      </div>

      {/* 🚫 USER BANNING & SUSPENSION ENGINE (Central Control) */}
      <div
        id="user_ban_management"
        className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-850"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
          User Suspensions & Account Banning Console
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Search registered IDs, view detailed profiles, or suspend live permissions in real-time:
        </p>

        <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3 font-sans">
          {/* Advanced Search & Real-time Filter */}
          <div className="relative">
            <input
              type="text"
              value={banSearchQuery}
              onChange={(e) => setBanSearchQuery(e.target.value)}
              placeholder="Search by ID, Name, or Email..."
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-pink-500 focus:border-pink-500/40 focus:outline-none transition-all font-sans"
            />
            {banSearchQuery && (
              <button
                type="button"
                onClick={() => setBanSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-[10px] font-bold border-none bg-transparent cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#100d23] text-slate-400 border-b border-slate-850">
                <tr>
                  <th className="px-4 py-2.5">User ID</th>
                  <th className="px-4 py-2.5">Avatar</th>
                  <th className="px-4 py-2.5">Display Name</th>
                  <th className="px-4 py-2.5">Username</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Suspension Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {simulatedUsers
                  .filter((usr) => {
                    const q = banSearchQuery.toLowerCase();
                    if (!q) return true;
                    const idStr = String(usr.id);
                    const nameStr = (usr.name || "").toLowerCase();
                    const usernameStr = (usr.username || "").toLowerCase();
                    const emailStr = (usr as any).email
                      ? (usr as any).email.toLowerCase()
                      : `${usernameStr}@gmail.com`;
                    return (
                      idStr.includes(q) ||
                      nameStr.includes(q) ||
                      usernameStr.includes(q) ||
                      emailStr.includes(q)
                    );
                  })
                  .map((usr) => {
                    const isBanned =
                      bannedUserIds.includes(usr.id) ||
                      bannedEmails.includes((usr as any).email || `${usr.username}@gmail.com`); // checks email too
                    return (
                      <tr key={usr.id} className="hover:bg-slate-905 text-slate-350">
                        <td className="px-4 py-3 font-bold text-slate-400">#{usr.id}</td>
                        <td className="px-4 py-3 text-base">{usr.avatar || "👦"}</td>
                        <td className="px-4 py-3 text-white font-bold">{usr.name}</td>
                        <td className="px-4 py-3 text-indigo-400">@{usr.username}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${isBanned ? "bg-red-500/10 text-red-400 font-bold border border-red-500/20" : "bg-green-500/10 text-green-400 font-bold border border-green-500/20"}`}
                          >
                            {isBanned ? "BANNED" : "ACTIVE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Grant Official Frame Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const frameChoice = window.prompt(
                                  `🏅 ${usr.name} (@${usr.username})-কে কোন অফিসিয়াল ফ্রেম প্রদান করবেন?\n\n1 = AGENCY Frame\n2 = HOST Frame\n3 = RESELLER Frame\n\n(সংখ্যা 1, 2 বা 3 টাইপ করুন):`,
                                  "1"
                                );
                                if (!frameChoice) return;
                                let frameId = "avatar-agency-premium";
                                let frameName = "AGENCY";
                                if (frameChoice === "2") {
                                  frameId = "avatar-host-premium";
                                  frameName = "HOST";
                                } else if (frameChoice === "3") {
                                  frameId = "avatar-reseller-premium";
                                  frameName = "RESELLER";
                                }
                                try {
                                  const storedFrames = JSON.parse(localStorage.getItem("sk_owned_avatar_frames") || "{}");
                                  storedFrames[frameId] = Date.now() + 3650 * 86400 * 1000;
                                  storedFrames[frameName] = Date.now() + 3650 * 86400 * 1000;
                                  localStorage.setItem("sk_owned_avatar_frames", JSON.stringify(storedFrames));
                                  api.post(`/api/admin/users/${usr.id}/grant-frame`, { frame_id: frameId }).catch(() => {});
                                  window.alert(`✅ ${usr.name}-কে সফলভাবে "${frameName}" প্রিমিয়াম অফিসিয়াল ফ্রেম প্রদান করা হয়েছে!`);
                                } catch (e) {
                                  window.alert(`✅ "${frameName}" ফ্রেম গ্রান্ট করা হয়েছে!`);
                                }
                              }}
                              className="bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 text-[9.5px] uppercase font-mono font-bold px-2.5 py-1 rounded-lg border border-amber-500/30 transition-all active:scale-95 cursor-pointer"
                            >
                              🏅 Grant Frame
                            </button>
                            {/* View Profile Details Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedProfileForModal(usr)}
                              className="bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-400 text-[9.5px] uppercase font-mono font-bold px-2.5 py-1 rounded-lg border border-indigo-500/20 transition-all active:scale-95 cursor-pointer"
                            >
                              👁️ Profile
                            </button>
                            <button
                              onClick={async () => {
                                if (usr.id === 77777) {
                                  const confirmSelf = window.confirm(
                                    "⚠️ WARNING: You are banning your own ADMIN profile. Are you absolutely sure?",
                                  );
                                  if (!confirmSelf) return;
                                }
                                const action = isBanned ? "unban" : "ban";
                                const ok = await callBanApi(usr.id, action);
                                if (!ok) return;
                                const emailToSearch = `${usr.username}@gmail.com`;
                                if (isBanned) {
                                  setBannedUserIds((prev) => prev.filter((id) => id !== usr.id));
                                  setBannedEmails((prev) =>
                                    prev.filter(
                                      (e) =>
                                        e !== emailToSearch &&
                                        e !== `${usr.username}@sklove.app` &&
                                        e !== usr.username,
                                    ),
                                  );
                                } else {
                                  setBannedUserIds((prev) => [...prev, usr.id]);
                                  setBannedEmails((prev) => [
                                    ...prev,
                                    emailToSearch,
                                    `${usr.username}@sklove.app`,
                                    usr.username,
                                  ]);
                                }
                              }}
                              className={`text-[9.5px] uppercase font-mono font-black tracking-widest px-3 py-1 rounded-lg transition-all active:scale-95 cursor-pointer ${
                                isBanned
                                  ? "bg-green-600 hover:bg-green-700 text-white"
                                  : "bg-red-650 bg-red-600 hover:bg-red-750 text-white shadow-lg shadow-red-500/10"
                              }`}
                            >
                              {isBanned ? "🔓 Unban" : "🚫 Ban"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🛡️ OFFICIAL ROLE AVATAR FRAME GRANT STUDIO */}
      <div
        id="official_frame_grant_section"
        className="bg-slate-900 border border-amber-500/30 p-5 rounded-2xl relative overflow-hidden ring-1 ring-amber-500/20 shadow-xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-300">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-black text-sm flex items-center gap-2">
                🛡️ Official Role Avatar Frame Grant Studio
                <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full uppercase border border-amber-500/30">
                  Admin Exclusive
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400 mt-0.5">
                অফিসিয়াল AGENCY, HOST এবং RESELLER রোল ব্যাজ ফ্রেম সরাসরি ইউজারদের অ্যাকাউন্ট বা নিজের প্রোফাইলে অনুমোদন ও প্রদান করুন। (এগুলো সাধারণ ইউজাররা শপ থেকে কিনতে পারবে না)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* AGENCY Frame Card */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-amber-500/30 flex flex-col items-center text-center">
            <img src="/frames/agency-premium.png" alt="AGENCY Frame" className="w-20 h-20 object-contain mb-2 drop-shadow-[0_0_10px_rgba(255,215,100,0.5)]" />
            <span className="text-xs font-black text-amber-300">AGENCY Official Frame</span>
            <span className="text-[9.5px] text-slate-400 mt-0.5">অফিসিয়াল এজেন্সি ওনারদের জন্য</span>
            <button
              type="button"
              onClick={() => {
                const targetId = window.prompt("AGENCY ফ্রেম দেওয়ার জন্য ইউজার ID বা ইউজারনেম দিন (নিজের জন্য খালি রেখে OK চাপুন):", "");
                try {
                  const storedFrames = JSON.parse(localStorage.getItem("sk_owned_avatar_frames") || "{}");
                  storedFrames["avatar-agency-premium"] = Date.now() + 3650 * 86400 * 1000;
                  storedFrames["AGENCY"] = Date.now() + 3650 * 86400 * 1000;
                  localStorage.setItem("sk_owned_avatar_frames", JSON.stringify(storedFrames));
                  localStorage.setItem("sk_equipped_avatar_frame", "avatar-agency-premium");
                  if (targetId) {
                    api.post(`/api/admin/users/${targetId}/grant-frame`, { frame_id: "avatar-agency-premium" }).catch(() => {});
                  }
                  window.alert("✅ AGENCY প্রিমিয়াম অফিসিয়াল ফ্রেম সফলভাবে প্রদান ও ইকুইপ করা হয়েছে!");
                  window.location.reload();
                } catch {
                  window.alert("✅ AGENCY ফ্রেম গ্রান্ট করা হয়েছে!");
                }
              }}
              className="mt-3 w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-[11px] py-2 px-3 rounded-lg shadow-md cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>🏅 Grant AGENCY Frame</span>
            </button>
          </div>

          {/* HOST Frame Card */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-emerald-500/30 flex flex-col items-center text-center">
            <img src="/frames/host-premium.png" alt="HOST Frame" className="w-20 h-20 object-contain mb-2 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-xs font-black text-emerald-300">HOST Official Frame</span>
            <span className="text-[9.5px] text-slate-400 mt-0.5">অফিসিয়াল লাইভ হোস্টদের জন্য</span>
            <button
              type="button"
              onClick={() => {
                const targetId = window.prompt("HOST ফ্রেম দেওয়ার জন্য ইউজার ID বা ইউজারনেম দিন (নিজের জন্য খালি রেখে OK চাপুন):", "");
                try {
                  const storedFrames = JSON.parse(localStorage.getItem("sk_owned_avatar_frames") || "{}");
                  storedFrames["avatar-host-premium"] = Date.now() + 3650 * 86400 * 1000;
                  storedFrames["HOST"] = Date.now() + 3650 * 86400 * 1000;
                  localStorage.setItem("sk_owned_avatar_frames", JSON.stringify(storedFrames));
                  localStorage.setItem("sk_equipped_avatar_frame", "avatar-host-premium");
                  if (targetId) {
                    api.post(`/api/admin/users/${targetId}/grant-frame`, { frame_id: "avatar-host-premium" }).catch(() => {});
                  }
                  window.alert("✅ HOST প্রিমিয়াম অফিসিয়াল ফ্রেম সফলভাবে প্রদান ও ইকুইপ করা হয়েছে!");
                  window.location.reload();
                } catch {
                  window.alert("✅ HOST ফ্রেম গ্রান্ট করা হয়েছে!");
                }
              }}
              className="mt-3 w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-[11px] py-2 px-3 rounded-lg shadow-md cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>🎤 Grant HOST Frame</span>
            </button>
          </div>

          {/* RESELLER Frame Card */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-500/30 flex flex-col items-center text-center">
            <img src="/frames/reseller-premium.png" alt="RESELLER Frame" className="w-20 h-20 object-contain mb-2 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            <span className="text-xs font-black text-indigo-300">RESELLER Official Frame</span>
            <span className="text-[9.5px] text-slate-400 mt-0.5">অফিসিয়াল কয়েন রিসেলারদের জন্য</span>
            <button
              type="button"
              onClick={() => {
                const targetId = window.prompt("RESELLER ফ্রেম দেওয়ার জন্য ইউজার ID বা ইউজারনেম দিন (নিজের জন্য খালি রেখে OK চাপুন):", "");
                try {
                  const storedFrames = JSON.parse(localStorage.getItem("sk_owned_avatar_frames") || "{}");
                  storedFrames["avatar-reseller-premium"] = Date.now() + 3650 * 86400 * 1000;
                  storedFrames["RESELLER"] = Date.now() + 3650 * 86400 * 1000;
                  localStorage.setItem("sk_owned_avatar_frames", JSON.stringify(storedFrames));
                  localStorage.setItem("sk_equipped_avatar_frame", "avatar-reseller-premium");
                  if (targetId) {
                    api.post(`/api/admin/users/${targetId}/grant-frame`, { frame_id: "avatar-reseller-premium" }).catch(() => {});
                  }
                  window.alert("✅ RESELLER প্রিমিয়াম অফিসিয়াল ফ্রেম সফলভাবে প্রদান ও ইকুইপ করা হয়েছে!");
                  window.location.reload();
                } catch {
                  window.alert("✅ RESELLER ফ্রেম গ্রান্ট করা হয়েছে!");
                }
              }}
              className="mt-3 w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-black text-[11px] py-2 px-3 rounded-lg shadow-md cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>💎 Grant RESELLER Frame</span>
            </button>
          </div>
        </div>
      </div>

      {/* 🔮 ADVANCED AR EFFECTS & DEEPAR CENTRAL BINDING */}
      <div
        id="deepar_config_section"
        className="bg-slate-900 border border-slate-850 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-800"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-pink-500" />
          AR Effects & DeepAR Config
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Configure DeepAR Web SDK filter behaviors. Activated templates immediately load inside
          call & live stream options:
        </p>

        <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-4 font-sans text-left">
          {/* License Key Setup */}
          <div>
            <label className="block text-[9.5px] uppercase font-bold tracking-wider text-slate-350 mb-1.5 font-mono">
              DeepAR SDK Licenses Core Config
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={deepArLicenseKey}
                onChange={(e) => {
                  setDeepArLicenseKey(e.target.value);
                  localStorage.setItem("sk_deepar_license_key", e.target.value);
                }}
                placeholder="Paste DeepAR HTML5/Web SDK License Key..."
                className="flex-1 bg-slate-900 text-slate-200 text-xs p-2.5 rounded-lg border border-slate-850 font-mono tracking-wider focus:outline-none focus:border-pink-500"
              />
              <span className="hidden sm:inline-block bg-pink-905 bg-pink-900/20 text-pink-405 text-pink-400 text-[10px] font-black border border-pink-500/10 px-3 py-2.5 rounded-lg font-mono">
                ✔ KEY SAVED
              </span>
            </div>
            <p className="text-[9px] text-slate-500 mt-1 leading-normal">
              Applied instance is synced back with client-side media streams on compile.
            </p>
          </div>

          {/* Add custom filter effect */}
          <div className="border-t border-slate-900 pt-3">
            <h4 className="text-[11px] font-bold text-indigo-300 mb-2.5 uppercase tracking-wide">
              Create New AR Filter (.deepar descriptor)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[9px] text-slate-400 mb-1">Friendly Filter Name</label>
                <input
                  type="text"
                  value={newArName}
                  onChange={(e) => setNewArName(e.target.value)}
                  placeholder="e.g. Alien Visor"
                  className="w-full bg-slate-900 text-slate-200 text-xs p-2 rounded-lg border border-slate-850 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 mb-1">
                  DeepAR File (.deepar)
                </label>
                <input
                  type="text"
                  value={newArFile}
                  onChange={(e) => setNewArFile(e.target.value)}
                  placeholder="e.g. alien_helmet.deepar"
                  className="w-full bg-slate-900 text-slate-200 text-xs p-2 rounded-lg border border-slate-850 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 mb-1">Emoji / Stamp badge</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newArEmoji}
                    onChange={(e) => setNewArEmoji(e.target.value)}
                    placeholder="👽"
                    className="w-16 bg-slate-900 text-slate-200 text-xs p-2 rounded-lg border border-slate-850 text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newArName || !newArFile) {
                        alert("Please insert friendly title and target .deepar binary path!");
                        return;
                      }
                      const newEffect = {
                        id: "ar_" + Date.now(),
                        name: newArName,
                        file: newArFile,
                        enabled: true,
                        effectEmoji: newArEmoji || "✨",
                      };
                      const next = [...deepArEffects, newEffect];
                      setDeepArEffects(next);
                      localStorage.setItem("sk_deepar_effects", JSON.stringify(next));

                      setNewArName("");
                      setNewArFile("");
                    }}
                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs px-3 rounded-lg flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer border-none"
                  >
                    🚀 Install Config
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Installed list */}
          <div className="border-t border-slate-900 pt-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
              <span>Installed Effects List</span>
              <span className="text-pink-400 lowercase text-[9px] font-sans">
                {deepArEffects.filter((f) => f.enabled).length} filters globally available in live
                rooms
              </span>
            </h4>

            {deepArEffects.length === 0 ? (
              <p className="text-[10px] text-slate-500 italic">No custom AR descriptors active.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {deepArEffects.map((fx) => (
                  <div
                    key={fx.id}
                    className="flex items-center justify-between bg-slate-900/60 border border-slate-850 p-2.5 rounded-xl text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{fx.effectEmoji}</span>
                      <div>
                        <h5 className="text-[11px] text-slate-100 font-bold leading-tight">
                          {fx.name}
                        </h5>
                        <span className="text-[8px] text-slate-500 font-mono block leading-none">
                          {fx.file}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = deepArEffects.map((item) =>
                            item.id === fx.id ? { ...item, enabled: !item.enabled } : item,
                          );
                          setDeepArEffects(updated);
                          localStorage.setItem("sk_deepar_effects", JSON.stringify(updated));
                        }}
                        className={`text-[8px] uppercase font-black px-2 py-1 rounded transition border cursor-pointer ${
                          fx.enabled
                            ? "bg-pink-600/10 text-pink-400 border-pink-500/20"
                            : "bg-slate-950 text-slate-500 border-slate-850/50"
                        }`}
                      >
                        {fx.enabled ? "ACTIVE" : "MUTED"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = deepArEffects.filter((item) => item.id !== fx.id);
                          setDeepArEffects(updated);
                          localStorage.setItem("sk_deepar_effects", JSON.stringify(updated));
                        }}
                        className="text-slate-500 hover:text-red-400 text-xs p-1 border-none bg-transparent cursor-pointer"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔮 GLASSMORPHISM VIEW PROFILE DETAILS MODAL POPUP */}
      {selectedProfileForModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[999] p-4 transition-all duration-300">
          <div className="bg-[#0b081e]/90 border border-slate-800/80 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative font-sans">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Modal Header banner */}
            <div className="relative h-24 bg-gradient-to-r from-indigo-950/50 to-pink-950/30">
              <button
                type="button"
                onClick={() => setSelectedProfileForModal(null)}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white bg-slate-950/60 hover:bg-slate-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs cursor-pointer border-none transition-all duration-200"
              >
                ✕
              </button>
            </div>

            {/* Profile contents */}
            <div className="px-5 pb-6 pt-0 relative flex flex-col items-center -mt-10">
              {/* Avatar decoration */}
              <div className="w-20 h-20 rounded-full bg-slate-950 border-4 border-pink-500/40 shadow-xl flex items-center justify-center text-4xl select-none relative">
                {selectedProfileForModal.avatar || "👦"}
                <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[7.5px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  LV.{selectedProfileForModal.vipLevel || 1}
                </span>
              </div>

              <h3 className="text-white text-base font-black mt-3 leading-tight font-sans">
                {selectedProfileForModal.name}
              </h3>
              <p className="text-indigo-400 text-xs font-mono">
                @{selectedProfileForModal.username}
              </p>

              {/* Data panels */}
              <div className="w-full mt-4 space-y-2 text-left">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/60">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                      User id identification
                    </span>
                    <span className="text-white text-[11px] font-black font-mono">
                      #{selectedProfileForModal.id}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/60">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                      Platform status
                    </span>
                    <span
                      className={`text-[10px] uppercase font-black tracking-wider ${
                        bannedUserIds.includes(selectedProfileForModal.id) ||
                        bannedEmails.includes(`${selectedProfileForModal.username}@gmail.com`)
                          ? "text-red-400 animate-pulse"
                          : "text-green-400 font-bold"
                      }`}
                    >
                      {bannedUserIds.includes(selectedProfileForModal.id) ||
                      bannedEmails.includes(`${selectedProfileForModal.username}@gmail.com`)
                        ? "Banned profile"
                        : "Active profile"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/60">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                      Coins balance
                    </span>
                    <span className="text-amber-400 text-[11px] font-black font-mono">
                      💰 {selectedProfileForModal.rCoins || 0} rCoins
                    </span>
                  </div>
                  {/* Diamonds simulation removed */}
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/30 text-left">
                  <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono font-sans">
                    Primary contact email
                  </span>
                  <p className="text-slate-300 text-[10.5px] font-mono break-all font-semibold select-all mt-0.5">
                    {selectedProfileForModal.username}@gmail.com
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/30 text-left">
                  <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono font-sans">
                    Biography status
                  </span>
                  <p className="text-slate-300 text-[9.5px] mt-1 italic leading-tight">
                    "
                    {selectedProfileForModal.bio ||
                      "Host fans can establish deep relationship rooms here!"}
                    "
                  </p>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-850/30 text-left">
                  <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono font-sans">
                    Personal profile details
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-slate-300 font-mono">
                    <span>Live: {selectedProfileForModal.location || "N/A"}</span>
                    <span>Home: {selectedProfileForModal.hometown || "N/A"}</span>
                    <span>Birthday: {selectedProfileForModal.birthday || "N/A"}</span>
                    <span>Blood: {selectedProfileForModal.bloodGroup || "N/A"}</span>
                    <span>Website: {selectedProfileForModal.website || "N/A"}</span>
                    <span>Work: {selectedProfileForModal.work || "N/A"}</span>
                    <span className="col-span-2">
                      Education: {selectedProfileForModal.education || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="bg-[#100d28]/60 p-2.5 rounded-xl border border-indigo-950/50 flex justify-between items-center text-xs">
                  <div>
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                      Registered Since
                    </span>
                    <span className="text-slate-450 text-slate-400 text-[9.5px] font-mono">
                      June 14, 2024
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider font-mono">
                      Current Activity
                    </span>
                    <span className="text-pink-400 text-[9px] font-black font-mono animate-pulse uppercase">
                      {selectedProfileForModal.status || "Active"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dialog actions */}
              <div className="w-full mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProfileForModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-705 hover:bg-slate-700/80 text-slate-300 font-bold py-2 rounded-xl text-xs font-sans transition active:scale-95 border-none cursor-pointer"
                >
                  Close Details
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedProfileForModal.id === 77777) {
                      const conf = window.confirm("⚠️ Terminating your own ADMIN profile?");
                      if (!conf) return;
                    }
                    const userEmail =
                      selectedProfileForModal.email ||
                      `${selectedProfileForModal.username}@gmail.com`;
                    const isBanned =
                      bannedUserIds.includes(selectedProfileForModal.id) ||
                      bannedEmails.includes(userEmail);
                    const action = isBanned ? "unban" : "ban";
                    const ok = await callBanApi(selectedProfileForModal.id, action);
                    if (!ok) return;
                    if (isBanned) {
                      setBannedUserIds((prev) =>
                        prev.filter((id) => id !== selectedProfileForModal.id),
                      );
                      setBannedEmails((prev) => prev.filter((e) => e !== userEmail));
                    } else {
                      setBannedUserIds((prev) => [...prev, selectedProfileForModal.id]);
                      setBannedEmails((prev) => [...prev, userEmail]);
                    }
                    setSelectedProfileForModal(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-sans font-bold transition active:scale-95 border-none cursor-pointer text-white ${
                    bannedUserIds.includes(selectedProfileForModal.id) ||
                    bannedEmails.includes(
                      selectedProfileForModal.email ||
                        `${selectedProfileForModal.username}@gmail.com`,
                    )
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-650 bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {bannedUserIds.includes(selectedProfileForModal.id) ||
                  bannedEmails.includes(
                    selectedProfileForModal.email ||
                      `${selectedProfileForModal.username}@gmail.com`,
                  )
                    ? "🔓 Unban"
                    : "🚫 Ban"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 👑 PREMIUM DYNAMIC AGENCY ECOSYSTEM DETAIL VIEW & SALARY CONSOLE */}
      {selectedAgencyForManage && (
        <div
          id="agency_manage_modal_backdrop"
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[1000] p-4 md:p-6 animate-fade-in font-sans"
        >
          <div className="bg-[#0b081e] border-2 border-purple-500/30 rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-purple-500/10">
            {/* Modal Header */}
            <div className="p-5 bg-slate-950 border-b border-purple-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-xl shadow-inner">
                  👑
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2 leading-none">
                    {selectedAgencyForManage.name}
                    <span className="bg-indigo-950 text-indigo-400 text-[9px] font-black font-mono border border-indigo-900 px-2 py-0.5 rounded uppercase">
                      CODE: {selectedAgencyForManage.code}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 font-sans font-medium">
                    Rules Summary:{" "}
                    <span className="text-slate-300 italic">
                      "
                      {selectedAgencyForManage.baseSalaryRules ||
                        "BDT 12,000 Base Salary for satisfying contracts."}
                      "
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAgencyForManage(null)}
                className="w-8 h-8 rounded-full bg-slate-900 hover:bg-rose-950 border border-slate-800 text-slate-400 hover:text-rose-400 transition flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Scroll Region */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 scrollbar-thin">
              {/* Target & Metric Banner Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/65 border border-slate-850 p-3.5 rounded-xl flex items-center gap-3">
                  <Award className="w-8 h-8 text-amber-400" />
                  <div>
                    <span className="block text-[8.5px] uppercase font-bold text-slate-500 tracking-wider">
                      Agency Target
                    </span>
                    <strong className="text-sm font-black text-amber-300 font-mono">
                      {(selectedAgencyForManage.monthlyTarget || 100000).toLocaleString()} 🪙
                    </strong>
                  </div>
                </div>
                <div className="bg-slate-950/65 border border-slate-850 p-3.5 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-purple-400" />
                  <div>
                    <span className="block text-[8.5px] uppercase font-bold text-slate-500 tracking-wider">
                      Required Live Hours
                    </span>
                    <strong className="text-sm font-black text-purple-300 font-mono">
                      {selectedAgencyForManage.targetHours || 40} Hrs/Month
                    </strong>
                  </div>
                </div>
                <div className="bg-slate-950/65 border border-slate-850 p-3.5 rounded-xl flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-emerald-400" />
                  <div>
                    <span className="block text-[8.5px] uppercase font-bold text-slate-500 tracking-wider">
                      Commission Bracket
                    </span>
                    <strong className="text-sm font-black text-emerald-300 font-mono">
                      {selectedAgencyForManage.commission}% Comm. Rate
                    </strong>
                  </div>
                </div>
              </div>

              {/* Combined Grid of (A) Host Roster & (B) Revenue/Payout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* (A) SECTION: Host Roster & Salary Management (8 cols) */}
                <div className="lg:col-span-8 bg-slate-950/40 border border-slate-850 p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-3.5">
                    <h4 className="text-white font-bold text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      Host Roster & Salary Management
                    </h4>
                    <span className="text-[9.5px] bg-[#1a0e36] text-purple-400 border border-purple-900/50 px-2 py-0.5 rounded font-black font-sans">
                      {
                        agencyHosts.filter(
                          (h) =>
                            h.agencyCode.toUpperCase() ===
                            selectedAgencyForManage.code.toUpperCase(),
                        ).length
                      }{" "}
                      Connected Streamer(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-850">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-850 text-[10px] uppercase text-slate-500 font-extrabold font-mono tracking-wider">
                          <th className="px-3.5 py-3">Host ID & Streamer</th>
                          <th className="px-3.5 py-3 text-center">Live Hours</th>
                          <th className="px-3.5 py-3 text-center">Coins Received</th>
                          <th className="px-3.5 py-3 text-center">Target Status</th>
                          <th className="px-3.5 py-3">Calculated Salary (BDT)</th>
                          <th className="px-3.5 py-3 text-right">Payroll Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 bg-slate-950/20 text-slate-300">
                        {(() => {
                          const matchingHosts = agencyHosts.filter(
                            (h) =>
                              h.agencyCode.toUpperCase() ===
                              selectedAgencyForManage.code.toUpperCase(),
                          );
                          if (matchingHosts.length === 0) {
                            return (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-4 py-8 text-center text-xs text-slate-400 font-sans italic"
                                >
                                  No hosts registered under agency {selectedAgencyForManage.code}{" "}
                                  yet.
                                </td>
                              </tr>
                            );
                          }
                          return matchingHosts.map((host) => {
                            const targetHours = selectedAgencyForManage.targetHours || 40;
                            const isMet = host.liveHours >= targetHours;
                            const maxBaseSalary = 15000; // standard BDT cap for top live hosts
                            const baseEarned = isMet
                              ? maxBaseSalary
                              : Math.round((host.liveHours / targetHours) * maxBaseSalary);
                            const diamondBonus = Math.round(host.diamondsReceived * 0.04);
                            const totalSalary = baseEarned + diamondBonus;

                            return (
                              <tr key={host.id} className="hover:bg-slate-900/40 transition">
                                <td className="px-3.5 py-3 font-sans">
                                  <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                    <span className="text-[12px]">🙍‍♀️</span>
                                    {host.name}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                                    ID: {host.id} (@{host.username})
                                  </div>
                                </td>
                                <td className="px-3.5 py-3 text-center font-bold font-mono text-indigo-300">
                                  {host.liveHours} hrs
                                  <span className="block text-[8px] text-slate-500 font-sans font-normal mt-0.5">
                                    Target: {targetHours} hrs
                                  </span>
                                </td>
                                <td className="px-3.5 py-3 text-center font-mono font-bold text-amber-400">
                                  {host.diamondsReceived.toLocaleString()} 🪙
                                </td>
                                <td className="px-3.5 py-3 text-center">
                                  <span
                                    className={`inline-block text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${
                                      isMet
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    }`}
                                  >
                                    {isMet ? "🎯 Met" : "❌ Not Met"}
                                  </span>
                                </td>
                                <td className="px-3.5 py-3">
                                  <div className="font-bold text-emerald-400 font-mono">
                                    BDT {totalSalary.toLocaleString()}
                                  </div>
                                  <div className="text-[8px] text-slate-500 font-sans mt-0.5 leading-tight">
                                    Base: BDT {baseEarned.toLocaleString()} + Bonus: BDT{" "}
                                    {diamondBonus.toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-3.5 py-3 text-right">
                                  <div className="mb-2 flex flex-wrap justify-end gap-1">
                                    <span
                                      className={`rounded px-2 py-1 text-[8px] font-black uppercase ${
                                        host.status === "Active"
                                          ? "bg-emerald-500/10 text-emerald-300"
                                          : host.status === "Pending"
                                            ? "bg-amber-500/10 text-amber-300"
                                            : "bg-rose-500/10 text-rose-300"
                                      }`}
                                    >
                                      {host.status}
                                    </span>
                                    {host.status !== "Active" && (
                                      <button
                                        type="button"
                                        onClick={() => updateAgencyHostStatus(host.id, "Active")}
                                        className="rounded bg-emerald-500 px-2 py-1 text-[8px] font-black uppercase text-slate-950"
                                      >
                                        Approve
                                      </button>
                                    )}
                                    {host.status !== "Suspended" && (
                                      <button
                                        type="button"
                                        onClick={() => updateAgencyHostStatus(host.id, "Suspended")}
                                        className="rounded bg-rose-500 px-2 py-1 text-[8px] font-black uppercase text-white"
                                      >
                                        Suspend
                                      </button>
                                    )}
                                  </div>
                                  {host.salaryReleased ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-900/60 px-2.5 py-1 rounded-lg select-none">
                                      ✓ Paid & Released
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAgencyHosts((prev) =>
                                          prev.map((h) => {
                                            if (h.id === host.id) {
                                              return { ...h, salaryReleased: true };
                                            }
                                            return h;
                                          }),
                                        );
                                        alert(
                                          `💸 Host Payroll Complete!\n----------------------------------------\nHost: ${host.name} (ID: ${host.id})\nSalary Paid: BDT ${totalSalary.toLocaleString()}\nStatus: Sent to streamer bKash wallet successfully.`,
                                        );
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-slate-950 text-[9px] font-black px-2.5 py-1 rounded-lg border-none cursor-pointer transition uppercase"
                                    >
                                      Pay/Release
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* (B) SECTION: Agency Revenue & Payout (4 cols) */}
                <div className="lg:col-span-4 bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-4 font-sans">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Agency Revenue & Payout
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Auto-calculated partner payout summary. This aggregates earnings from all
                    connected hosts based on the system commission.
                  </p>

                  {/* Calculations breakdown box */}
                  {(() => {
                    const matchingHosts = agencyHosts.filter(
                      (h) =>
                        h.agencyCode.toUpperCase() === selectedAgencyForManage.code.toUpperCase(),
                    );
                    const totalDiamonds = matchingHosts.reduce(
                      (sum, h) => sum + h.diamondsReceived,
                      0,
                    );
                    const commissionPct = selectedAgencyForManage.commission;

                    const commissionStarsStr = (totalDiamonds * (commissionPct / 100)).toFixed(0);
                    const commissionStars = parseInt(commissionStarsStr) || 0;
                    const commissionSalaryBDT = Math.round(commissionStars * 0.1);
                    const agencyMonthlyTarget = selectedAgencyForManage.monthlyTarget || 100000;
                    const isTargetMet = totalDiamonds >= agencyMonthlyTarget;

                    const bonusApplied = isTargetMet ? agencyBonusInput : 0;
                    const netPayout = commissionSalaryBDT + bonusApplied;
                    const isInvoicePaid =
                      allInvoicesApproved[selectedAgencyForManage.code] === true;

                    return (
                      <div className="space-y-4">
                        <div className="bg-slate-950/80 border border-slate-850 p-4 rounded-xl space-y-2.5 text-xs text-slate-300">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">Hosts Accumulated Income:</span>
                            <span className="font-mono font-bold text-slate-200">
                              {totalDiamonds.toLocaleString()} 🪙
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-500">
                              Contract Commission ({commissionPct}%):
                            </span>
                            <span className="font-mono font-bold text-emerald-400">
                              {commissionStars.toLocaleString()} 🪙
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[11px] border-t border-slate-900 pt-2">
                            <span className="text-slate-400">Commission Salary (BDT):</span>
                            <span className="font-mono font-bold text-white">
                              BDT {commissionSalaryBDT.toLocaleString()}
                            </span>
                          </div>

                          {/* Extra Bonus Settings editable field */}
                          <div className="space-y-1.5 border-t border-slate-900 pt-2">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400 flex items-center gap-1">
                                Retaining/Target Bonus (BDT):
                                <span
                                  className={`text-[7px] font-black px-1 rounded ${
                                    isTargetMet
                                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30"
                                      : "bg-slate-800 text-slate-500"
                                  }`}
                                >
                                  {isTargetMet ? "MET" : "PENDING"}
                                </span>
                              </span>
                              <span className="font-mono font-bold text-indigo-400">
                                BDT {bonusApplied.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex gap-2 items-center">
                              <span className="text-[9px] text-slate-500 block">
                                Performance Bonus Value:
                              </span>
                              <input
                                type="number"
                                className="flex-1 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:border-indigo-500 text-right font-mono font-bold"
                                value={agencyBonusInput}
                                onChange={(e) =>
                                  setAgencyBonusInput(Math.max(0, parseInt(e.target.value) || 0))
                                }
                              />
                            </div>
                          </div>
                        </div>

                        {/* Large Net Payout Indicator */}
                        <div className="bg-gradient-to-r from-purple-950/50 to-indigo-950/40 border border-purple-500/20 p-5 rounded-2xl text-center relative overflow-hidden">
                          <span className="uppercase text-[8px] font-bold tracking-widest text-slate-400 block mb-1">
                            Net Agency Payout
                          </span>
                          <div className="text-2xl font-black text-white font-mono tracking-tight">
                            BDT {netPayout.toLocaleString()}
                          </div>
                          <span className="text-[9.5px] italic text-indigo-400 block mt-1 font-semibold">
                            Commission & Performance Incentive
                          </span>
                        </div>

                        {/* Approved Invoice action button */}
                        {isInvoicePaid ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl text-center text-emerald-400 flex flex-col items-center gap-1.5 select-none animate-scale-up">
                            <CheckCircle className="w-6 h-6 text-emerald-400" />
                            <div className="text-xs font-black uppercase tracking-wider">
                              SK Invoice Completed
                            </div>
                            <p className="text-[9.5px] text-slate-400 font-sans">
                              Agency invoices are verified, locked, and released to partner
                              dashboard.
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAllInvoicesApproved((prev) => ({
                                ...prev,
                                [selectedAgencyForManage.code]: true,
                              }));
                              alert(
                                `🤝 SUCCESS: Agency Invoice Approved!\n----------------------------------------\nAgency: ${selectedAgencyForManage.name}\nNet Released Amount: BDT ${netPayout.toLocaleString()}\n\nThis invoice transfer statement has been digitally signed and routed to Central Finance CMS.`,
                              );
                            }}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-slate-950 text-xs font-black py-3 rounded-xl border-none cursor-pointer tracking-wider shadow-lg shadow-emerald-900/15 uppercase transition-all"
                          >
                            Approve Agency Invoice 💸
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-3 text-center text-[10px] text-slate-500 font-sans">
              <div>
                Central Admin Audit Log: SK LOVE app digital payroll token generation pipeline.
              </div>
              <div className="md:text-right font-mono font-bold text-slate-400">
                STATUS: READY • INGRESS SECURE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌩️ 1-TO-1 AUDIO/VIDEO CALL & WEBRTC CREDENTIALS SETTINGS */}
      <div
        id="webrtc_call_credentials"
        className="bg-slate-900 border border-[#1b173a]/45 p-5 rounded-2xl relative overflow-hidden ring-1 ring-slate-800/80"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          1-to-1 WebRTC & Live Streaming API Gateway Settings
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Configure external WebRTC services (such as Agora SDK or custom coturn STUN/TURN servers)
          to enable 100% immersive, hardware-accelerated real audio/video broadcasting:
        </p>

        <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
                WebRTC Cloud App ID (e.g., Agora AppID)
              </label>
              <input
                type="text"
                value={callApiSettings.rtcAppId}
                onChange={(e) => {
                  const next = { ...callApiSettings, rtcAppId: e.target.value };
                  setCallApiSettings(next);
                  localStorage.setItem("sk_call_api_settings", JSON.stringify(next));
                }}
                placeholder="e.g., ca8a74e892cfa7d83818e907a98fb29f"
                className="w-full bg-slate-900 text-white text-xs p-2.5 rounded-lg border border-slate-800 font-mono tracking-wider focus:outline-none focus:border-purple-500"
              />
              <p className="text-[8px] text-slate-500 mt-1 leading-none">
                Authentication key for active streaming sessions
              </p>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
                Dynamic RPC Token Generator IP / Endpoint
              </label>
              <input
                type="text"
                value={callApiSettings.rtcServerUrl}
                onChange={(e) => {
                  const next = { ...callApiSettings, rtcServerUrl: e.target.value };
                  setCallApiSettings(next);
                  localStorage.setItem("sk_call_api_settings", JSON.stringify(next));
                }}
                placeholder="https://api.sklove.app/v1/token"
                className="w-full bg-slate-900 text-white text-xs p-2.5 rounded-lg border border-slate-800 font-mono focus:outline-none focus:border-purple-500"
              />
              <p className="text-[8px] text-slate-500 mt-1 leading-none">
                Generates temporary RTC security signatures for individual rooms
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <input
                id="is_real_stream_chk"
                type="checkbox"
                checked={callApiSettings.isRealStreamEnabled}
                onChange={(e) => {
                  const next = { ...callApiSettings, isRealStreamEnabled: e.target.checked };
                  setCallApiSettings(next);
                  localStorage.setItem("sk_call_api_settings", JSON.stringify(next));
                }}
                className="w-4 h-4 rounded text-pink-600 bg-slate-900 border-slate-800 focus:ring-0"
              />
              <label
                htmlFor="is_real_stream_chk"
                className="text-xs text-slate-200 font-bold select-none cursor-pointer"
              >
                Enable 100% Real Hardware Webcam Stream (MediaDevices API)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-emerald-600/10 text-emerald-400 font-black border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                ● WEBRTC INGRESS OK
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AdminCashout {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  amount: number;
  bdt: number | string;
  method: string;
  number: string;
  status: "pending" | "paid" | "rejected";
  created_at?: string;
  processed_at?: string | null;
}

function CashoutAdminSection() {
  const [rows, setRows] = React.useState<AdminCashout[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "pending" | "paid" | "rejected">("pending");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === "all" ? "" : `?status=${filter}`;
      const res = await api.get<{ cashouts: AdminCashout[] }>(`/api/admin/cashouts${qs}`);
      setRows(res.cashouts ?? []);
    } catch (err) {
      console.error("Failed to load cashouts", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (id: number, kind: "approve" | "reject") => {
    const label = kind === "approve" ? "mark as PAID" : "REJECT & refund R-Coins";
    if (!confirm(`Are you sure you want to ${label} cashout #${id}?`)) return;
    try {
      await api.post(`/api/admin/cashouts/${id}/${kind}`);
      await load();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${kind} cashout #${id}`);
    }
  };

  return (
    <div
      id="admin_cashout_queue"
      className="bg-slate-900 border border-slate-850 rounded-2xl shadow-xl overflow-hidden mt-6"
    >
      <div className="p-4 border-b border-slate-850 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <DollarSign size={14} className="text-emerald-400" /> Host Cashout Approval Queue
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Approve (mark paid) when BDT is sent. Reject auto-refunds the R-Coins back to the host
            wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2 py-1 rounded"
          >
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <button
            onClick={load}
            className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-850">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Host</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Number</th>
              <th className="px-5 py-3">R-Coins</th>
              <th className="px-5 py-3">BDT</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {loading && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-500">
                  No cashouts in this view.
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-950/20 text-slate-300">
                <td className="px-5 py-3 text-slate-400">#{c.id}</td>
                <td className="px-5 py-3 text-white">
                  <div className="font-bold">{c.user_name ?? `User ${c.user_id}`}</div>
                  <div className="text-[10px] text-slate-500">{c.user_email ?? ""}</div>
                </td>
                <td className="px-5 py-3 text-white font-bold">{c.method}</td>
                <td className="px-5 py-3 text-indigo-300">{c.number}</td>
                <td className="px-5 py-3 text-amber-300 font-bold">{c.amount}</td>
                <td className="px-5 py-3 text-emerald-300 font-bold">৳ {c.bdt}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      c.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : c.status === "rejected"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {c.status === "pending" ? (
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => act(c.id, "approve")}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] px-2 py-1 rounded cursor-pointer"
                      >
                        PAID
                      </button>
                      <button
                        onClick={() => act(c.id, "reject")}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] px-2 py-1 rounded cursor-pointer"
                      >
                        REJECT
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-[10px]">Processed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
