import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield, Binoculars, Heart, ShoppingBag, Navigation, Home, Briefcase, Share2 } from "lucide-react";
import { useGuest } from "@/hooks/use-guest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LoginVideoBackground } from "@/components/LoginVideoBackground";

export default function Login() {
  useEffect(() => {
    document.title = "Vibra - Accedi";
    const setMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(isProperty ? "property" : "name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const desc = "Accedi a Vibra per continuare a swipare, chattare e gestire il tuo profilo cosmico.";
    setMeta("description", desc);
    setMeta("og:title", "Vibra - Accedi", true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "Vibra - Accedi");
    setMeta("twitter:description", desc);
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { enterGuestMode } = useGuest();
  const { t } = useLanguage();

  const isAdminLogin = new URLSearchParams(window.location.search).get("admin") === "true";

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("login.invalidCredentials"));
      }

      const userData = await res.json();
      sessionStorage.removeItem("vibra-guest-mode");
      queryClient.setQueryData(["/api/auth/user"], userData.user || null);
      queryClient.removeQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.removeQueries({ queryKey: ["/api/profiles/swipable"] });

      if (isAdminLogin && userData.user?.isAdmin) {
        toast({
          title: t("login.welcomeAdmin"),
          description: t("login.welcomeAdminDesc"),
        });
        setLocation("/admin");
      } else if (isAdminLogin && !userData.user?.isAdmin) {
        toast({
          title: t("login.accessDenied"),
          description: t("login.accessDeniedDesc"),
          variant: "destructive",
        });
        setLocation("/");
      } else {
        toast({
          title: t("login.welcome"),
          description: t("login.welcomeDesc"),
        });
        setLocation("/");
      }
    } catch (error: any) {
      console.error("[LOGIN] Failed:", error.message, "| email:", email, "| pass length:", password.length);
      toast({
        title: t("common.error"),
        description: error.message || t("login.invalidCredentials"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-start p-6 overflow-y-auto" style={{ background: "#0a0118" }}>
      <LoginVideoBackground />
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white bg-black/30 backdrop-blur-sm"
          onClick={() => setLocation("/landing")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <LanguageSelector />
      </div>

      <div className="relative z-10 w-full max-w-md mt-8">
        <div className="flex flex-col items-center mb-4">
          {isAdminLogin ? (
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-400 font-medium">{t("login.adminTitle")}</p>
            </div>
          ) : (
            <>
              <p className="text-white/70 mt-1 text-lg font-semibold drop-shadow-lg">{t("login.subtitle")}</p>
              {/* Hub super-app strip */}
              <div className="mt-4 w-full text-center">
                <p className="text-white font-bold text-base mb-1">
                  {t("login.hubTagline")}
                </p>
                <p className="text-white/60 text-sm mb-3 italic">
                  {t("login.hubPiazza")}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { icon: Heart,       label: "Dating",      color: "bg-rose-500/20 border-rose-500/40 text-rose-300" },
                    { icon: Share2,      label: "Social",      color: "bg-pink-500/20 border-pink-500/40 text-pink-300" },
                    { icon: ShoppingBag, label: "Marketplace", color: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
                    { icon: Navigation,  label: "Mobilità",    color: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
                    { icon: Home,        label: "Casa",        color: "bg-teal-500/20 border-teal-500/40 text-teal-300" },
                    { icon: Briefcase,   label: "Lavoro",      color: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" },
                  ].map((chip) => (
                    <span key={chip.label} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${chip.color}`}>
                      <chip.icon className="w-3 h-3" />
                      {chip.label}
                    </span>
                  ))}
                </div>
                <p className="text-white/45 text-xs mt-3 leading-relaxed max-w-xs mx-auto">
                  {t("login.hubSubline")}
                </p>
              </div>
            </>
          )}
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">{t("login.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="la-tua@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">{t("login.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                    required
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-16 text-xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] hover:opacity-90 shadow-lg shadow-primary/30 rounded-xl"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? t("login.loading") : t("login.submitCta")}
              </Button>

              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-white/50 hover:text-primary hover:underline" data-testid="link-forgot-password">
                  {t("login.forgot")}
                </Link>
              </div>
            </form>

            <p className="text-center text-sm text-white/60">
              {t("login.noAccount")}{" "}
              <Link href="/register" className="text-primary hover:underline">
                {t("login.register")}
              </Link>
            </p>

            <div className="relative flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-xs text-white/40">{t("login.or")}</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            <Button
              variant="ghost"
              className="w-full text-white/70 border border-white/15"
              onClick={() => {
                enterGuestMode();
                setLocation("/");
                window.location.reload();
              }}
              data-testid="button-guest-explore-login"
            >
              <Binoculars className="w-4 h-4 mr-2" />
              {t("login.guest")}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-white/50">
          <p>
            {t("login.terms")}{" "}
            <Link href="/terms" className="text-primary hover:underline">
              {t("login.termsLink")}
            </Link>{" "}
            {t("login.and")}{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              {t("login.privacyLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
