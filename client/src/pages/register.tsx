import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft, UserPlus, CheckCircle, Sparkles, Calendar, Heart, ShoppingBag, Navigation, Home, Briefcase, Share2 } from "lucide-react";
import { LoginVideoBackground } from "@/components/LoginVideoBackground";
import { HubCategoryIntro } from "@/components/HubCategoryIntro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import vibraLogo from "@assets/Gemini_Generated_Image_adkxs1adkxs1adkx_1770480122018.png";

export default function Register() {
  useEffect(() => {
    document.title = "Vibra - Registrati";
    const setMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(isProperty ? "property" : "name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const desc = "Crea il tuo account Vibra Hub e scopri community, marketplace, mobilità e servizi. Il dating è facoltativo.";
    setMeta("description", desc);
    setMeta("og:title", "Vibra - Registrati", true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", "Vibra - Registrati");
    setMeta("twitter:description", desc);
  }, []);

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralName, setReferralName] = useState("");
  const [referralDiscount, setReferralDiscount] = useState<number>(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const validateReferralCode = async (code: string) => {
    if (!code || code.length < 4) { setReferralValid(null); return; }
    try {
      const res = await fetch(`/api/referral/validate/${encodeURIComponent(code)}`);
      const data = await res.json();
      setReferralValid(data.valid);
      setReferralName(data.referrerName || "");
      setReferralDiscount(data.discountPercent || 0);
    } catch { setReferralValid(null); setReferralDiscount(0); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: t("register.passwordMismatch"),
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: t("common.error"),
        description: t("register.mustAcceptTerms"),
        variant: "destructive",
      });
      return;
    }

    if (!confirmAge) {
      toast({
        title: t("common.error"),
        description: t("register.mustConfirmAge"),
        variant: "destructive",
      });
      return;
    }

    if (referralCode && referralValid === false) {
      toast({
        title: t("common.error"),
        description: t("register.referralInvalid"),
        variant: "destructive",
      });
      return;
    }

    if (!gender) {
      toast({
        title: t("common.error"),
        description: t("register.genderRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!age || Number(age) < 18 || Number(age) > 120) {
      toast({
        title: t("common.error"),
        description: t("register.ageRequired"),
        variant: "destructive",
      });
      return;
    }

    if (referralCode && referralValid === null) {
      toast({
        title: t("common.error"),
        description: t("register.referralChecking"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          lastName,
          gender,
          age: age ? Number(age) : undefined,
          termsAccepted: acceptTerms,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("register.createError"));
      }

      const userData = await res.json();
      sessionStorage.removeItem("vibra-guest-mode");
      if (referralCode && referralValid) {
        try {
          await fetch("/api/referral/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: referralCode }),
            credentials: "include",
          });
        } catch {}
      }
      queryClient.setQueryData(["/api/auth/user"], userData || null);
      queryClient.removeQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.removeQueries({ queryKey: ["/api/profiles/swipable"] });
      toast({
        title: t("register.welcomeTitle"),
        description: t("register.welcomeDesc"),
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("register.createError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col items-center p-6 py-16 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <LoginVideoBackground />
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-6">
          <img src={vibraLogo} alt="Vibra" className="w-28 h-28 aspect-square object-cover rounded-full" style={{ mixBlendMode: "screen" }} data-testid="vibra-logo-register" />
          <p className="text-white/70 mt-1">{t("register.subtitle")}</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-xl border-white/10">
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/90">{t("register.name")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="name"
                      type="text"
                      placeholder={t("register.name")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                      required
                      data-testid="input-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-white/90">{t("register.lastName")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="lastName"
                      type="text"
                      placeholder={t("register.lastName")}
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
                <Label htmlFor="email" className="text-white/90">{t("register.email")}</Label>
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
                  {t("register.emailHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/90">{t("register.password")}</Label>
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
                <Label htmlFor="confirmPassword" className="text-white/90">{t("register.confirmPassword")}</Label>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-white/90">{t("register.gender")}</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid="select-gender-register">
                      <SelectValue placeholder={t("register.genderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Uomo">{t("register.genderMale")}</SelectItem>
                      <SelectItem value="Donna">{t("register.genderFemale")}</SelectItem>
                      <SelectItem value="Non-binario">{t("register.genderNonBinary")}</SelectItem>
                      <SelectItem value="Altro">{t("register.genderOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-white/90">{t("register.age")}</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                    <Input
                      id="age"
                      type="number"
                      min={18}
                      max={120}
                      placeholder="18+"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60"
                      required
                      data-testid="input-age-register"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralCode" className="text-white/90">{t("register.referralCode")}</Label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    id="referralCode"
                    type="text"
                    placeholder={t("register.referralPlaceholder")}
                    value={referralCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setReferralCode(val);
                      validateReferralCode(val);
                    }}
                    className={`pl-10 h-12 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/60 uppercase ${referralValid === true ? 'border-green-400' : referralValid === false ? 'border-red-400' : ''}`}
                    data-testid="input-referral-code"
                  />
                </div>
                {referralValid === true && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-green-400 flex items-center gap-1" data-testid="text-referral-valid">
                      <CheckCircle className="w-3 h-3" /> {t("register.referralValid")} {referralName}
                    </p>
                    {referralDiscount > 0 && !isNaN(referralDiscount) && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2" data-testid="text-referral-discount">
                        <Sparkles className="w-4 h-4 text-green-400 shrink-0" />
                        <p className="text-xs text-green-300 font-medium">
                          {t("register.discountMessage").replace("{percent}", String(referralDiscount))}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {referralValid === false && referralCode.length >= 4 && (
                  <p className="text-xs text-red-400" data-testid="text-referral-invalid">{t("register.referralInvalid")}</p>
                )}
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="age"
                  checked={confirmAge}
                  onCheckedChange={(checked) => setConfirmAge(checked as boolean)}
                  data-testid="checkbox-age"
                />
                <label htmlFor="age" className="text-sm text-white/60 leading-tight">
                  {t("register.confirmAge")}
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
                  {t("legal.acceptIntro")}{" "}
                  <Link href="/terms" className="text-primary hover:underline">{t("login.termsLink")}</Link>{" "}
                  {t("login.and")}{" "}
                  <Link href="/privacy" className="text-primary hover:underline">{t("login.privacyLink")}</Link>.
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:opacity-90"
                disabled={isLoading || !acceptTerms || !confirmAge}
                data-testid="button-register"
              >
                {isLoading ? t("register.loading") : t("register.submit")}
              </Button>
            </form>

            <p className="text-center text-sm text-white/60">
              {t("register.haveAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("register.login")}
              </Link>
            </p>
          </CardContent>
        </Card>

        <HubCategoryIntro />
      </motion.div>
    </div>
  );
}
