import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [autoSubscribeAttempted, setAutoSubscribeAttempted] = useState(false);

  useEffect(() => {
    // Guard both API availability and permission access; either can throw on restricted iOS contexts.
    let supported = false;
    let currentPermission: NotificationPermission = "default";
    try {
      supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (supported) {
        currentPermission = Notification.permission;
      }
    } catch {
      supported = false;
    }
    setIsSupported(supported);
    if (supported) {
      setPermission(currentPermission);
      checkExistingSubscription().then((hasSubscription) => {
        // Auto-subscribe only if already granted — never call requestPermission() here:
        // iOS 16.4+ (and stricter on iOS 26) requires a direct user-gesture call stack
        // for requestPermission(); calling it from a Promise chain throws TypeError and
        // can crash the app at launch.
        try {
          if (Notification.permission === "granted" && !hasSubscription) {
            attemptAutoSubscribe();
          }
        } catch {
          // Notification.permission access threw — skip silently
        }
      });
    }
  }, []);

  const attemptAutoSubscribe = async () => {
    setAutoSubscribeAttempted(true);
    try {
      // Only subscribe if permission is already granted.
      // Never call requestPermission() here — it requires a user gesture on iOS 16.4+/26.
      if (Notification.permission === "granted") {
        const result = await performSubscribe();
        if (result) {
          localStorage.setItem("vibra-push-decision-made", "true");
        }
      }
    } catch (err) {
      console.error("[push] auto-subscribe error:", err);
    }
  };

  const checkExistingSubscription = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const hasSubscription = !!sub;
      setIsSubscribed(hasSubscription);
      return hasSubscription;
    } catch {}
    return false;
  }, []);

  useEffect(() => {
    let active = true;
    let permissionStatus: PermissionStatus | undefined;

    const refreshPermission = () => {
      if (!active) return;
      try {
        setPermission(Notification.permission);
      } catch {
        // Permission access may be restricted in some browser contexts.
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshPermission();
    };

    const attachPermissionListener = async () => {
      try {
        if (!("Notification" in window) || !("permissions" in navigator)) return;
        const status = await navigator.permissions.query({
          name: "notifications" as PermissionName,
        });
        if (!active) return;
        permissionStatus = status;
        permissionStatus.addEventListener("change", refreshPermission);
        refreshPermission();
      } catch {
        // Permissions API is not available in every browser; focus/visibility checks remain.
      }
    };

    refreshPermission();
    void attachPermissionListener();
    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      permissionStatus?.removeEventListener("change", refreshPermission);
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const performSubscribe = useCallback(async () => {
    try {
      const res = await fetch("/api/push/vapid-key");
      const { publicKey } = await res.json();
      if (!publicKey) return false;

      const reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const subJson = sub.toJSON();
      const subRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      if (!subRes.ok) {
        console.error("[push] subscribe failed:", subRes.status);
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] subscribe error:", err);
      return false;
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const result = await performSubscribe();
      if (result) {
        localStorage.setItem("vibra-push-decision-made", "true");
      }
      return result;
    } catch (err) {
      console.error("[push] subscribe error:", err);
      return false;
    }
  }, [isSupported, performSubscribe]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const subJson = sub.toJSON();
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint: subJson.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
    }
  }, []);

  return { isSupported, isSubscribed, permission, subscribe, unsubscribe };
}
