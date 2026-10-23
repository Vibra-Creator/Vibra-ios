import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Sparkles, MapPin, User, Heart, ArrowLeft, ArrowRight, Save, Ruler, Languages, Star, Search, Check, CheckCircle, Phone, ImagePlus, X, Loader2, UserCircle, Eye, Compass, Video } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";
import {
  genderOptions,
  preferredGenderOptions,
  hairColorOptions,
  eyeColorOptions,
  bodyTypeOptions,
  educationOptions,
  preferredEducationOptions,
  relationshipTypeOptions,
  wantsChildrenOptions,
  zodiacSignOptions,
  loveLanguageOptions,
  communicationStyleOptions,
  lifestyleOptions,
  accessMotivationOptions,
  languageOptions,
  alienTypes,
  interestsList,
  availableImages,
  slugify,
  italianCities,
  worldCities,
  phonePrefixes,
} from "@/lib/profile-options";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Profile } from "@shared/schema";

const TOTAL_STEPS = 7;


const optionalNumField = z.union([z.literal(""), z.coerce.number()]).optional();

function createProfileFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("profileEdit.validationNameMin")),
    age: z.coerce.number().min(18, t("profileEdit.validationAgeMin")).max(120, t("profileEdit.validationAgeMax")),
    bio: z.string().max(500, t("profileEdit.validationBioMax")).optional().or(z.literal("")),
    location: z.string().optional().or(z.literal("")),
    alienType: z.string().min(1, t("profileEdit.selectType")),
    imageUrl: z.string().min(1, t("profileEdit.selectImage")),
    gender: z.string().optional(),
    preferredGender: z.string().optional(),
    hairColor: z.string().optional(),
    eyeColor: z.string().optional(),
    bodyType: z.string().optional(),
    height: optionalNumField,
    preferredHeightMin: optionalNumField,
    preferredHeightMax: optionalNumField,
    preferredAgeMin: optionalNumField,
    preferredAgeMax: optionalNumField,
    education: z.string().optional(),
    preferredEducation: z.string().optional(),
    relationshipType: z.string().optional(),
    wantsChildren: z.string().optional(),
    zodiacSign: z.string().optional(),
    loveLanguage: z.string().optional(),
    communicationStyle: z.string().optional(),
    lifestyle: z.string().optional(),
    accessMotivation: z.string().optional(),
    phonePrefix: z.string().optional().or(z.literal("")),
    phoneNumber: z.string().max(15, t("profileEdit.validationPhoneTooLong")).optional().or(z.literal("")),
    instagramHandle: z.string().max(50).optional().or(z.literal("")),
    tiktokHandle: z.string().max(50).optional().or(z.literal("")),
    facebookUrl: z.string().max(200).optional().or(z.literal("")),
  });
}

type ProfileFormValues = z.infer<ReturnType<typeof createProfileFormSchema>>;

function SelectField({ control, name, label, options, placeholder, testId }: {
  control: any;
  name: string;
  label: string;
  options: string[];
  placeholder?: string;
  testId: string;
}) {
  const { t } = useLanguage();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || undefined}>
            <FormControl>
              <SelectTrigger className="bg-white/5 backdrop-blur-sm border-white/20 text-white [&>span[data-placeholder]]:text-white/90" data-testid={testId}>
                <SelectValue placeholder={placeholder || t("profileEdit.select")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="bg-black/80 backdrop-blur-xl border-white/20">
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
            i < currentStep
              ? "bg-primary"
              : i === currentStep
              ? "bg-primary/60"
              : "bg-muted"
          }`}
          data-testid={`step-indicator-${i}`}
        />
      ))}
    </div>
  );
}

export default function ProfileEdit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const params = useParams<{ profileId?: string }>();
  const adminProfileId = params?.profileId;
  const [step, setStep] = useState(0);

  const stepTitles = [
    t("profileEdit.step1"),
    t("profileEdit.step2"),
    t("profileEdit.step3"),
    t("profileEdit.step4"),
    t("profileEdit.step5"),
    t("profileEdit.step6"),
    t("profileEdit.step7"),
  ];
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [communicationStyles, setCommunicationStyles] = useState<string[]>([]);
  const [interestSearch, setInterestSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [profileVideoUrl, setProfileVideoUrl] = useState<string | null>(null);
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0);
  const [profileLatitude, setProfileLatitude] = useState<number | null>(null);
  const [profileLongitude, setProfileLongitude] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  const { data: myProfile, isLoading: myProfileLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const { data: adminTargetProfile, isLoading: adminTargetLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles", adminProfileId],
    queryFn: async () => {
      if (!adminProfileId) return null;
      const res = await fetch(`/api/profiles/${adminProfileId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!adminProfileId,
  });

  const existingProfile = adminProfileId ? adminTargetProfile : myProfile;
  const isLoading = adminProfileId ? adminTargetLoading : myProfileLoading;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(t)),
    defaultValues: {
      name: "",
      bio: "",
      location: "",
      alienType: "",
      imageUrl: availableImages[0],
      gender: "",
      preferredGender: "",
      hairColor: "",
      eyeColor: "",
      bodyType: "",
      height: "",
      preferredHeightMin: "",
      preferredHeightMax: "",
      preferredAgeMin: "",
      preferredAgeMax: "",
      education: "",
      preferredEducation: "",
      relationshipType: "",
      wantsChildren: "",
      zodiacSign: "",
      loveLanguage: "",
      communicationStyle: "",
      lifestyle: "",
      accessMotivation: "",
      phonePrefix: "+39",
      phoneNumber: "",
      instagramHandle: "",
      tiktokHandle: "",
      facebookUrl: "",
    },
  });

  useEffect(() => {
    if (existingProfile && !hasInitialized.current) {
      hasInitialized.current = true;
      form.reset({
        name: existingProfile.name,
        age: existingProfile.age,
        bio: existingProfile.bio,
        location: existingProfile.location,
        alienType: existingProfile.alienType,
        imageUrl: existingProfile.imageUrl,
        gender: existingProfile.gender || "",
        preferredGender: existingProfile.preferredGender || "",
        hairColor: existingProfile.hairColor || "",
        eyeColor: existingProfile.eyeColor || "",
        bodyType: existingProfile.bodyType || "",
        height: existingProfile.height || "",
        preferredHeightMin: existingProfile.preferredHeightMin || "",
        preferredHeightMax: existingProfile.preferredHeightMax || "",
        preferredAgeMin: existingProfile.preferredAgeMin || "",
        preferredAgeMax: existingProfile.preferredAgeMax || "",
        education: existingProfile.education || "",
        preferredEducation: existingProfile.preferredEducation || "",
        relationshipType: existingProfile.relationshipType || "",
        wantsChildren: existingProfile.wantsChildren || "",
        zodiacSign: existingProfile.zodiacSign || "",
        loveLanguage: existingProfile.loveLanguage || "",
        communicationStyle: existingProfile.communicationStyle || "",
        lifestyle: existingProfile.lifestyle || "",
        accessMotivation: existingProfile.accessMotivation || "",
        phonePrefix: existingProfile.phonePrefix || "+39",
        phoneNumber: existingProfile.phoneNumber || "",
        instagramHandle: (existingProfile as any).instagramHandle || "",
        tiktokHandle: (existingProfile as any).tiktokHandle || "",
        facebookUrl: (existingProfile as any).facebookUrl || "",
      });
      setInterests(existingProfile.interests || []);
      setLanguages(existingProfile.languages || []);
      setCommunicationStyles(existingProfile.communicationStyle ? existingProfile.communicationStyle.split(",").filter(Boolean) : []);
      setCitySearch(existingProfile.location || "");
      setUploadedPhotos(existingProfile.photos || []);
      setProfileVideoUrl(existingProfile.profileVideoUrl || null);
      setRatingEnabled(existingProfile.ratingEnabled || false);
      setLocationSharingEnabled(existingProfile.locationSharingEnabled ?? true);
      if (existingProfile.maxDistanceKm != null) setMaxDistanceKm(existingProfile.maxDistanceKm);
      if (existingProfile.profileLatitude) setProfileLatitude(existingProfile.profileLatitude);
      if (existingProfile.profileLongitude) setProfileLongitude(existingProfile.profileLongitude);
    }
  }, [existingProfile]);

  // Auto-richiesta GPS: se la posizione è attiva ma le coordinate mancano, richiedi subito
  useEffect(() => {
    if (!locationSharingEnabled) return;
    if (profileLatitude && profileLongitude) return;
    if (!navigator.geolocation) return;
    const timer = setTimeout(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setProfileLatitude(pos.coords.latitude);
          setProfileLongitude(pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    }, 800);
    return () => clearTimeout(timer);
  }, [locationSharingEnabled, profileLatitude, profileLongitude]);

  const createMutation = useMutation({
    mutationFn: async (data: ProfileFormValues & { interests: string[]; languages: string[] }) => {
      const payload = {
        ...data,
        userId: user?.id,
        height: data.height ? Number(data.height) : null,
        preferredHeightMin: data.preferredHeightMin ? Number(data.preferredHeightMin) : null,
        preferredHeightMax: data.preferredHeightMax ? Number(data.preferredHeightMax) : null,
        preferredAgeMin: data.preferredAgeMin ? Number(data.preferredAgeMin) : null,
        preferredAgeMax: data.preferredAgeMax ? Number(data.preferredAgeMax) : null,
      };
      return apiRequest("POST", "/api/profiles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({ title: t("profileEdit.profileCreated"), description: t("profileEdit.profileCreatedDesc") });
      setLocation("/");
    },
    onError: (error: any) => {
      let msg = t("profileEdit.createError");
      try {
        const parsed = JSON.parse(error?.message?.split(": ").slice(1).join(": ") || "{}");
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormValues & { interests: string[]; languages: string[] }) => {
      const payload = {
        ...data,
        height: data.height ? Number(data.height) : null,
        preferredHeightMin: data.preferredHeightMin ? Number(data.preferredHeightMin) : null,
        preferredHeightMax: data.preferredHeightMax ? Number(data.preferredHeightMax) : null,
        preferredAgeMin: data.preferredAgeMin ? Number(data.preferredAgeMin) : null,
        preferredAgeMax: data.preferredAgeMax ? Number(data.preferredAgeMax) : null,
      };
      const targetId = adminProfileId || existingProfile!.id;
      return apiRequest("PUT", `/api/profiles/${targetId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", adminProfileId] });
      toast({ title: t("profileEdit.profileUpdated"), description: t("profileEdit.profileUpdatedDesc") });
      setLocation(adminProfileId ? "/admin" : "/profile");
    },
    onError: (error: any) => {
      let msg = t("profileEdit.updateError");
      try {
        const parsed = JSON.parse(error?.message?.split(": ").slice(1).join(": ") || "{}");
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    },
  });

  const submitClickedRef = useRef(false);

  const onSubmit = (data: ProfileFormValues) => {
    if (!submitClickedRef.current) return;
    submitClickedRef.current = false;

    if (step !== TOTAL_STEPS - 1) return;

    const profileData = { ...data, interests, languages, communicationStyle: communicationStyles.join(","), ratingEnabled, locationSharingEnabled, maxDistanceKm, profileLatitude, profileLongitude };
    if (existingProfile) {
      updateMutation.mutate(profileData);
    } else {
      createMutation.mutate(profileData);
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else if (interests.length < 10) {
      setInterests([...interests, interest]);
    } else {
      toast({ title: t("profileEdit.maxInterests"), description: t("profileEdit.maxInterestsDesc"), variant: "destructive" });
    }
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter((l) => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const toggleCommunicationStyle = (style: string) => {
    if (communicationStyles.includes(style)) {
      setCommunicationStyles(communicationStyles.filter((s) => s !== style));
    } else {
      setCommunicationStyles([...communicationStyles, style]);
    }
  };

  const nextStep = async () => {
    if (step === 0) {
      const valid = await form.trigger(["name", "age", "alienType", "imageUrl"]);
      if (!valid) return;
    }
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: t("profileEdit.unsupportedFormat"), description: t("profileEdit.unsupportedFormatDesc"), variant: "destructive" });
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: t("profileEdit.fileTooLarge"), description: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, variant: "destructive" });
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    if (uploadedPhotos.length >= 6) {
      toast({ title: t("profileEdit.maxPhotos"), description: t("profileEdit.maxPhotosDesc"), variant: "destructive" });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("age", String(form.getValues("age") ?? ""));
      formData.append("photo", file);
      const url = adminProfileId
        ? `/api/profiles/upload-photo?targetProfileId=${adminProfileId}`
        : "/api/profiles/upload-photo";
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }
      const data = await response.json();
      setUploadedPhotos(data.photos);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      if (adminProfileId) queryClient.invalidateQueries({ queryKey: ["/api/profiles", adminProfileId] });
      toast({ title: t("profileEdit.photoUploaded"), description: t("profileEdit.photoUploadedDesc") });
    } catch (err: any) {
      const msg = err?.message || t("profileEdit.uploadError");
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    try {
      const body: any = { photoUrl };
      if (adminProfileId) body.targetProfileId = adminProfileId;
      const response = await fetch("/api/profiles/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Delete failed");
      const data = await response.json();
      setUploadedPhotos(data.photos);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      if (adminProfileId) queryClient.invalidateQueries({ queryKey: ["/api/profiles", adminProfileId] });
    } catch {
      toast({ title: t("common.error"), description: t("profileEdit.photoRemoveError"), variant: "destructive" });
    }
  };

  const handleSetProfilePhoto = async (photoUrl: string) => {
    try {
      const body: any = { photoUrl };
      if (adminProfileId) body.targetProfileId = adminProfileId;
      const response = await fetch("/api/profiles/set-profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed");
      form.setValue("imageUrl", photoUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      if (adminProfileId) queryClient.invalidateQueries({ queryKey: ["/api/profiles", adminProfileId] });
      toast({ title: t("profileEdit.profilePhotoUpdated"), description: t("profileEdit.profilePhotoUpdatedDesc") });
    } catch {
      toast({ title: t("common.error"), description: t("profileEdit.profilePhotoError"), variant: "destructive" });
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (videoInputRef.current) videoInputRef.current.value = "";

    const maxSize = 250 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: t("common.error"), description: "Video troppo grande. Massimo 250 MB.", variant: "destructive" });
      return;
    }

    setIsUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append("video", file);
      const url = adminProfileId
        ? `/api/profiles/upload-video?targetProfileId=${adminProfileId}`
        : "/api/profiles/upload-video";
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed");
      }
      const data = await response.json();
      setProfileVideoUrl(data.profileVideoUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      if (adminProfileId) queryClient.invalidateQueries({ queryKey: ["/api/profiles", adminProfileId] });
      toast({ title: "Video caricato", description: "Il video profilo è stato aggiornato." });
    } catch (err: any) {
      toast({ title: t("common.error"), description: err?.message || "Errore nel caricamento del video.", variant: "destructive" });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async () => {
    try {
      const body: any = {};
      if (adminProfileId) body.targetProfileId = adminProfileId;
      const response = await fetch("/api/profiles/delete-video", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Delete failed");
      setProfileVideoUrl(null);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      if (adminProfileId) queryClient.invalidateQueries({ queryKey: ["/api/profiles", adminProfileId] });
      toast({ title: "Video eliminato", description: "Il video profilo è stato rimosso." });
    } catch {
      toast({ title: t("common.error"), description: "Errore nell'eliminazione del video.", variant: "destructive" });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredInterests = interestSearch
    ? interestsList.filter(i => i.toLowerCase().includes(interestSearch.toLowerCase()))
    : interestsList;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-white/60">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 max-w-lg mx-auto pb-8 overflow-y-auto text-[16px] relative">
      <div className="fixed inset-0 z-0">
        {step === 1 ? (
          <img src="/backgrounds/vibra-alien-soldier.gif" alt="" className="w-full h-full object-cover" />
        ) : step === 2 ? (
          <img src="/backgrounds/vibra-partner-pref.gif" alt="" className="w-full h-full object-cover" />
        ) : step === 3 ? (
          <img src="/backgrounds/vibra-personality.gif" alt="" className="w-full h-full object-cover" />
        ) : step === 4 ? (
          <img src="/backgrounds/vibra-cosa-cerchi.gif" alt="" className="w-full h-full object-cover" />
        ) : step === 5 ? (
          <img src="/backgrounds/vibra-lingue-bio.gif" alt="" className="w-full h-full object-cover" />
        ) : (
          <video autoPlay loop muted playsInline className="w-full h-full object-cover">
            <source src="/backgrounds/vibra-video-2.mp4" type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>
      <div className="relative z-10">
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => {
            if (step > 0) prevStep();
            else setLocation(adminProfileId ? "/admin" : existingProfile ? "/profile" : "/");
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white" data-testid="text-step-title">
            {adminProfileId
              ? `Modifica bot: ${existingProfile?.name || ""}`
              : existingProfile
                ? t("profileEdit.title")
                : t("profileEdit.createProfile")}
          </h1>
          <p className="text-sm text-white/80" data-testid="text-step-subtitle">
            {stepTitles[step]} — {step + 1}/{TOTAL_STEPS}
          </p>
        </div>
        {!existingProfile && !adminProfileId && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-white/90"
            onClick={() => logout()}
            data-testid="button-logout-from-create"
          >
            <LogOut className="w-4 h-4" />
            {t("profileEdit.logout")}
          </Button>
        )}
      </div>

      <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={(e) => { if (e.key === "Enter" && step !== TOTAL_STEPS - 1) e.preventDefault(); }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <User className="w-5 h-5 text-primary" />
                    {t("profileEdit.step1")}
                  </div>
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                            <Camera className="w-4 h-4" />
                            {t("profileEdit.profilePhoto")}
                          </FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-5 gap-2">
                              {availableImages.map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => field.onChange(img)}
                                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                    field.value === img
                                      ? "border-primary ring-2 ring-primary/50"
                                      : "border-transparent hover:border-muted-foreground/50"
                                  }`}
                                  data-testid={`button-select-image-${idx}`}
                                >
                                  <img src={img} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase mb-3">
                        <ImagePlus className="w-4 h-4" />
                        {t("profileEdit.yourPhotos")} ({uploadedPhotos.length}/6)
                      </FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {uploadedPhotos.map((photo, idx) => {
                          const isProfilePhoto = existingProfile?.imageUrl === photo;
                          return (
                            <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${isProfilePhoto ? 'border-primary' : 'border-white/20'}`}>
                              <img src={photo} alt={`${t("profileEdit.photo")} ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-profile-photo-${idx}`} />
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(photo)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                                data-testid={`button-remove-photo-${idx}`}
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                              {isProfilePhoto ? (
                                <div className="absolute bottom-0 left-0 right-0 bg-primary/80 py-0.5 text-center">
                                  <span className="text-[10px] font-bold text-white">{t("profileEdit.profileLabel")}</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetProfilePhoto(photo)}
                                  className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                                  data-testid={`button-set-profile-photo-${idx}`}
                                >
                                  <UserCircle className="w-4 h-4 text-white/90" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {uploadedPhotos.length < 6 && (
                          <label
                            onClick={() => { if (!isUploadingPhoto) photoInputRef.current?.click(); }}
                            className={`aspect-square rounded-xl border-2 border-dashed border-white/40 bg-white/5 flex flex-col items-center justify-center gap-1 text-white/90 hover:border-primary/50 hover:text-primary hover:bg-white/10 transition-colors ${isUploadingPhoto ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}
                            data-testid="button-add-photo"
                          >
                            {isUploadingPhoto ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <>
                                <Camera className="w-6 h-6" />
                                <span className="text-xs font-medium">{t("profileEdit.add")}</span>
                              </>
                            )}
                          </label>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase mb-3">
                        <Video className="w-4 h-4 text-primary" />
                        <span>Video Profilo</span>
                      </div>
                      {profileVideoUrl ? (
                        <div className="relative rounded-xl overflow-hidden border-2 border-primary/60 bg-black" style={{ aspectRatio: '9/16', maxHeight: 200 }}>
                          <video
                            src={profileVideoUrl}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                            data-testid="video-profile-preview"
                          />
                          <div className="absolute bottom-2 left-2 bg-primary/80 rounded-full px-2 py-0.5">
                            <span className="text-[10px] text-white font-semibold">★ PRINCIPALE</span>
                          </div>
                          {adminProfileId && (
                            <button
                              type="button"
                              onClick={handleDeleteVideo}
                              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-600/80 transition-colors"
                              data-testid="button-delete-profile-video"
                            >
                              <X className="w-3.5 h-3.5 text-white" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="w-full rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-1 text-white/50 py-6">
                          <Video className="w-7 h-7" />
                          <span className="text-sm">Nessun video principale</span>
                        </div>
                      )}
                      {adminProfileId ? (
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => videoInputRef.current?.click()}
                            disabled={isUploadingVideo}
                            className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-white/80 text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                            data-testid="button-upload-profile-video"
                          >
                            {isUploadingVideo ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Video className="w-4 h-4" />
                            )}
                            {isUploadingVideo ? "Caricamento..." : (profileVideoUrl ? "Sostituisci video" : "Carica video")}
                          </button>
                          {profileVideoUrl && (
                            <button
                              type="button"
                              onClick={handleDeleteVideo}
                              className="rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors text-red-400 text-sm py-2.5 px-3 flex items-center justify-center gap-2"
                              data-testid="button-delete-video-btn"
                            >
                              <X className="w-4 h-4" />
                              Elimina
                            </button>
                          )}
                        </div>
                      ) : (
                        <Link href="/profile">
                          <button
                            type="button"
                            className="mt-2 w-full rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-white/80 text-sm py-2.5 flex items-center justify-center gap-2"
                            data-testid="button-manage-videos"
                          >
                            <Video className="w-4 h-4" />
                            Gestisci video nel profilo
                          </button>
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.name")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90 placeholder:text-sm" placeholder={t("profileEdit.namePlaceholder")} {...field} data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.age")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90" type="number" placeholder={t("profileEdit.agePlaceholder")} {...field} value={field.value ?? ""} data-testid="input-age" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="gender" label={t("profileEdit.gender")} options={genderOptions} placeholder={t("profileEdit.genderPlaceholder")} testId="select-gender" />
                      <SelectField control={form.control} name="preferredGender" label={t("profileEdit.lookingFor")} options={preferredGenderOptions} placeholder={t("profileEdit.lookingForPlaceholder")} testId="select-preferred-gender" />
                    </div>

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => {
                        const allCities = [...italianCities, ...worldCities];
                        const filteredCities = citySearch
                          ? allCities.filter(c =>
                              c.nome.toLowerCase().includes(citySearch.toLowerCase()) ||
                              c.provincia.toLowerCase().includes(citySearch.toLowerCase()) ||
                              c.regione.toLowerCase().includes(citySearch.toLowerCase())
                            )
                          : allCities;
                        return (
                          <FormItem className="relative">
                            <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                              <MapPin className="w-4 h-4" />
                              {t("profileEdit.city")}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90"
                                  placeholder={t("profileEdit.cityPlaceholder")}
                                  value={citySearch}
                                  onChange={(e) => {
                                    setCitySearch(e.target.value);
                                    field.onChange(e.target.value);
                                    setShowCityDropdown(true);
                                    if (!e.target.value) {
                                      field.onChange("");
                                    }
                                  }}
                                  onFocus={() => setShowCityDropdown(true)}
                                  onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                                  data-testid="input-location"
                                />
                                {showCityDropdown && filteredCities.length > 0 && (
                                  <div className="absolute z-50 w-full mt-1 max-h-[200px] overflow-y-auto rounded-md bg-black/80 backdrop-blur-xl border-white/20 border shadow-md">
                                    {filteredCities.slice(0, 20).map((city) => (
                                      <button
                                        key={city.nome}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center justify-between gap-2"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          field.onChange(city.nome);
                                          setCitySearch(city.nome);
                                          setShowCityDropdown(false);
                                          setProfileLatitude(city.lat);
                                          setProfileLongitude(city.lng);
                                        }}
                                        data-testid={`city-option-${slugify(city.nome)}`}
                                      >
                                        <span>{city.nome}</span>
                                        <span className="text-xs text-white/80">{city.provincia ? `${city.provincia} - ` : ""}{city.regione}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <div className="space-y-3">
                      <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                        <Compass className="w-4 h-4" />
                        {t("profileEdit.maxDistance")}
                      </FormLabel>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          data-testid="button-toggle-distance"
                          onClick={() => setMaxDistanceKm(maxDistanceKm === 0 ? 50 : 0)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            maxDistanceKm === 0
                              ? "bg-gradient-to-r from-purple-500 to-cyan-500 border-purple-400/50 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                              : "bg-white/5 border-white/20 text-white/80 hover:border-white/40"
                          }`}
                        >
                          {maxDistanceKm === 0 ? t("profileEdit.worldwide") : t("profileEdit.anywhere")}
                        </button>
                        {maxDistanceKm > 0 && (
                          <>
                            <Slider
                              value={[maxDistanceKm]}
                              onValueChange={(v) => setMaxDistanceKm(v[0])}
                              min={5}
                              max={200}
                              step={5}
                              className="flex-1"
                              data-testid="slider-max-distance"
                            />
                            <span className="text-white font-bold min-w-[50px] text-right text-sm" data-testid="text-max-distance">{maxDistanceKm} km</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-white/80">
                        {maxDistanceKm === 0
                          ? t("profileEdit.noDistanceLimit")
                          : t("profileEdit.distanceLimit")}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                        <Phone className="w-4 h-4" />
                        {t("profileEdit.phone")}
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="phonePrefix"
                          render={({ field }) => (
                            <FormItem className="w-[140px]">
                              <Select onValueChange={field.onChange} value={field.value || undefined}>
                                <FormControl>
                                  <SelectTrigger className="bg-white/15 backdrop-blur-md border-white/25 text-white" data-testid="select-phone-prefix">
                                    <SelectValue placeholder="+39" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-black/80 backdrop-blur-xl border-white/20">
                                  {phonePrefixes.map((p) => (
                                    <SelectItem key={`${p.codice}-${p.paese}`} value={p.codice}>
                                      {p.codice} {p.paese}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90"
                                  type="tel"
                                  placeholder={t("profileEdit.phonePlaceholder")}
                                  {...field}
                                  data-testid="input-phone-number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <p className="text-xs text-amber-300/90 flex items-center gap-1 mt-1" data-testid="text-phone-privacy">
                        <Phone className="w-3 h-3 shrink-0" />
                        {t("profileEdit.phonePrivacy")}
                      </p>
                    </div>

                    <SelectField control={form.control} name="alienType" label={t("profileEdit.cosmicType")} options={alienTypes} testId="select-alien-type" placeholder={t("profileEdit.cosmicTypePlaceholder")} />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Ruler className="w-5 h-5 text-accent" />
                    {t("profileEdit.step2")}
                  </div>
                  <p className="text-white/90 text-sm">{t("profileEdit.appearanceDesc")}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="hairColor" label={t("profileEdit.hair")} options={hairColorOptions} placeholder={t("profileEdit.hairPlaceholder")} testId="select-hair-color" />
                      <SelectField control={form.control} name="eyeColor" label={t("profileEdit.eyes")} options={eyeColorOptions} placeholder={t("profileEdit.eyesPlaceholder")} testId="select-eye-color" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="bodyType" label={t("profileEdit.bodyType")} options={bodyTypeOptions} placeholder={t("profileEdit.bodyTypePlaceholder")} testId="select-body-type" />
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.heightCm")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90" type="number" placeholder={t("profileEdit.heightPlaceholder")} {...field} data-testid="input-height" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xl font-semibold text-white">
                      <Heart className="w-5 h-5 text-primary" />
                      {t("profileEdit.step3")}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-white/80 text-xs"
                      data-testid="button-clear-preferences"
                      onClick={() => {
                        form.setValue("preferredGender", "");
                        form.setValue("preferredAgeMin", "");
                        form.setValue("preferredAgeMax", "");
                        form.setValue("preferredHeightMin", "");
                        form.setValue("preferredHeightMax", "");
                        form.setValue("preferredEducation", "");
                        setMaxDistanceKm(0);
                        setProfileLatitude(null);
                        setProfileLongitude(null);
                        setLocationSharingEnabled(false);
                        toast({ title: t("profileEdit.prefsCleared"), description: t("profileEdit.prefsClearedDesc") });
                      }}
                    >
                      {t("profileEdit.clearAll")}
                    </Button>
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="preferredAgeMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.partnerAgeMin")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90" type="number" placeholder={t("profileEdit.ageMinPlaceholder")} {...field} data-testid="input-age-min" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="preferredAgeMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.partnerAgeMax")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90" type="number" placeholder={t("profileEdit.ageMaxPlaceholder")} {...field} data-testid="input-age-max" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="preferredHeightMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.partnerHeightMin")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90" type="number" placeholder={t("profileEdit.heightMinPlaceholder")} {...field} data-testid="input-height-min" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="preferredHeightMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.partnerHeightMax")}</FormLabel>
                            <FormControl>
                              <Input className="bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90" type="number" placeholder={t("profileEdit.heightMaxPlaceholder")} {...field} data-testid="input-height-max" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <SelectField control={form.control} name="education" label={t("profileEdit.education")} options={educationOptions} placeholder={t("profileEdit.educationPlaceholder")} testId="select-education" />
                    <SelectField control={form.control} name="preferredEducation" label={t("profileEdit.preferredEducation")} options={preferredEducationOptions} placeholder={t("profileEdit.preferredEducationPlaceholder")} testId="select-preferred-education" />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Star className="w-5 h-5 text-accent" />
                    {t("profileEdit.step4")}
                  </div>
                    <SelectField control={form.control} name="zodiacSign" label={t("profileEdit.zodiac")} options={zodiacSignOptions} placeholder={t("profileEdit.zodiacPlaceholder")} testId="select-zodiac" />
                    <SelectField control={form.control} name="loveLanguage" label={t("profileEdit.loveLanguage")} options={loveLanguageOptions} placeholder={t("profileEdit.loveLanguagePlaceholder")} testId="select-love-language" />
                    <div>
                      <FormLabel className="mb-3 block text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.commPref")}</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {communicationStyleOptions.map((style) => (
                          <Badge
                            key={style}
                            variant={communicationStyles.includes(style) ? "default" : "outline"}
                            className={`cursor-pointer transition-all toggle-elevate ${communicationStyles.includes(style) ? "toggle-elevated" : ""}`}
                            onClick={() => toggleCommunicationStyle(style)}
                            data-testid={`badge-comm-${style.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {style}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <SelectField control={form.control} name="lifestyle" label={t("profileEdit.lifestyle")} options={lifestyleOptions} placeholder={t("profileEdit.lifestylePlaceholder")} testId="select-lifestyle" />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Search className="w-5 h-5 text-primary" />
                    {t("profileEdit.step5")}
                  </div>
                    <SelectField control={form.control} name="relationshipType" label={t("profileEdit.relationship")} options={relationshipTypeOptions} placeholder={t("profileEdit.relationshipPlaceholder")} testId="select-relationship" />
                    <SelectField control={form.control} name="wantsChildren" label={t("profileEdit.children")} options={wantsChildrenOptions} placeholder={t("profileEdit.childrenPlaceholder")} testId="select-children" />
                    <SelectField control={form.control} name="accessMotivation" label={t("profileEdit.whyHere")} options={accessMotivationOptions} placeholder={t("profileEdit.whyHerePlaceholder")} testId="select-motivation" />

                    <div className="mt-6 pt-4 border-t border-white/15">
                      <p className="text-white font-semibold text-sm tracking-wide uppercase mb-3">{t("profileEdit.extraFeatures")}</p>
                      <p className="text-white/90 text-sm mb-4">{t("profileEdit.extraFeaturesDesc")}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRatingEnabled(!ratingEnabled)}
                      className={`w-full p-5 rounded-xl border-2 transition-all ${
                        ratingEnabled
                          ? "bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-cyan-500/20 border-primary shadow-lg shadow-primary/20"
                          : "bg-white/5 border-white/10"
                      }`}
                      data-testid="toggle-rating-enabled"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          ratingEnabled ? "bg-primary/30" : "bg-white/10"
                        }`}>
                          <Eye className={`w-7 h-7 transition-colors ${ratingEnabled ? "text-primary" : "text-white/40"}`} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className={`font-bold text-base mb-1 transition-colors ${ratingEnabled ? "text-white" : "text-white/80"}`}>
                            {t("profile.primaImpressione")}
                          </p>
                          <p className="text-white/90 text-sm leading-relaxed">
                            {t("profileEdit.piDesc")}
                          </p>
                        </div>
                        <div className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors shrink-0 ${
                          ratingEnabled ? "bg-primary" : "bg-white/20"
                        }`}>
                          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${
                            ratingEnabled ? "translate-x-7" : "translate-x-1"
                          }`} />
                        </div>
                      </div>
                      {ratingEnabled && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-green-400 font-medium">{t("profileEdit.piActiveDesc")}</span>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const newVal = !locationSharingEnabled;
                        setLocationSharingEnabled(newVal);
                        if (newVal && navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setProfileLatitude(pos.coords.latitude);
                              setProfileLongitude(pos.coords.longitude);
                              toast({ title: t("profileEdit.locationAcquired") || "Posizione acquisita!", description: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` });
                            },
                            (err) => {
                              console.error("Geolocation error:", err);
                              setLocationSharingEnabled(false);
                              toast({ title: t("common.error"), description: t("profileEdit.locationError") || "Impossibile ottenere la posizione. Controlla i permessi del browser.", variant: "destructive" });
                            },
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                          );
                        } else if (newVal && !navigator.geolocation) {
                          setLocationSharingEnabled(false);
                          toast({ title: t("common.error"), description: t("profileEdit.locationNotSupported") || "Geolocalizzazione non supportata dal browser.", variant: "destructive" });
                        } else {
                          setProfileLatitude(null);
                          setProfileLongitude(null);
                        }
                      }}
                      className={`mt-3 w-full p-5 rounded-xl border-2 transition-all ${
                        locationSharingEnabled
                          ? "bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 border-secondary shadow-lg shadow-secondary/20"
                          : "bg-white/5 border-white/10"
                      }`}
                      data-testid="toggle-location-sharing"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          locationSharingEnabled ? "bg-secondary/30" : "bg-white/10"
                        }`}>
                          <MapPin className={`w-7 h-7 transition-colors ${locationSharingEnabled ? "text-secondary" : "text-white/40"}`} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className={`font-bold text-base mb-1 transition-colors ${locationSharingEnabled ? "text-white" : "text-white/80"}`}>
                            {t("profileEdit.locationTitle")}
                          </p>
                          <p className="text-white/90 text-sm leading-relaxed">
                            {t("profileEdit.showLocationDesc")}
                          </p>
                        </div>
                        <div className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors shrink-0 ${
                          locationSharingEnabled ? "bg-secondary" : "bg-white/20"
                        }`}>
                          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${
                            locationSharingEnabled ? "translate-x-7" : "translate-x-1"
                          }`} />
                        </div>
                      </div>
                      {locationSharingEnabled && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-xs text-cyan-400 font-medium">{t("profileEdit.locationActive")}</span>
                          </div>
                          {profileLatitude && profileLongitude ? (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-2">
                              <p className="text-green-400 text-xs font-medium flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {t("profileEdit.locationAcquired")}
                              </p>
                              <p className="text-white/60 text-xs mt-1 font-mono">
                                {profileLatitude.toFixed(4)}, {profileLongitude.toFixed(4)}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
                              <p className="text-yellow-400 text-xs font-medium flex items-center gap-1">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Acquisizione posizione in corso...
                              </p>
                            </div>
                          )}
                          <div className="bg-white/5 rounded-lg p-3 space-y-1">
                            <p className="text-white/80 text-xs font-medium">{t("profileEdit.howItWorks")}</p>
                            <p className="text-white/80 text-xs">{t("profileEdit.locationStep1")}</p>
                            <p className="text-white/80 text-xs">{t("profileEdit.locationStep2")}</p>
                            <p className="text-white/80 text-xs">{t("profileEdit.locationStep3")}</p>
                            <p className="text-white/80 text-xs">{t("profileEdit.locationStep4")}</p>
                            <p className="text-white/80 text-xs">{t("profileEdit.locationStep5")}</p>
                          </div>
                        </div>
                      )}
                    </button>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Languages className="w-5 h-5 text-secondary" />
                    {t("profileEdit.step6")}
                  </div>
                    <div>
                      <FormLabel className="mb-1 block text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.spokenLanguages")}</FormLabel>
                      <p className="text-white/90 text-sm mb-3">{t("profileEdit.spokenLanguagesDesc")}</p>
                      <div className="flex flex-wrap gap-2">
                        {languageOptions.map((lang) => (
                          <Badge
                            key={lang}
                            variant={languages.includes(lang) ? "default" : "outline"}
                            className={`cursor-pointer transition-all toggle-elevate ${languages.includes(lang) ? "toggle-elevated" : ""}`}
                            onClick={() => toggleLanguage(lang)}
                            data-testid={`badge-lang-${lang.toLowerCase()}`}
                          >
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{t("profileEdit.yourBio")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("profileEdit.bioPlaceholder")}
                              className="resize-none min-h-[120px] bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90"
                              {...field}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <div className="text-xs text-white/80 text-right">
                            {field.value?.length || 0}/500
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Social Links */}
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white/70 uppercase tracking-wide">
                        <span className="text-base">📱</span> Social
                      </div>
                      <FormField control={form.control} name="instagramHandle" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-semibold text-xs tracking-wide uppercase">Instagram</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
                              <Input {...field} placeholder="tuonome" className="pl-7 bg-white/5 border-white/20 text-white placeholder:text-white/40" data-testid="input-instagram-handle"/>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}/>
                      <FormField control={form.control} name="tiktokHandle" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-semibold text-xs tracking-wide uppercase">TikTok</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
                              <Input {...field} placeholder="tuonome" className="pl-7 bg-white/5 border-white/20 text-white placeholder:text-white/40" data-testid="input-tiktok-handle"/>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}/>
                      <FormField control={form.control} name="facebookUrl" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white font-semibold text-xs tracking-wide uppercase">Facebook</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://facebook.com/tuonome" className="bg-white/5 border-white/20 text-white placeholder:text-white/40" data-testid="input-facebook-url"/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}/>
                    </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Sparkles className="w-5 h-5 text-accent" />
                    {t("profileEdit.step7")}
                  </div>
                    <p className="text-sm text-white/90">
                      {t("profileEdit.selectInterests")} ({interests.length}/10)
                    </p>

                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-2 border-b border-white/20">
                        {interests.map((interest) => (
                          <Badge
                            key={interest}
                            variant="default"
                            className="cursor-pointer gap-1"
                            onClick={() => toggleInterest(interest)}
                            data-testid={`badge-selected-interest-${slugify(interest)}`}
                          >
                            {interest}
                            <span className="ml-1 opacity-60">x</span>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
                      <Input
                        placeholder={t("profileEdit.searchInterests")}
                        value={interestSearch}
                        onChange={(e) => setInterestSearch(e.target.value)}
                        className="pl-9 bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/90"
                        data-testid="input-search-interests"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                      {filteredInterests.map((item) => {
                        const isSelected = interests.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleInterest(item)}
                            className={`flex items-center gap-2 p-3 rounded-lg text-left text-sm transition-all border backdrop-blur-md ${
                              isSelected
                                ? "border-primary bg-primary/20 text-white"
                                : "border-white/20 bg-white/10 text-white/80 hover:border-white/40"
                            }`}
                            data-testid={`button-interest-${slugify(item)}`}
                          >
                            <span className="flex-1 truncate">{item}</span>
                            {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-6 gap-4">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="gap-2 text-white border-white/30 hover:bg-white/20"
                data-testid="button-prev-step"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("profileEdit.back")}
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {step >= 1 && step < TOTAL_STEPS - 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(step + 1)}
                  className="text-white/90"
                  data-testid="button-skip-step"
                >
                  {t("profileEdit.skip")}
                </Button>
              )}

              {step < TOTAL_STEPS - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="gap-2"
                  data-testid="button-next-step"
                >
                  {t("profileEdit.next")}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {!existingProfile && (
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={isPending}
                      className="text-white/90"
                      onClick={() => { submitClickedRef.current = true; }}
                      data-testid="button-skip-save-profile"
                    >
                      {t("profileEdit.skipAndSave")}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="gap-2"
                    onClick={() => { submitClickedRef.current = true; }}
                    data-testid="button-save-profile"
                  >
                    {isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {existingProfile ? t("profileEdit.saveChanges") : t("profileEdit.createProfile")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </form>
      </Form>
      </div>
      {createPortal(
        <>
          <input
            ref={photoInputRef}
            id="photo-upload-portal-input"
            type="file"
            accept="image/*"
            style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none" }}
            disabled={isUploadingPhoto}
            onChange={handlePhotoUpload}
            data-testid="input-profile-photos"
          />
          <input
            ref={videoInputRef}
            id="video-upload-portal-input"
            type="file"
            accept="video/*"
            style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none" }}
            disabled={isUploadingVideo}
            onChange={handleVideoUpload}
            data-testid="input-profile-video"
          />
        </>,
        document.body
      )}
    </div>
  );
}
