import { useEffect, useRef, useState } from "react";

export function useDeferredVideo(delayMs = 1200) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || shouldLoadVideo) return;

    let hasIntersected = false;
    let timer: number | null = null;

    const scheduleLoad = () => {
      if (
        !hasIntersected ||
        document.visibilityState === "hidden" ||
        timer !== null
      ) {
        return;
      }

      timer = window.setTimeout(() => {
        timer = null;
        if (document.visibilityState === "visible") {
          setShouldLoadVideo(true);
        }
      }, delayMs);
    };

    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          hasIntersected = true;
          observer?.disconnect();
          scheduleLoad();
        }
      })
      : null;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      } else if (document.visibilityState === "visible") {
        scheduleLoad();
      }
    };

    if (observer) {
      observer.observe(video);
    } else {
      hasIntersected = true;
      scheduleLoad();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [delayMs, shouldLoadVideo]);

  return { videoRef, shouldLoadVideo };
}
