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
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription().then(() => {
        // Auto-subscribe if no prior decision has been made
        if (!localStorage.getItem("vibra-push-decision-made")) {
          attemptAutoSubscribe();
        }
      });
    }
  }, []);

  const attemptAutoSubscribe = async () => {
    setAutoSubscribeAttempted(true);
    try {
      if (Notification.permission === "default") {
        // Request permission silently (or request if needed)
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm === "granted") {
          await performSubscribe();
          localStorage.setItem("vibra-push-decision-made", "true");
        } else if (perm === "denied") {
          localStorage.setItem("vibra-push-decision-made", "true");
        }
      } else if (Notification.permission === "granted") {
        // Already granted, subscribe
        await performSubscribe();
        localStorage.setItem("vibra-push-decision-made", "true");
      }
    } catch (err) {
      console.error("[push] auto-subscribe error:", err);
    }
  };

  const checkExistingSubscription = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {}
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
