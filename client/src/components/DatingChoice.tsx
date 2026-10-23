import { useState } from "react";
import { useLocation } from "wouter";
import { Heart, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { queryClient } from "@/lib/queryClient";

/**
 * Bivio mostrato subito dopo la registrazione (e a chi non ha ancora un profilo):
 * completare il profilo per Vibra Dating oppure usare le altre sezioni.
 */
export function DatingChoice({ hasProfile }: { hasProfile: boolean }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);

  const chooseHub = async () => {
    let body: { age?: number } = {};
    if (!hasProfile) {
      const parsed = Number(age);
      if (!age.trim() || !Number.isInteger(parsed) || parsed < 18 || parsed > 120) {
        toast({ title: t("dating.ageInvalid"), variant: "destructive" });
        return;
      }
      body = { age: parsed };
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profiles/me/hub-choice", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || t("dating.choiceError"));
      queryClient.setQueryData(["/api/profiles/me"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      setLocation("/");
    } catch (err: any) {
      toast({ title: err?.message || t("dating.choiceError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4" style={{ background: "radial-gradient(circle at 30% 20%, #2a0f4a 0%, #0a0118 60%)" }} data-testid="dating-choice">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          {t("dating.choiceTitle")}
        </h1>
        <p className="text-white/80 text-base mb-6">{t("dating.choiceSubtitle")}</p>

        <div className="rounded-2xl p-5 mb-4 border border-pink-400/30 bg-white/5 backdrop-blur-md text-left">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-pink-400" />
            <span className="text-white font-semibold">Vibra Dating</span>
          </div>
          <p className="text-white/70 text-sm mb-4">{t("dating.choiceDatingDesc")}</p>
          <Button
            className="w-full"
            disabled={saving}
            onClick={() => setLocation("/profile/edit?dating=1")}
            data-testid="button-choice-dating"
          >
            {t("dating.choiceDatingBtn")}
          </Button>
        </div>

        <div className="rounded-2xl p-5 border border-cyan-400/30 bg-white/5 backdrop-blur-md text-left">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-semibold">Vibra Hub</span>
          </div>
          <p className="text-white/70 text-sm mb-4">{t("dating.choiceHubDesc")}</p>
          {!hasProfile && (
            <label className="block mb-3">
              <span className="text-white/80 text-xs font-semibold uppercase tracking-wide">{t("dating.ageLabel")}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={18}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1 bg-white/5 border-white/20 text-white"
                data-testid="input-choice-age"
              />
            </label>
          )}
          <Button
            variant="outline"
            className="w-full text-white border-white/30"
            disabled={saving}
            onClick={chooseHub}
            data-testid="button-choice-hub"
          >
            {t("dating.choiceHubBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}
