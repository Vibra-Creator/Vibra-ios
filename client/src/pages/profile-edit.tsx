import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Sparkles, MapPin, User, Heart, ArrowLeft, ArrowRight, Save, Ruler, Languages, Star, Search, Check, Phone, ImagePlus, X, Loader2, UserCircle, Eye, Compass } from "lucide-react";
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
  phonePrefixes,
} from "@/lib/profile-options";
import type { Profile } from "@shared/schema";

const TOTAL_STEPS = 7;

const stepTitles = [
  "Info di Base",
  "Aspetto Fisico",
  "Preferenze Partner",
  "Personalità e Stile",
  "Cosa Cerchi",
  "Lingue e Bio",
  "Interessi",
];


const optionalNumField = z.union([z.literal(""), z.coerce.number()]).optional();

const profileFormSchema = z.object({
  name: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
  age: z.coerce.number().min(18, "Devi avere almeno 18 anni").max(120, "Età massima 120"),
  bio: z.string().max(500, "Massimo 500 caratteri").optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  alienType: z.string().min(1, "Seleziona un tipo"),
  imageUrl: z.string().min(1, "Seleziona un'immagine"),
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
  phoneNumber: z.string().max(15, "Numero troppo lungo").optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

function SelectField({ control, name, label, options, placeholder, testId }: {
  control: any;
  name: string;
  label: string;
  options: string[];
  placeholder?: string;
  testId: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || undefined}>
            <FormControl>
              <SelectTrigger className="bg-white/15 backdrop-blur-md border-white/25 text-white [&>span[data-placeholder]]:text-white/70" data-testid={testId}>
                <SelectValue placeholder={placeholder || "Seleziona"} />
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
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [communicationStyles, setCommunicationStyles] = useState<string[]>([]);
  const [interestSearch, setInterestSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(50);
  const [profileLatitude, setProfileLatitude] = useState<number | null>(null);
  const [profileLongitude, setProfileLongitude] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  const { data: existingProfile, isLoading } = useQuery<Profile | null>({
    queryKey: ["/api/profiles/me"],
    enabled: !!user,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      age: 25,
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
      });
      setInterests(existingProfile.interests || []);
      setLanguages(existingProfile.languages || []);
      setCommunicationStyles(existingProfile.communicationStyle ? existingProfile.communicationStyle.split(",").filter(Boolean) : []);
      setCitySearch(existingProfile.location || "");
      setUploadedPhotos(existingProfile.photos || []);
      setRatingEnabled(existingProfile.ratingEnabled || false);
      setLocationSharingEnabled(existingProfile.locationSharingEnabled || false);
      if (existingProfile.maxDistanceKm != null) setMaxDistanceKm(existingProfile.maxDistanceKm);
      if (existingProfile.profileLatitude) setProfileLatitude(existingProfile.profileLatitude);
      if (existingProfile.profileLongitude) setProfileLongitude(existingProfile.profileLongitude);
    }
  }, [existingProfile]);

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
      toast({ title: "Profilo Creato!", description: "Il tuo profilo è pronto per essere scoperto." });
      setLocation("/");
    },
    onError: (error: any) => {
      let msg = "Non è stato possibile creare il profilo.";
      try {
        const parsed = JSON.parse(error?.message?.split(": ").slice(1).join(": ") || "{}");
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: "Errore", description: msg, variant: "destructive" });
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
      return apiRequest("PUT", `/api/profiles/${existingProfile!.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({ title: "Profilo Aggiornato!", description: "Le tue modifiche sono state salvate." });
      setLocation("/profile");
    },
    onError: (error: any) => {
      let msg = "Non è stato possibile aggiornare il profilo.";
      try {
        const parsed = JSON.parse(error?.message?.split(": ").slice(1).join(": ") || "{}");
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: "Errore", description: msg, variant: "destructive" });
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
      toast({ title: "Massimo 10 interessi", description: "Rimuovi un interesse prima di aggiungerne altri.", variant: "destructive" });
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
      toast({ title: "Formato non supportato", description: "Usa JPG, PNG, WebP o GIF.", variant: "destructive" });
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "File troppo grande", description: `La foto deve essere massimo 5 MB. La tua è ${(file.size / (1024 * 1024)).toFixed(1)} MB.`, variant: "destructive" });
      if (photoInputRef.current) photoInputRef.current.value = "";
      return;
    }

    if (uploadedPhotos.length >= 6) {
      toast({ title: "Massimo 6 foto", description: "Rimuovi una foto prima di aggiungerne altre", variant: "destructive" });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const response = await fetch("/api/profiles/upload-photo", {
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
      toast({ title: "Foto caricata!", description: "La tua foto è stata aggiunta al profilo." });
    } catch (err: any) {
      const msg = err?.message || "Impossibile caricare la foto";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async (photoUrl: string) => {
    try {
      const response = await fetch("/api/profiles/photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Delete failed");
      const data = await response.json();
      setUploadedPhotos(data.photos);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    } catch {
      toast({ title: "Errore", description: "Impossibile rimuovere la foto", variant: "destructive" });
    }
  };

  const handleSetProfilePhoto = async (photoUrl: string) => {
    try {
      const response = await fetch("/api/profiles/set-profile-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({ title: "Foto profilo aggiornata!", description: "Questa foto è ora la tua immagine del profilo." });
    } catch {
      toast({ title: "Errore", description: "Impossibile impostare la foto del profilo", variant: "destructive" });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filteredInterests = interestSearch
    ? interestsList.filter(i => i.toLowerCase().includes(interestSearch.toLowerCase()))
    : interestsList;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-white/60">Caricamento...</div>
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
          onClick={() => {
            if (step > 0) prevStep();
            else setLocation(existingProfile ? "/profile" : "/");
          }}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white" data-testid="text-step-title">
            {existingProfile ? "Modifica Profilo" : "Crea il Tuo Profilo"}
          </h1>
          <p className="text-sm text-white/60" data-testid="text-step-subtitle">
            {stepTitles[step]} — {step + 1}/{TOTAL_STEPS}
          </p>
        </div>
        {!existingProfile && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-white/70"
            onClick={() => logout()}
            data-testid="button-logout-from-create"
          >
            <LogOut className="w-4 h-4" />
            Esci
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
                    Info di Base
                  </div>
                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                            <Camera className="w-4 h-4" />
                            Foto Profilo
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
                        Le Tue Foto ({uploadedPhotos.length}/6)
                      </FormLabel>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                        data-testid="input-profile-photos"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {uploadedPhotos.map((photo, idx) => {
                          const isProfilePhoto = existingProfile?.imageUrl === photo;
                          return (
                            <div key={idx} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${isProfilePhoto ? 'border-primary' : 'border-white/20'}`}>
                              <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-profile-photo-${idx}`} />
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
                                  <span className="text-[10px] font-bold text-white">PROFILO</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetProfilePhoto(photo)}
                                  className="absolute bottom-1 left-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                                  data-testid={`button-set-profile-photo-${idx}`}
                                >
                                  <UserCircle className="w-4 h-4 text-white/70" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {uploadedPhotos.length < 6 && (
                          <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                            className="aspect-square rounded-xl border-2 border-dashed border-white/40 bg-white/5 flex flex-col items-center justify-center gap-1 text-white/70 hover:border-primary/50 hover:text-primary hover:bg-white/10 transition-colors"
                            data-testid="button-add-photo"
                          >
                            {isUploadingPhoto ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <>
                                <Camera className="w-6 h-6" />
                                <span className="text-xs font-medium">Aggiungi</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Nome</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70 placeholder:text-sm" placeholder="Il tuo nome" {...field} data-testid="input-name" />
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
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Età</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70" type="number" placeholder="La tua età (es. 25)" {...field} data-testid="input-age" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="gender" label="Genere" options={genderOptions} placeholder="Il tuo genere" testId="select-gender" />
                      <SelectField control={form.control} name="preferredGender" label="Cerco" options={preferredGenderOptions} placeholder="Chi ti attrae" testId="select-preferred-gender" />
                    </div>

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => {
                        const filteredCities = citySearch
                          ? italianCities.filter(c =>
                              c.nome.toLowerCase().includes(citySearch.toLowerCase()) ||
                              c.provincia.toLowerCase().includes(citySearch.toLowerCase()) ||
                              c.regione.toLowerCase().includes(citySearch.toLowerCase())
                            )
                          : italianCities;
                        return (
                          <FormItem className="relative">
                            <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                              <MapPin className="w-4 h-4" />
                              Citta
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70"
                                  placeholder="Cerca la tua citta..."
                                  value={citySearch}
                                  onChange={(e) => {
                                    setCitySearch(e.target.value);
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
                                        <span className="text-xs text-white/60">{city.provincia} - {city.regione}</span>
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
                        Distanza Massima
                      </FormLabel>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          data-testid="button-toggle-distance"
                          onClick={() => setMaxDistanceKm(maxDistanceKm === 0 ? 50 : 0)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            maxDistanceKm === 0
                              ? "bg-gradient-to-r from-purple-500 to-cyan-500 border-purple-400/50 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                              : "bg-white/5 border-white/20 text-white/60 hover:border-white/40"
                          }`}
                        >
                          {maxDistanceKm === 0 ? "🌍 Tutta Italia" : "🌍 Ovunque"}
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
                      <p className="text-xs text-white/60">
                        {maxDistanceKm === 0
                          ? "Nessun limite di distanza — vedrai profili da tutta Italia"
                          : "Mostra solo profili entro questo raggio dalla tua città"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-white font-semibold text-sm tracking-wide uppercase">
                        <Phone className="w-4 h-4" />
                        Telefono
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
                                  className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70"
                                  type="tel"
                                  placeholder="Numero di telefono"
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
                        Il numero non sara' visibile nel profilo. Usato solo per verifica interna. (Opzionale)
                      </p>
                    </div>

                    <SelectField control={form.control} name="alienType" label="Tipo Cosmico" options={alienTypes} testId="select-alien-type" placeholder="La tua specie cosmica" />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Ruler className="w-5 h-5 text-accent" />
                    Aspetto Fisico
                  </div>
                  <p className="text-white/70 text-sm">Descrivi il tuo aspetto fisico per trovare la tua anima gemella</p>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="hairColor" label="Capelli" options={hairColorOptions} placeholder="Colore capelli" testId="select-hair-color" />
                      <SelectField control={form.control} name="eyeColor" label="Occhi" options={eyeColorOptions} placeholder="Colore occhi" testId="select-eye-color" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="bodyType" label="Corporatura" options={bodyTypeOptions} placeholder="Il tuo fisico" testId="select-body-type" />
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Altezza (cm)</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70" type="number" placeholder="La tua altezza (es. 175)" {...field} data-testid="input-height" />
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
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Heart className="w-5 h-5 text-primary" />
                    Preferenze Partner
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="preferredAgeMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Età Min. Partner</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70" type="number" placeholder="Età minima (es. 18)" {...field} data-testid="input-age-min" />
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
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Età Max. Partner</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70" type="number" placeholder="Età massima (es. 40)" {...field} data-testid="input-age-max" />
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
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Alt. Min. Partner</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70" type="number" placeholder="Altezza minima (es. 150)" {...field} data-testid="input-height-min" />
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
                            <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">Alt. Max. Partner</FormLabel>
                            <FormControl>
                              <Input className="bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70" type="number" placeholder="Altezza massima (es. 190)" {...field} data-testid="input-height-max" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <SelectField control={form.control} name="education" label="Istruzione" options={educationOptions} placeholder="Il tuo livello di studi" testId="select-education" />
                    <SelectField control={form.control} name="preferredEducation" label="Istruzione Preferita" options={preferredEducationOptions} placeholder="Studi del partner ideale" testId="select-preferred-education" />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Star className="w-5 h-5 text-accent" />
                    Personalità e Stile
                  </div>
                    <SelectField control={form.control} name="zodiacSign" label="Segno Zodiacale" options={zodiacSignOptions} placeholder="Il tuo segno" testId="select-zodiac" />
                    <SelectField control={form.control} name="loveLanguage" label="Come Esprimi il Tuo Amore" options={loveLanguageOptions} placeholder="Il tuo linguaggio d'amore" testId="select-love-language" />
                    <div>
                      <FormLabel className="mb-3 block text-white font-semibold text-sm tracking-wide uppercase">Come Preferisci Comunicare</FormLabel>
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
                    <SelectField control={form.control} name="lifestyle" label="Stile di Vita" options={lifestyleOptions} placeholder="Come vivi la vita" testId="select-lifestyle" />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Search className="w-5 h-5 text-primary" />
                    Cosa Cerchi
                  </div>
                    <SelectField control={form.control} name="relationshipType" label="Tipo di Relazione" options={relationshipTypeOptions} placeholder="Cosa stai cercando" testId="select-relationship" />
                    <SelectField control={form.control} name="wantsChildren" label="Figli" options={wantsChildrenOptions} placeholder="Il tuo desiderio" testId="select-children" />
                    <SelectField control={form.control} name="accessMotivation" label="Perché Sei Qui" options={accessMotivationOptions} placeholder="La tua motivazione" testId="select-motivation" />

                    <div className="mt-6 pt-4 border-t border-white/15">
                      <p className="text-white font-semibold text-sm tracking-wide uppercase mb-3">Funzioni Extra</p>
                      <p className="text-white/70 text-sm mb-4">Attiva o disattiva queste funzioni opzionali per personalizzare la tua esperienza</p>
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
                            Prima Impressione
                          </p>
                          <p className="text-white/70 text-sm leading-relaxed">
                            Attiva per permettere agli altri di votarti da 1 a 5 sulla tua card. Vedrai tutti i voti ricevuti nella sezione dedicata "Prima Impressione".
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
                          <span className="text-xs text-green-400 font-medium">Attivo - Gli altri vedranno il pulsante "Vota" sulla tua card</span>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setLocationSharingEnabled(!locationSharingEnabled)}
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
                            Mostra Dove Sei
                          </p>
                          <p className="text-white/70 text-sm leading-relaxed">
                            Condividi la tua posizione con i tuoi Match. Solo chi ha un match con te e ha attivato questa opzione potrà vedere dove ti trovi su una mappa.
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
                            <span className="text-xs text-cyan-400 font-medium">Attivo - I tuoi match potranno vederti sulla mappa</span>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3 space-y-1">
                            <p className="text-white/80 text-xs font-medium">Come funziona:</p>
                            <p className="text-white/60 text-xs">1. Attiva questa opzione nel tuo profilo</p>
                            <p className="text-white/60 text-xs">2. Vai nella sezione "Dove Sei" dal menu</p>
                            <p className="text-white/60 text-xs">3. Tocca "Condividi Posizione" per iniziare</p>
                            <p className="text-white/60 text-xs">4. Solo i tuoi match con questa opzione attiva vedranno la tua posizione</p>
                            <p className="text-white/60 text-xs">5. Puoi interrompere la condivisione in qualsiasi momento</p>
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
                    Lingue e Bio
                  </div>
                    <div>
                      <FormLabel className="mb-1 block text-white font-semibold text-sm tracking-wide uppercase">Lingue Parlate</FormLabel>
                      <p className="text-white/70 text-sm mb-3">Seleziona tutte le lingue che parli per trovare persone compatibili</p>
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
                          <FormLabel className="text-white font-semibold text-sm tracking-wide uppercase">La Tua Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Racconta qualcosa di te..."
                              className="resize-none min-h-[120px] bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70"
                              {...field}
                              data-testid="input-bio"
                            />
                          </FormControl>
                          <div className="text-xs text-white/60 text-right">
                            {field.value?.length || 0}/500
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              )}

              {step === 6 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Sparkles className="w-5 h-5 text-accent" />
                    Interessi
                  </div>
                    <p className="text-sm text-white/70">
                      Seleziona fino a 10 interessi che ti rappresentano ({interests.length}/10)
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
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                      <Input
                        placeholder="Cerca interessi..."
                        value={interestSearch}
                        onChange={(e) => setInterestSearch(e.target.value)}
                        className="pl-9 bg-white/15 backdrop-blur-md border-white/25 text-white placeholder:text-white/70"
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
                className="gap-2"
                data-testid="button-prev-step"
              >
                <ArrowLeft className="w-4 h-4" />
                Indietro
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
                  className="text-white/60"
                  data-testid="button-skip-step"
                >
                  Salta
                </Button>
              )}

              {step < TOTAL_STEPS - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="gap-2"
                  data-testid="button-next-step"
                >
                  Avanti
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  {!existingProfile && (
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={isPending}
                      className="text-white/60"
                      onClick={() => { submitClickedRef.current = true; }}
                      data-testid="button-skip-save-profile"
                    >
                      Salta e Salva
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
                    {existingProfile ? "Salva Modifiche" : "Crea Profilo"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </form>
      </Form>
      </div>
    </div>
  );
}
