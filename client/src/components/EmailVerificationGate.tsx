import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, RefreshCw, LogOut, CheckCircle } from "lucide-react";

interface EmailVerificationGateProps {
  email: string;
  onLogout: () => void;
}

export function EmailVerificationGate({ email, onLogout }: EmailVerificationGateProps) {
  const { toast } = useToast();
  const [resent, setResent] = useState(false);

  const resendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/resend-verification"),
    onSuccess: () => {
      setResent(true);
      toast({ title: "Email inviata!", description: "Controlla la tua casella di posta." });
    },
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile inviare l'email. Riprova.", variant: "destructive" });
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0a0118 0%, #0f0a2e 50%, #0a0118 100%)" }}
    >
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.2,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(99,102,241,0.3))", border: "2px solid rgba(139,92,246,0.5)" }}>
          <Mail className="w-9 h-9 text-purple-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Conferma la tua email
        </h1>
        <p className="text-purple-200/70 text-sm mb-2">
          Abbiamo inviato un link di verifica a
        </p>
        <p className="text-cyan-400 font-semibold text-sm mb-6 break-all">
          {email}
        </p>

        <div className="rounded-xl p-4 mb-6 text-left"
          style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>
          <p className="text-white/80 text-sm leading-relaxed">
            Apri la mail e clicca su <strong className="text-purple-300">Conferma Email</strong> per attivare il tuo account e accedere a Vibra.
          </p>
        </div>

        {resent ? (
          <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-4">
            <CheckCircle className="w-4 h-4" />
            Email inviata! Controlla anche la cartella spam.
          </div>
        ) : (
          <button
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white mb-3 transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
            data-testid="button-resend-verification"
          >
            {resendMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {resendMutation.isPending ? "Invio in corso…" : "Rinvia email"}
          </button>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-white/50 hover:text-white/80 transition-colors"
          data-testid="button-logout-verification"
        >
          <LogOut className="w-4 h-4" />
          Esci e usa un altro account
        </button>
      </div>
    </div>
  );
}
