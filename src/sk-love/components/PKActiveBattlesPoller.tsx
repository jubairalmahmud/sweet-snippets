// @ts-nocheck
/**
 * PKActiveBattlesPoller — polls GET /pk/active every 4s while enabled.
 * Feeds the Explore ▸ PK Battle grid and enables auto-sync from live streams.
 */
import { useEffect } from "react";
import { api } from "../lib/api";

type Battle = {
  id: number | string;
  from_host_id: number;
  to_host_id: number;
  from_room_id?: number | string | null;
  to_room_id?: number | string | null;
  from_name?: string;
  to_name?: string;
  from_avatar?: string | null;
  to_avatar?: string | null;
  from_score: number;
  to_score: number;
  duration_minutes: number;
  status?: string;
  remaining_sec?: number | null;
};

interface Props {
  enabled: boolean;
  onData: (list: Battle[]) => void;
  intervalMs?: number;
}

export default function PKActiveBattlesPoller({ enabled, onData, intervalMs = 4000 }: Props) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j = await api.get<any>("/api/pk/active");
        if (cancelled) return;
        const arr: Battle[] = Array.isArray(j?.data) ? j.data : [];
        onData(arr);
      } catch {
        // Keep the previous list on a transient auth/network failure.
        // Sending [] here can wrongly close a still-active PK viewer overlay.
      }
    };
    tick();
    const iv = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [enabled, intervalMs, onData]);

  return null;
}
