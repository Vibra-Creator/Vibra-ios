import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { SiGoogle, SiApple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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

    setIsLoading(true);

    try {
      localStorage.setItem("vibra_user_id", "user-1");
      localStorage.setItem("vibra_user_email", email);
      localStorage.setItem("vibra_user_name", name);
      toast({
        title: "Benvenuto su Vibra!",
        description: "Account creato con successo",
      });
      setLocation("/profile/edit");
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'account",
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background via-background to-card">
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
          <p className="text-muted-foreground mt-2">Crea il tuo account</p>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 text-base"
                onClick={handleGoogleLogin}
                data-testid="button-google-register"
              >
                <SiGoogle className="w-5 h-5 mr-3" />
                Registrati con Google
              </Button>

              <Button
                variant="outline"
                className="w-full h-12 text-base"
                onClick={handleAppleLogin}
                data-testid="button-apple-register"
              >
                <SiApple className="w-5 h-5 mr-3" />
                Registrati con Apple
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  oppure
                </span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Il tuo nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12"
                    required
                    data-testid="input-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="la-tua@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    required
                    minLength={8}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12"
                    required
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
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
                disabled={isLoading || !acceptTerms}
                data-testid="button-register"
              >
                {isLoading ? "Creazione account..." : "Crea Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
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
