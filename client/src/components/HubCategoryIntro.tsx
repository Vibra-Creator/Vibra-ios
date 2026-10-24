import { BriefcaseBusiness, Heart, Home, MapPinned, Music2, Share2, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const categories = [
  { icon: Share2, key: "social" },
  { icon: ShoppingBag, key: "marketplace" },
  { icon: MapPinned, key: "mobility" },
  { icon: Home, key: "home" },
  { icon: BriefcaseBusiness, key: "work" },
  { icon: Music2, key: "media" },
  { icon: Heart, key: "dating" },
] as const;

export function HubCategoryIntro() {
  const { t } = useLanguage();

  return (
    <section
      aria-label={t("hubIntro.title")}
      className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-md"
      data-testid="hub-category-intro"
    >
      <h2 className="text-center text-sm font-bold text-white">
        {t("hubIntro.title")}
      </h2>
      <p className="mt-1 text-center text-xs text-white/60">
        {t("hubIntro.subtitle")}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categories.map(({ icon: Icon, key }) => (
          <div
            key={key}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
          >
            <div className="mb-1.5 flex items-center gap-1.5 text-white/90">
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <h3 className="text-xs font-semibold">{t(`hubIntro.${key}.title`)}</h3>
            </div>
            <p className="text-[11px] leading-relaxed text-white/60">
              {t(`hubIntro.${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
