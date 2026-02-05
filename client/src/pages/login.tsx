import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      localStorage.setItem("vibra_user_id", "user-1");
      localStorage.setItem("vibra_user_email", email);
      toast({
        title: "Benvenuto!",
        description: "Accesso effettuato con successo",
      });
      setLocation("/");
    } catch (error) {
      toast({
        title: "Errore",
        description: "Credenziali non valide",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    toast({
      title: "Google Login",
      description: "Funzionalità in arrivo presto!",
    });
  };

  const handleAppleLogin = () => {
    toast({
      title: "Apple Login",
      description: "Funzionalità in arrivo presto!",
    });
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6">
      <div className="fixed inset-0 -z-10">
        <img src="/backgrounds/vibra-couple-rose.png" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600 flex items-center justify-center mb-4"
               style={{ boxShadow: "0 0 30px rgba(139, 92, 246, 0.5)" }}>
            <Heart className="w-10 h-10 text-pink-300" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Vibra
          </h1>
          <p className="text-white/70 mt-2">Accedi al tuo account</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 text-base bg-white/10 border-white/20 text-white"
                onClick={handleGoogleLogin}
                data-testid="button-google-login"
              >
                <SiGoogle className="w-5 h-5 mr-3" />
                Continua con Google
              </Button>

              <Button
                variant="outline"
                className="w-full h-12 text-base bg-white/10 border-white/20 text-white"
                onClick={handleAppleLogin}
                data-testid="button-apple-login"
              >
                <SiApple className="w-5 h-5 mr-3" />
                Continua con Apple
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-black/40 px-2 text-white/60">
                  oppure
                </span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="la-tua@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
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

            <div className="text-center space-y-2">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Password dimenticata?
              </Link>
              <p className="text-sm text-white/60">
                Non hai un account?{" "}
                <Link href="/register" className="text-primary hover:underline">
                  Registrati
                </Link>
              </p>
            </div>
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
