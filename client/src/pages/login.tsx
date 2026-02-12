import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield, Binoculars } from "lucide-react";
import { useGuest } from "@/hooks/use-guest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { enterGuestMode } = useGuest();

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
        throw new Error(data.message || "Credenziali non valide");
      }

      const userData = await res.json();
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
          <img src={vibraLogo} alt="Vibra" className="w-28 h-28 object-contain" data-testid="vibra-logo-login" />
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
