import { useEffect, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import localforage from "localforage";

const DISMISSED_KEY = "location_permission_guide_dismissed_v2";

interface PermissionState {
  hasBackground: boolean;
  checked: boolean;
}

export function useLocationPermissionState() {
  const [state, setState] = useState<PermissionState>({ hasBackground: true, checked: false });
  const [dismissed, setDismissed] = useState(true); // start hidden until we check

  const checkPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setState({ hasBackground: true, checked: true });
      return;
    }

    try {
      const perms = await Geolocation.checkPermissions();
      // On Android, if location is "granted" but "All the time" isn't enabled,
      // background location may still be restricted. We show the guide unless dismissed.
      const isDismissed = await localforage.getItem<boolean>(DISMISSED_KEY);
      setDismissed(!!isDismissed);

      if (perms.location === "granted") {
        // Permission at least "while using" — check if user has dismissed the guide
        setState({ hasBackground: !!isDismissed, checked: true });
      } else {
        setState({ hasBackground: false, checked: true });
        setDismissed(false);
      }
    } catch {
      setState({ hasBackground: true, checked: true });
    }
  }, []);

  const dismiss = useCallback(async () => {
    await localforage.setItem(DISMISSED_KEY, true);
    setDismissed(true);
  }, []);

  const recheck = useCallback(async () => {
    await localforage.removeItem(DISMISSED_KEY);
    setDismissed(false);
    setState({ hasBackground: false, checked: true });
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  const shouldShow = state.checked && !state.hasBackground && !dismissed;

  return { shouldShow, dismiss, recheck, checkPermission };
}
