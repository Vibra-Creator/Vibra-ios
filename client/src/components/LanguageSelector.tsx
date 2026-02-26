import { useLanguage } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";

const flags: Record<Lang, { emoji: string; label: string }> = {
  it: { emoji: "🇮🇹", label: "Italiano" },
  en: { emoji: "🇬🇧", label: "English" },
  es: { emoji: "🇪🇸", label: "Español" },
};

export function LanguageSelector({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`flex items-center gap-1 ${className}`} data-testid="language-selector">
      {(Object.keys(flags) as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`text-xl px-1.5 py-1 rounded-md transition-all ${
            lang === l
              ? "bg-white/20 scale-110 ring-1 ring-white/30"
              : "opacity-60 hover:opacity-100 hover:bg-white/10"
          }`}
          title={flags[l].label}
          data-testid={`button-lang-${l}`}
        >
          {flags[l].emoji}
        </button>
      ))}
    </div>
  );
}
