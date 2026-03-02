import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield, Binoculars } from "lucide-react";
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

export default function Login() {
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
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

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
      <div className="fixed inset-0 z-0" style={{ background: "#0a0118" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-black/40" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-20 text-white bg-black/30 backdrop-blur-sm"
        onClick={() => setLocation("/landing")}
        data-testid="button-back"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>

      <div className="relative z-10 w-full max-w-md mt-4">
        <div className="flex flex-col items-center mb-4">
          <img src="/images/vibra-alien-hero.gif" alt="Vibra" className="w-32 h-32 object-contain rounded-full" style={{ filter: "drop-shadow(0 0 25px rgba(139, 92, 246, 0.7))" }} data-testid="vibra-alien-login" />
          {isAdminLogin ? (
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-400 font-medium">{t("login.adminTitle")}</p>
            </div>
          ) : (
            <p className="text-white/70 mt-1">{t("login.subtitle")}</p>
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
                className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? t("login.loading") : t("login.submit")}
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
