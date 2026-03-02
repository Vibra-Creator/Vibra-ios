import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, User, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function ForgotPassword() {
  const [step, setStep] = useState<"verify" | "success">("verify");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non corrispondono",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Errore",
        description: "La password deve avere almeno 8 caratteri",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Errore durante il ripristino");
      }

      setStep("success");
      toast({
        title: "Password aggiornata!",
        description: "Ora puoi accedere con la nuova password",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-full flex flex-col items-center justify-center p-6 overflow-y-auto" style={{ background: "#0a0118" }}>
      <div className="fixed inset-0 z-0" style={{ background: "#0a0118" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
          src="/backgrounds/vibra-login-bg.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-20 text-white bg-black/30 backdrop-blur-sm"
        onClick={() => setLocation("/login")}
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
          <img src={vibraLogo} alt="Vibra" className="w-28 h-28 aspect-square object-cover rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-forgot" />
          <p className="text-white/70 mt-1">Recupera la tua password</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 space-y-6">
            {step === "verify" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-sm text-white/60 text-center">
                  Inserisci la tua email e i dati del tuo account per verificare la tua identita' e impostare una nuova password.
                </p>

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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-white/90">Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Il tuo nome"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                        required
                        data-testid="input-firstname"
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
                        placeholder="Il tuo cognome"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-lastname"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center gap-3 pt-2">
                  <div className="flex-1 h-px bg-white/20" />
                  <KeyRound className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">Nuova password</span>
                  <div className="flex-1 h-px bg-white/20" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white/90">Nuova Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Almeno 8 caratteri"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                      required
                      minLength={8}
                      data-testid="input-new-password"
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
                  <Label htmlFor="confirmPassword" className="text-white/90">Conferma Nuova Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ripeti la password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                      required
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? "Ripristino in corso..." : "Reimposta Password"}
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                  <KeyRound className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Password aggiornata!</h3>
                <p className="text-sm text-white/60">
                  La tua password e' stata reimpostata con successo. Ora puoi accedere con la nuova password.
                </p>
                <Button
                  className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  onClick={() => setLocation("/login")}
                  data-testid="button-go-to-login"
                >
                  Vai al Login
                </Button>
              </div>
            )}

            <p className="text-center text-sm text-white/60">
              Ricordi la password?{" "}
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
