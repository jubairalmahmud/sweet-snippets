// @ts-nocheck
import { useEffect, useRef } from "react";

/**
 * Hook to keep the device screen awake while the app is active / visible.
 * Uses the Web Screen Wake Lock API. Re-requests automatically if user returns to app.
 */
export function useKeepScreenAwake() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let isMounted = true;

    const requestWakeLock = async () => {
      if (typeof window === "undefined" || !("wakeLock" in navigator)) return;
      try {
        if (wakeLockRef.current && !wakeLockRef.current.released) {
          return;
        }
        const lock = await navigator.wakeLock.request("screen");
        if (isMounted) {
          wakeLockRef.current = lock;
          lock.addEventListener("release", () => {
            if (wakeLockRef.current === lock) {
              wakeLockRef.current = null;
            }
          });
        } else {
          await lock.release();
        }
      } catch (err) {
        // Silently catch wake lock errors (e.g. Battery Saver or permission restriction)
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    // Initial request
    void requestWakeLock();

    // Re-acquire lock when user switches back to this tab/app
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);
}
