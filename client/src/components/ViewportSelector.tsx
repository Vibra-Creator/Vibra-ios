import { useState, useEffect, type ReactNode } from "react";
import { Smartphone, Tablet, Monitor } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type ViewMode = "mobile" | "tablet" | "desktop";

function useViewModes() {
  const { t } = useLanguage();
  return [
    { id: "mobile" as ViewMode, label: t("viewport.mobile"), icon: Smartphone, width: 390 },
    { id: "tablet" as ViewMode, label: t("viewport.tablet"), icon: Tablet, width: 768 },
    { id: "desktop" as ViewMode, label: t("viewport.desktop"), icon: Monitor, width: 0 },
  ];
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isDesktop;
}

export function ViewportSelector({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  const viewModes = useViewModes();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      try {
        return (localStorage.getItem("vibra-view-mode") as ViewMode) || "mobile";
      } catch {
        return "mobile";
      }
    }
    return "desktop";
  });

  useEffect(() => {
    if (isDesktop) {
      try {
        localStorage.setItem("vibra-view-mode", viewMode);
      } catch {
        // The selected view mode remains active for this session.
      }
    }
  }, [viewMode, isDesktop]);

  if (!isDesktop) {
    return <>{children}</>;
  }

  const activeMode = viewModes.find((m) => m.id === viewMode)!;

  return (
    <div className="h-screen w-screen flex flex-col items-center bg-[#060012] overflow-hidden">
      <div className="w-full flex items-center justify-center gap-1 py-2 px-4 bg-black/60 backdrop-blur-sm border-b border-white/10 shrink-0 z-50">
        {viewModes.map((mode) => {
          const isActive = viewMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary/80 text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
              data-testid={`button-view-${mode.id}`}
            >
              <mode.icon className="w-3.5 h-3.5" />
              {mode.label}
            </button>
          );
        })}
      </div>

      {viewMode === "desktop" ? (
        <div className="flex-1 w-full overflow-hidden">
          {children}
        </div>
      ) : (
        <div className="flex-1 flex items-start justify-center overflow-hidden py-4">
          <div
            className="relative overflow-hidden bg-black"
            style={{
              width: activeMode.width,
              height: viewMode === "mobile" ? "calc(100vh - 80px)" : "calc(100vh - 80px)",
              maxHeight: viewMode === "mobile" ? 844 : 1024,
              borderRadius: viewMode === "mobile" ? 40 : 20,
              border: "3px solid rgba(255,255,255,0.15)",
              boxShadow: "0 0 60px rgba(139, 92, 246, 0.15), 0 0 120px rgba(139, 92, 246, 0.05)",
            }}
          >
            {viewMode === "mobile" && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-[60]" />
            )}
            <div className="w-full h-full overflow-hidden" style={{ borderRadius: viewMode === "mobile" ? 37 : 17 }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
