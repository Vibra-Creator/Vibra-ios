import { useState, useEffect, useCallback } from "react";
import { X, Shield } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [showCopyright, setShowCopyright] = useState(false);
  const [activeFlash, setActiveFlash] = useState(-1);
  const { t } = useLanguage();

  const flashPhrases = [
    { text: t("splash.flash1"), color: "#f472b6", glow: "rgba(244, 114, 182, 0.6)" },
    { text: t("splash.flash2"), color: "#67e8f9", glow: "rgba(103, 232, 249, 0.6)" },
    { text: t("splash.flash3"), color: "#c084fc", glow: "rgba(192, 132, 252, 0.6)" },
    { text: t("splash.flash4"), color: "#fb923c", glow: "rgba(251, 146, 60, 0.6)" },
    { text: t("splash.flash5"), color: "#34d399", glow: "rgba(52, 211, 153, 0.6)" },
    { text: t("splash.flash6"), color: "#f9a8d4", glow: "rgba(249, 168, 212, 0.6)" },
  ];

  const dismiss = useCallback(() => {
    if (fadeOut || showCopyright) return;
    setFadeOut(true);
    setTimeout(onComplete, 600);
  }, [onComplete, fadeOut, showCopyright]);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 50);
    const t1 = setTimeout(() => setPhase(2), 600);
    const t2 = setTimeout(() => setPhase(3), 1200);

    const flashStart = 1600;
    const flashDuration = 700;
    const flashTimers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < flashPhrases.length; i++) {
      flashTimers.push(setTimeout(() => setActiveFlash(i), flashStart + i * flashDuration));
    }

    const t3 = setTimeout(() => {
      if (!showCopyright) dismiss();
    }, flashStart + flashPhrases.length * flashDuration + 800);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      flashTimers.forEach(clearTimeout);
    };
  }, [dismiss, showCopyright]);

  const flashPositions = [
    { top: "12%", left: "50%", transform: "translateX(-50%)" },
    { top: "20%", left: "50%", transform: "translateX(-50%)" },
    { bottom: "32%", left: "50%", transform: "translateX(-50%)" },
    { bottom: "24%", left: "50%", transform: "translateX(-50%)" },
    { bottom: "16%", left: "50%", transform: "translateX(-50%)" },
    { bottom: "8%", left: "50%", transform: "translateX(-50%)" },
  ];

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

      {flashPhrases.map((phrase, i) => {
        const isActive = activeFlash >= i;
        const isCurrent = activeFlash === i;
        const pos = flashPositions[i];
        return (
          <div
            key={i}
            data-testid={`splash-flash-${i}`}
            style={{
              position: "absolute",
              ...pos,
              zIndex: 5,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: isCurrent ? "1.3rem" : "1.05rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: phrase.color,
              textShadow: isActive
                ? `0 0 20px ${phrase.glow}, 0 0 40px ${phrase.glow}, 0 0 60px ${phrase.glow}`
                : "none",
              opacity: isActive ? (isCurrent ? 1 : 0.5) : 0,
              transform: `${pos.transform || ""} scale(${isCurrent ? 1.05 : isActive ? 0.95 : 0.7})`,
              transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {isCurrent && (
              <span style={{
                position: "absolute",
                inset: "-8px -16px",
                background: `radial-gradient(ellipse, ${phrase.glow.replace("0.6", "0.15")} 0%, transparent 70%)`,
                borderRadius: "20px",
                zIndex: -1,
              }} />
            )}
            {phrase.text}
          </div>
        );
      })}

      <img
        src="/vibra-logo.png"
        alt="Vibra"
        data-testid="splash-vibra-logo"
        style={{
          width: "180px",
          height: "180px",
          objectFit: "contain",
          borderRadius: "50%",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "scale(1)" : "scale(0.5)",
          transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
          filter: phase >= 2
            ? "drop-shadow(0 0 30px rgba(139, 92, 246, 0.7)) drop-shadow(0 0 60px rgba(168, 85, 247, 0.4))"
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
        backgroundImage: phase >= 3
          ? "linear-gradient(90deg, #c084fc, #f472b6, #67e8f9, #c084fc)"
          : "none",
        backgroundColor: phase >= 3 ? "transparent" : "transparent",
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
