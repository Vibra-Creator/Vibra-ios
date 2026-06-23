import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Link non valido. Richiedi un nuovo link di verifica.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email verificata con successo!");
          // Invalidate auth cache so the gate disappears
          await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          setTimeout(() => setLocation("/"), 2500);
        } else {
          setStatus("error");
          setMessage(data.message || "Link non valido o scaduto.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Errore di rete. Riprova più tardi.");
      });
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0a0118 0%, #0f0a2e 50%, #0a0118 100%)" }}
    >
      <div className="w-full max-w-sm text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.2)", border: "2px solid rgba(139,92,246,0.4)" }}>
              <RefreshCw className="w-9 h-9 text-purple-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verifica in corso…</h1>
            <p className="text-white/50 text-sm">Attendi qualche secondo.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.2)", border: "2px solid rgba(34,197,94,0.4)" }}>
              <CheckCircle className="w-9 h-9 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Email confermata! ✨</h1>
            <p className="text-green-400/80 text-sm mb-4">{message}</p>
            <p className="text-white/40 text-xs">Reindirizzamento in corso…</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.2)", border: "2px solid rgba(239,68,68,0.4)" }}>
              <XCircle className="w-9 h-9 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Link non valido</h1>
            <p className="text-red-400/80 text-sm mb-6">{message}</p>
            <button
              onClick={() => setLocation("/")}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
            >
              Torna all'app
            </button>
          </>
        )}
      </div>
    </div>
  );
}
