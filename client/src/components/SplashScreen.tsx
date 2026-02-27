import { useState, useEffect, useCallback, useRef } from "react";
import { X, Shield, Volume2, VolumeX } from "lucide-react";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";
import { useLanguage } from "@/i18n/LanguageContext";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { t } = useLanguage();

  const dismiss = useCallback(() => {
    if (fadeOut || showCopyright) return;
    setFadeOut(true);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setTimeout(onComplete, 600);
  }, [onComplete, fadeOut, showCopyright]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.play().catch(() => {});

    const onEnded = () => {
      dismiss();
    };
    video.addEventListener("ended", onEnded);

    const timeout = setTimeout(() => {
      if (!showCopyright) dismiss();
    }, 30000);

    return () => {
      video.removeEventListener("ended", onEnded);
      clearTimeout(timeout);
    };
  }, [dismiss, showCopyright]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (muted) {
      video.muted = false;
      setMuted(false);
    } else {
      video.muted = true;
      setMuted(true);
    }
  };

  return (
    <div
      data-testid="splash-screen"
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#0a0118",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.6s ease-out",
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <video
        ref={videoRef}
        playsInline
        webkit-playsinline=""
        preload="auto"
        onCanPlay={() => setVideoReady(true)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 1,
          opacity: videoReady ? 1 : 0,
          transition: "opacity 0.5s ease-in",
        }}
        data-testid="splash-video"
      >
        <source src="/videos/vibra-landing-new.mp4" type="video/mp4" />
        <source src="/videos/vibra-landing.mov" type="video/quicktime" />
      </video>

      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.5) 100%)",
        zIndex: 2,
      }} />

      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "30%",
        background: "linear-gradient(to top, rgba(10,1,24,0.9), transparent)",
        zIndex: 2,
      }} />

      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 3,
        opacity: videoReady ? 0 : 1,
        transition: "opacity 0.5s ease-out",
        pointerEvents: "none",
      }}>
        <img
          src={vibraLogo}
          alt="Vibra"
          style={{
            width: "180px",
            height: "180px",
            objectFit: "contain",
            borderRadius: "50%",
            filter: "drop-shadow(0 0 25px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 50px rgba(168, 85, 247, 0.3))",
          }}
        />
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "1.1rem",
          fontWeight: 600,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          background: "linear-gradient(90deg, #c084fc, #f472b6, #67e8f9, #c084fc)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          animation: "splash-text-shimmer 3s linear infinite",
          marginTop: "16px",
        }}>
          {t("splash.tagline")}
        </p>
      </div>

      <button
        data-testid="button-unmute"
        onClick={toggleMute}
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 10,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.3)",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
        }}
      >
        {muted ? <VolumeX style={{ width: 20, height: 20 }} /> : <Volume2 style={{ width: 20, height: 20 }} />}
      </button>

      <div style={{
        position: "absolute",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
      }}>
        <img
          src={vibraLogo}
          alt="Vibra"
          style={{
            width: "60px",
            height: "60px",
            objectFit: "contain",
            borderRadius: "50%",
            filter: "drop-shadow(0 0 15px rgba(139, 92, 246, 0.5))",
          }}
        />
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.7)",
          textShadow: "0 0 10px rgba(0,0,0,0.8)",
        }}>
          {t("splash.tagline")}
        </p>
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "0.65rem",
          color: "rgba(255,255,255,0.4)",
          textShadow: "0 0 10px rgba(0,0,0,0.8)",
        }}>
          Tap to skip
        </p>
      </div>

      <button
        data-testid="button-copyright"
        onClick={(e) => {
          e.stopPropagation();
          setShowCopyright(true);
        }}
        style={{
          position: "absolute",
          bottom: "12px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 14px",
          borderRadius: "20px",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          background: "rgba(10, 1, 24, 0.6)",
          backdropFilter: "blur(8px)",
          color: "rgba(192, 132, 252, 0.8)",
          fontSize: "0.7rem",
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: "0.05em",
          cursor: "pointer",
        }}
      >
        <Shield style={{ width: 12, height: 12 }} />
        © 2026 Vibra
      </button>

      {showCopyright && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "rgba(10, 1, 24, 0.95)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{
            maxWidth: "400px",
            width: "100%",
            borderRadius: "20px",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            background: "linear-gradient(135deg, rgba(20, 5, 40, 0.95), rgba(10, 1, 24, 0.98))",
            padding: "28px",
            position: "relative",
            boxShadow: "0 0 40px rgba(139, 92, 246, 0.15), 0 0 80px rgba(168, 85, 247, 0.08)",
          }}>
            <button
              data-testid="button-close-copyright"
              onClick={() => setShowCopyright(false)}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <Shield style={{ width: 22, height: 22, color: "#c084fc" }} />
              <h3 style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "1.1rem",
                fontWeight: 700,
                background: "linear-gradient(90deg, #c084fc, #f472b6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {t("splash.copyright")}
              </h3>
            </div>

            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "0.85rem",
              lineHeight: 1.7,
              color: "rgba(255, 255, 255, 0.75)",
            }}>
              <p style={{ fontWeight: 600, color: "#c084fc", marginBottom: "12px", fontSize: "0.9rem" }}>
                © 2026 Vibra. {t("splash.allRights")}
              </p>
              <p style={{ marginBottom: "12px" }}>
                {t("splash.trademarkNotice")}
              </p>
              <p style={{ marginBottom: "12px" }}>
                {t("splash.reproductionNotice")}
              </p>
              <div style={{
                marginTop: "16px",
                padding: "12px",
                borderRadius: "12px",
                background: "rgba(139, 92, 246, 0.08)",
                border: "1px solid rgba(139, 92, 246, 0.15)",
              }}>
                <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                  <strong style={{ color: "rgba(255,255,255,0.65)" }}>{t("splash.app")}</strong> Vibra<br />
                  <strong style={{ color: "rgba(255,255,255,0.65)" }}>Bundle ID:</strong> com.vibraalienmatch<br />
                  <strong style={{ color: "rgba(255,255,255,0.65)" }}>{t("splash.developer")}</strong> VibraAlienMatch
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes splash-text-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
