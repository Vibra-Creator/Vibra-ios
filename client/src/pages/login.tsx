import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield, Binoculars } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { useGuest } from "@/hooks/use-guest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

declare global {
  interface Window {
    google?: any;
    AppleID?: any;
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { enterGuestMode } = useGuest();

  const isAdminLogin = new URLSearchParams(window.location.search).get("admin") === "true";

  const handleSocialSuccess = useCallback(async (provider: string, data: any) => {
    setIsSocialLoading(provider);
    try {
      const endpoint = provider === "google" ? "/api/auth/google" : "/api/auth/apple";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Autenticazione ${provider} fallita`);
      }

      sessionStorage.removeItem("vibra-guest-mode");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Benvenuto!", description: "Accesso effettuato con successo" });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsSocialLoading("");
    }
  }, [toast, setLocation]);

  const [socialConfig, setSocialConfig] = useState<{ googleClientId: string | null; appleClientId: string | null; appleRedirectUri: string | null }>({ googleClientId: null, appleClientId: null, appleRedirectUri: null });
  const [googleInitialized, setGoogleInitialized] = useState(false);

  useEffect(() => {
    fetch("/api/auth/social-config").then(r => r.json()).then(setSocialConfig).catch(() => {});
  }, []);

  useEffect(() => {
    if (socialConfig.googleClientId && window.google?.accounts && !googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: socialConfig.googleClientId,
        callback: (response: any) => {
          handleSocialSuccess("google", { credential: response.credential });
        },
      });
      setGoogleInitialized(true);
    }
  }, [socialConfig.googleClientId, handleSocialSuccess, googleInitialized]);

  useEffect(() => {
    if (socialConfig.appleClientId && window.AppleID) {
      window.AppleID.auth.init({
        clientId: socialConfig.appleClientId,
        scope: "name email",
        redirectURI: socialConfig.appleRedirectUri || window.location.origin,
        usePopup: true,
      });
    }
  }, [socialConfig.appleClientId, socialConfig.appleRedirectUri]);

  const handleGoogleLogin = () => {
    if (!socialConfig.googleClientId) {
      toast({ title: "Non disponibile", description: "Google Sign-In non è ancora configurato", variant: "destructive" });
      return;
    }
    if (window.google?.accounts) {
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          window.google.accounts.id.renderButton(
            document.createElement("div"),
            { theme: "outline", size: "large" }
          );
          const btn = document.querySelector('[data-testid="button-login-google"]');
          if (btn) (btn as HTMLElement).click();
        }
      });
    }
  };

  const handleAppleLogin = async () => {
    if (!socialConfig.appleClientId || !window.AppleID) {
      toast({ title: "Non disponibile", description: "Apple Sign-In non è ancora configurato", variant: "destructive" });
      return;
    }
    try {
      const response = await window.AppleID.auth.signIn();
      if (response.authorization) {
        handleSocialSuccess("apple", {
          id_token: response.authorization.id_token,
          user: response.user || null,
        });
      }
    } catch (error: any) {
      if (error.error !== "popup_closed_by_user") {
        toast({ title: "Errore", description: "Impossibile avviare il login Apple", variant: "destructive" });
      }
    }
  };

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
        throw new Error(data.message || "Credenziali non valide");
      }

      const userData = await res.json();
      sessionStorage.removeItem("vibra-guest-mode");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      if (isAdminLogin && userData.user?.isAdmin) {
        toast({
          title: "Benvenuto Admin!",
          description: "Accesso alla dashboard di controllo",
        });
        setLocation("/admin");
      } else if (isAdminLogin && !userData.user?.isAdmin) {
        toast({
          title: "Accesso negato",
          description: "Questo account non ha i permessi di amministratore.",
          variant: "destructive",
        });
        setLocation("/");
      } else {
        toast({
          title: "Benvenuto!",
          description: "Accesso effettuato con successo",
        });
        setLocation("/");
      }
    } catch (error: any) {
      console.error("[LOGIN] Failed:", error.message, "| email:", email, "| pass length:", password.length);
      toast({
        title: "Errore",
        description: error.message || "Credenziali non valide",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <img src="/images/vibra-alien-hero.gif" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-6">
          <img src={vibraLogo} alt="Vibra" className="w-28 h-28 aspect-square object-cover rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-login" />
          {isAdminLogin ? (
            <div className="flex items-center gap-2 mt-1">
              <Shield className="w-4 h-4 text-yellow-400" />
              <p className="text-yellow-400 font-medium">Accesso Amministratore</p>
            </div>
          ) : (
            <p className="text-white/70 mt-1">Accedi al tuo account</p>
          )}
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">Email</Label>
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
                <Label htmlFor="password" className="text-white/90">Password</Label>
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
                {isLoading ? "Accesso in corso..." : "Accedi"}
              </Button>
            </form>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-xs text-white/40">oppure accedi con</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 bg-white text-black border-white/20 hover:bg-white/90"
                onClick={handleGoogleLogin}
                disabled={isSocialLoading === "google"}
                data-testid="button-login-google"
              >
                <SiGoogle className="w-5 h-5 mr-3" />
                {isSocialLoading === "google" ? "Accesso in corso..." : "Continua con Google"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 bg-black text-white border-white/20 hover:bg-black/80"
                onClick={handleAppleLogin}
                disabled={isSocialLoading === "apple"}
                data-testid="button-login-apple"
              >
                <SiApple className="w-5 h-5 mr-3" />
                {isSocialLoading === "apple" ? "Accesso in corso..." : "Continua con Apple"}
              </Button>
            </div>

            <p className="text-center text-sm text-white/60">
              Non hai un account?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Registrati
              </Link>
            </p>

            <div className="relative flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-xs text-white/40">oppure</span>
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
              Esplora senza registrarti
            </Button>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-white/50">
          <p>
            Continuando accetti i nostri{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Termini di Servizio
            </Link>{" "}
            e la{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
