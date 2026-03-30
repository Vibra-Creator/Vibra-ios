import { useEffect } from "react";
import { playNotificationSound, playVibrappSound, initNotificationSound } from "@/lib/notification-sound";

export default function PushSoundHandler() {
  useEffect(() => {
    const handleInteraction = () => {
      initNotificationSound();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "VIBRA_PUSH_RECEIVED") {
        const pushType = event.data?.payload?.type;
        if (pushType === "vibrapp") {
          playVibrappSound();
        } else {
          playNotificationSound();
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
    };
  }, []);

  return null;
}
