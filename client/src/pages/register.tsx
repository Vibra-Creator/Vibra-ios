import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function Register() {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSocialLoading, setIsSocialLoading] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
        throw new Error(err.message || `Registrazione con ${provider} fallita`);
      }

      sessionStorage.removeItem("vibra-guest-mode");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Benvenuto su Vibra!", description: "Account creato con successo" });
      setLocation("/onboarding");
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

  const handleGoogleRegister = () => {
    if (!socialConfig.googleClientId) {
      toast({ title: "Non disponibile", description: "Google Sign-In non è ancora configurato", variant: "destructive" });
      return;
    }
    if (window.google?.accounts) {
      window.google.accounts.id.prompt();
    }
  };

  const handleAppleRegister = async () => {
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
        toast({ title: "Errore", description: "Impossibile avviare la registrazione Apple", variant: "destructive" });
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non corrispondono",
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Errore",
        description: "Devi accettare i termini di servizio",
        variant: "destructive",
      });
      return;
    }

    if (!confirmAge) {
      toast({
        title: "Errore",
        description: "Devi confermare di avere almeno 18 anni",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, lastName }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Impossibile creare l'account");
      }

      sessionStorage.removeItem("vibra-guest-mode");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Benvenuto su Vibra!",
        description: "Account creato con successo",
      });
      setLocation("/onboarding");
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare l'account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col items-center p-6 py-16 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="fixed inset-0 z-0">
        <img src="/images/vibra-alien-hero.gif" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/15 to-black/25" />
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
          <img src={vibraLogo} alt="Vibra" className="w-28 h-28 aspect-square object-cover rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-register" />
          <p className="text-white/70 mt-1">Crea il tuo account</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/90">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                      required
                      data-testid="input-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-white/90">Cognome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Cognome"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                      required
                      data-testid="input-lastname"
                    />
                  </div>
                </div>
              </div>

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
                <p className="text-xs text-amber-300/90 flex items-center gap-1" data-testid="text-email-privacy">
                  <Lock className="w-3 h-3 shrink-0" />
                  La tua email non sara' visibile nel profilo. Viene usata solo per accesso e recupero account.
                </p>
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
                    minLength={8}
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white/90">Conferma Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="age"
                  checked={confirmAge}
                  onCheckedChange={(checked) => setConfirmAge(checked as boolean)}
                  data-testid="checkbox-age"
                />
                <label htmlFor="age" className="text-sm text-white/60 leading-tight">
                  Confermo di avere almeno 18 anni
                </label>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm text-white/60 leading-tight">
                  Accetto i{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Termini di Servizio
                  </Link>{" "}
                  e la{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
                disabled={isLoading || !acceptTerms || !confirmAge}
                data-testid="button-register"
              >
                {isLoading ? "Creazione account..." : "Crea Account"}
              </Button>
            </form>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-xs text-white/40">oppure registrati con</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            <div className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 bg-white text-black border-white/20 hover:bg-white/90"
                onClick={handleGoogleRegister}
                disabled={isSocialLoading === "google"}
                data-testid="button-register-google"
              >
                <SiGoogle className="w-5 h-5 mr-3" />
                {isSocialLoading === "google" ? "Registrazione..." : "Continua con Google"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 bg-black text-white border-white/20 hover:bg-black/80"
                onClick={handleAppleRegister}
                disabled={isSocialLoading === "apple"}
                data-testid="button-register-apple"
              >
                <SiApple className="w-5 h-5 mr-3" />
                {isSocialLoading === "apple" ? "Registrazione..." : "Continua con Apple"}
              </Button>
            </div>

            <p className="text-center text-sm text-white/60">
              Hai già un account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Accedi
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
