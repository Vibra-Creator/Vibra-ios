import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function Blog() {
  const [loaded, setLoaded] = useState(false);
  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Blog — Vibra";

    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let el = document.querySelector(`${selector}[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("meta", "name", "description", "Storie, aggiornamenti e notizie dalla community Vibra.");
    setMeta("meta", "property", "og:title", "Blog — Vibra");

    if (document.getElementById("soro-script")) return;

    // Carica Soro solo quando il container è visibile (lazy loading)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !document.getElementById("soro-script")) {
            const script = document.createElement("script");
            script.id = "soro-script";
            script.src = "https://app.trysoro.com/api/embed/c57a92ce-e12a-4780-9def-e1f4f0e44465";
            script.defer = true;
            script.onload = () => setLoaded(true);
            document.body.appendChild(script);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "200px" }
    );

    if (embedRef.current) observer.observe(embedRef.current);

    return () => {
      observer.disconnect();
      const existing = document.getElementById("soro-script");
      if (existing) existing.remove();
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0118] dark">
      {/* Soro blog dark-mode override */}
      <style>{`
        #soro-blog,
        #soro-blog *,
        #soro-blog > div,
        #soro-blog iframe,
        #soro-blog article,
        #soro-blog section,
        #soro-blog main,
        #soro-blog header,
        #soro-blog footer,
        #soro-blog nav,
        #soro-blog aside {
          background-color: transparent !important;
          background: transparent !important;
          color: #e2e8f0 !important;
        }
        #soro-blog h1, #soro-blog h2, #soro-blog h3,
        #soro-blog h4, #soro-blog h5, #soro-blog h6,
        #soro-blog p, #soro-blog span, #soro-blog a,
        #soro-blog li, #soro-blog strong, #soro-blog em,
        #soro-blog label, #soro-blog small, #soro-blog time,
        #soro-blog figcaption, #soro-blog blockquote,
        #soro-blog td, #soro-blog th, #soro-blog div {
          color: #e2e8f0 !important;
        }
        #soro-blog a { color: #c084fc !important; text-decoration: underline !important; }
        #soro-blog a:hover { color: #e879f9 !important; }
        #soro-blog img, #soro-blog figure, #soro-blog video {
          border-radius: 12px !important;
          background: transparent !important;
        }
        #soro-blog button, #soro-blog input, #soro-blog textarea,
        #soro-blog select {
          background: rgba(255,255,255,0.08) !important;
          color: #e2e8f0 !important;
          border-color: rgba(255,255,255,0.15) !important;
        }
      `}</style>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-2 px-2" data-testid="button-blog-back">
              <ArrowLeft className="w-4 h-4" />
              <img src={vibraLogo} alt="Vibra" className="w-6 h-6 rounded-full" style={{ mixBlendMode: "screen" }} />
              <span className="font-semibold text-white">Vibra</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2 ml-2">
            <div className="w-px h-5 bg-white/20" />
            <Rss className="w-4 h-4 text-primary" />
            <span className="text-white/80 font-medium text-sm">Blog</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 mb-5">
          <Rss className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-medium text-primary/90">Aggiornamenti & Storie</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">
          Blog di <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Vibra</span>
        </h1>
        <p className="text-white/55 text-lg max-w-xl mx-auto">
          Notizie dalla community, consigli, storie vere e aggiornamenti sull'app.
        </p>
      </motion.div>

      {/* Soro Blog Embed */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="max-w-4xl mx-auto px-4 pb-20"
      >
        <div
          id="soro-blog"
          className="min-h-[400px]"
          data-testid="soro-blog-embed"
        />
      </motion.div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-sm text-white/40">
        <div className="flex items-center justify-center gap-2">
          <img src={vibraLogo} alt="Vibra" className="w-5 h-5 rounded-full" style={{ mixBlendMode: "screen" }} />
          <span>© 2026 Vibra. Tutti i diritti riservati.</span>
        </div>
      </footer>
    </div>
  );
}
