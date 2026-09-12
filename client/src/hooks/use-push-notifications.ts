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
    // Guard: check API availability without relying on property access that may throw on iOS 26
    let supported = false;
    try {
      supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    } catch {
      supported = false;
    }
    setIsSupported(supported);
    if (supported) {
      try {
        // Notification.permission access can throw on iOS 26 in restricted contexts
        setPermission(Notification.permission);
      } catch {
        setPermission("default");
      }
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
