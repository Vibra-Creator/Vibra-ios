import { useState, useEffect, useCallback } from "react";
import { X, Shield } from "lucide-react";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";
import { useLanguage } from "@/i18n/LanguageContext";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const { t } = useLanguage();

  const dismiss = useCallback(() => {
    if (fadeOut || showCopyright) return;
    setFadeOut(true);
    setTimeout(onComplete, 600);
  }, [onComplete, fadeOut, showCopyright]);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 50);
    const t1 = setTimeout(() => setPhase(2), 600);
    const t2 = setTimeout(() => setPhase(3), 1200);
    const t3 = setTimeout(() => {
      if (!showCopyright) dismiss();
    }, 3000);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [dismiss, showCopyright]);

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
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, rgba(139, 92, 246, 0.25) 0%, rgba(168, 85, 247, 0.08) 40%, transparent 70%)",
        opacity: phase >= 1 ? 1 : 0,
        transition: "opacity 0.8s ease-in",
        zIndex: 1,
      }} />

      <img
        src={vibraLogo}
        alt="Vibra"
        style={{
          width: "180px",
          height: "180px",
          objectFit: "contain",
          borderRadius: "50%",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "scale(1)" : "scale(0.5)",
          transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter: phase >= 2
            ? "drop-shadow(0 0 25px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 50px rgba(168, 85, 247, 0.3))"
            : "drop-shadow(0 0 10px rgba(139, 92, 246, 0.2))",
          position: "relative",
          zIndex: 3,
        }}
      />

      <p style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: "1.1rem",
        fontWeight: 600,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        background: phase >= 3
          ? "linear-gradient(90deg, #c084fc, #f472b6, #67e8f9, #c084fc)"
          : "transparent",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: phase >= 3 ? "transparent" : "rgba(192, 132, 252, 0)",
        animation: phase >= 3 ? "splash-text-shimmer 3s linear infinite" : "none",
        opacity: phase >= 2 ? 1 : 0,
        transform: phase >= 2 ? "translateY(0)" : "translateY(10px)",
        transition: "all 0.6s ease-out",
        position: "relative",
        zIndex: 3,
        marginTop: "16px",
      }}>
        {t("splash.tagline")}
      </p>

      <button
        data-testid="button-copyright"
        onClick={(e) => {
          e.stopPropagation();
          setShowCopyright(true);
        }}
        style={{
          position: "absolute",
          bottom: "32px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 16px",
          borderRadius: "20px",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          background: "rgba(10, 1, 24, 0.6)",
          backdropFilter: "blur(8px)",
          color: "rgba(192, 132, 252, 0.8)",
          fontSize: "0.75rem",
          fontFamily: "'Space Grotesk', sans-serif",
          letterSpacing: "0.05em",
          cursor: "pointer",
          opacity: phase >= 3 ? 1 : 0,
          transition: "opacity 0.4s ease, border-color 0.3s ease",
        }}
      >
        <Shield style={{ width: 14, height: 14 }} />
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
