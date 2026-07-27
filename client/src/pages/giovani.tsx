import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

interface Resource {
  label: string;
  desc: string;
  href: string;
  external?: boolean;
}

interface Category {
  emoji: string;
  title: string;
  color: string;
  border: string;
  bg: string;
  items: Resource[];
}

const CATEGORIES: Category[] = [
  {
    emoji: "🌍",
    title: "Opportunità & Futuro",
    color: "from-amber-500 to-orange-500",
    border: "border-amber-500/30",
    bg: "bg-amber-500/8",
    items: [
      { label: "Erasmus+ Giovani", desc: "Viaggia e studia all'estero", href: "https://www.erasmusplus.it", external: true },
      { label: "Garanzia Giovani", desc: "Tirocini e lavoro per under 30", href: "https://www.garanziagiovani.gov.it", external: true },
    ],
  },
  {
    emoji: "💻",
    title: "Lavoro Digitale",
    color: "from-blue-500 to-cyan-500",
    border: "border-blue-500/30",
    bg: "bg-blue-500/8",
    items: [
      { label: "Competenze Digitali", desc: "Corsi tech gratuiti", href: "https://learndigital.withgoogle.com/digitaltraining", external: true },
      { label: "GitHub Student Pack", desc: "Tool per chi programma", href: "https://education.github.com/pack", external: true },
    ],
  },
  {
    emoji: "🎨",
    title: "Creatività & Contenuti",
    color: "from-pink-500 to-rose-500",
    border: "border-pink-500/30",
    bg: "bg-pink-500/8",
    items: [
      { label: "Canva per studenti", desc: "Grafica facile e veloce", href: "https://www.canva.com/education", external: true },
      { label: "Soundtrap Online", desc: "Crea musica e podcast", href: "https://www.soundtrap.com", external: true },
    ],
  },
  {
    emoji: "🚀",
    title: "Startup & Innovazione",
    color: "from-purple-500 to-violet-500",
    border: "border-purple-500/30",
    bg: "bg-purple-500/8",
    items: [
      { label: "Call per Startup", desc: "Bandi e acceleratori", href: "https://www.mimit.gov.it/it/impresa/competitivita-e-nuove-imprese/startup-e-pmi-innovative", external: true },
      { label: "Giovani Imprenditori", desc: "Mentorship e corsi", href: "https://www.giovanimprenditori.org", external: true },
    ],
  },
  {
    emoji: "❤️",
    title: "Benessere & Mindset",
    color: "from-red-500 to-pink-500",
    border: "border-red-500/30",
    bg: "bg-red-500/8",
    items: [
      { label: "TED Talks Motivazionali", desc: "Inspira e cambia prospettiva", href: "https://www.ted.com/topics/motivation", external: true },
      { label: "Supporto Psicologico", desc: "Aiuto online e gratuito", href: "https://www.azzurro.it", external: true },
    ],
  },
  {
    emoji: "🐷",
    title: "Soldi & Risparmio",
    color: "from-green-500 to-emerald-500",
    border: "border-green-500/30",
    bg: "bg-green-500/8",
    items: [
      { label: "Finanza Personale", desc: "Gestisci i tuoi soldi", href: "https://www.quellocheconta.gov.it", external: true },
      { label: "App per Budget", desc: "Strumenti per le spese", href: "https://www.money.it/finanza-personale", external: true },
    ],
  },
  {
    emoji: "✈️",
    title: "Viaggi & Esperienze",
    color: "from-sky-500 to-blue-500",
    border: "border-sky-500/30",
    bg: "bg-sky-500/8",
    items: [
      { label: "Interrail Pass", desc: "Scopri l'Europa low cost", href: "https://www.interrail.eu/it", external: true },
      { label: "Volontariato Estero", desc: "Parti e aiuta nel mondo", href: "https://www.europeansolidaritycorps.eu/it", external: true },
    ],
  },
  {
    emoji: "⭐",
    title: "Community & Trend",
    color: "from-fuchsia-500 to-purple-500",
    border: "border-fuchsia-500/30",
    bg: "bg-fuchsia-500/8",
    items: [
      { label: "Fiere & Mostre Tech", desc: "Festival e workshop", href: "https://www.eventbrite.it/d/italy/tech--events", external: true },
      { label: "Challenge Online", desc: "Concorsi e crea", href: "/challenges", external: false },
    ],
  },
];

function ResourceButton({ item }: { item: Resource }) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group cursor-pointer"
        data-testid={`link-giovani-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold text-sm leading-tight">{item.label}</span>
            <ExternalLink className="w-3 h-3 text-white/30 group-hover:text-white/60 flex-shrink-0 transition-colors" />
          </div>
          <p className="text-white/45 text-xs mt-0.5 leading-snug">{item.desc}</p>
        </div>
      </a>
    );
  }

  return (
    <Link href={item.href}>
      <div
        className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group cursor-pointer"
        data-testid={`link-giovani-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold text-sm leading-tight">{item.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 flex-shrink-0">Vibra</span>
          </div>
          <p className="text-white/45 text-xs mt-0.5 leading-snug">{item.desc}</p>
        </div>
      </div>
    </Link>
  );
}

export default function GiovaniPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0118]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-2 px-2" data-testid="button-giovani-back">
              <ArrowLeft className="w-4 h-4" />
              <img src={vibraLogo} alt="Vibra" className="w-6 h-6 rounded-full" style={{ mixBlendMode: "screen" }} />
              <span className="font-semibold text-white">Vibra</span>
            </Button>
          </Link>
          <div className="w-px h-5 bg-white/20" />
          <Sparkles className="w-4 h-4 text-fuchsia-400" />
          <span className="text-white/80 font-semibold text-sm">Sezione Giovani</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
        {/* Hero */}
        <div className="pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="text-sm font-medium text-fuchsia-300">Under 30 · Risorse gratuite</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">
            Sezione{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400">
              Giovani
            </span>
          </h1>
          <p className="text-white/50 text-base max-w-lg mx-auto">
            Opportunità, risorse e strumenti pensati per chi ha meno di 30 anni.
            Tutto in un posto solo.
          </p>
          <div className="flex items-center justify-center gap-4 mt-5 text-xs text-white/35">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Badge <span className="text-primary font-medium">Vibra</span> = funzione interna
            </span>
            <span className="flex items-center gap-1.5">
              <ExternalLink className="w-3 h-3" /> Link esterno = si apre nel browser
            </span>
          </div>
        </div>

        {/* Grid categorie */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-24">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.title}
              className={`rounded-2xl border ${cat.border} ${cat.bg} p-4`}
              data-testid={`section-giovani-${cat.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-base shadow-lg`}>
                  {cat.emoji}
                </div>
                <h2 className={`font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r ${cat.color}`}>
                  {cat.title}
                </h2>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {cat.items.map((item) => (
                  <ResourceButton key={item.label} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-sm text-white/35">
        <div className="flex items-center justify-center gap-2">
          <img src={vibraLogo} alt="Vibra" className="w-5 h-5 rounded-full" style={{ mixBlendMode: "screen" }} />
          <span>© 2026 Vibra · Sezione Giovani</span>
        </div>
      </footer>
    </div>
  );
}
