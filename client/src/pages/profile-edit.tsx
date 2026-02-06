import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Sparkles, MapPin, User, Heart, ArrowLeft, ArrowRight, Save, Ruler, Languages, Star, Search, Check, Phone, ImagePlus, X, Loader2, UserCircle } from "lucide-react";
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
import {
  genderOptions,
  hairColorOptions,
  eyeColorOptions,
  bodyTypeOptions,
  educationOptions,
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


const profileFormSchema = z.object({
  name: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
  age: z.coerce.number().min(18, "Devi avere almeno 18 anni").max(120, "Età massima 120"),
  bio: z.string().min(10, "La bio deve avere almeno 10 caratteri").max(500, "Massimo 500 caratteri"),
  location: z.string().min(2, "Inserisci una posizione valida"),
  alienType: z.string().min(1, "Seleziona un tipo"),
  imageUrl: z.string().min(1, "Seleziona un'immagine"),
  gender: z.string().optional(),
  preferredGender: z.string().optional(),
  hairColor: z.string().optional(),
  eyeColor: z.string().optional(),
  bodyType: z.string().optional(),
  height: z.coerce.number().min(100).max(250).optional().or(z.literal("")),
  preferredHeightMin: z.coerce.number().min(100).max(250).optional().or(z.literal("")),
  preferredHeightMax: z.coerce.number().min(100).max(250).optional().or(z.literal("")),
  preferredAgeMin: z.coerce.number().min(18).max(120).optional().or(z.literal("")),
  preferredAgeMax: z.coerce.number().min(18).max(120).optional().or(z.literal("")),
  education: z.string().optional(),
  preferredEducation: z.string().optional(),
  relationshipType: z.string().optional(),
  wantsChildren: z.string().optional(),
  zodiacSign: z.string().optional(),
  loveLanguage: z.string().optional(),
  communicationStyle: z.string().optional(),
  lifestyle: z.string().optional(),
  accessMotivation: z.string().optional(),
  phonePrefix: z.string().optional(),
  phoneNumber: z.string().optional(),
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
          <FormLabel className="text-white/90 text-base">{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger className="bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid={testId}>
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
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [communicationStyles, setCommunicationStyles] = useState<string[]>([]);
  const [interestSearch, setInterestSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    if (existingProfile) {
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
    }
  }, [existingProfile, form]);

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
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile creare il profilo.", variant: "destructive" });
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
    onError: () => {
      toast({ title: "Errore", description: "Non è stato possibile aggiornare il profilo.", variant: "destructive" });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    if (interests.length === 0) {
      toast({ title: "Aggiungi Interessi", description: "Aggiungi almeno un interesse al tuo profilo.", variant: "destructive" });
      return;
    }
    const profileData = { ...data, interests, languages, communicationStyle: communicationStyles.join(",") };
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
      const valid = await form.trigger(["name", "age", "location", "gender", "preferredGender", "alienType", "imageUrl"]);
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

    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato non valido", description: "Seleziona un'immagine (JPG, PNG, WebP)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File troppo grande", description: "L'immagine deve essere inferiore a 10MB", variant: "destructive" });
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
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setUploadedPhotos(data.photos);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      toast({ title: "Foto caricata!", description: "La tua foto è stata aggiunta al profilo." });
    } catch {
      toast({ title: "Errore", description: "Impossibile caricare la foto", variant: "destructive" });
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
    <div className="flex-1 p-4 max-w-lg mx-auto pb-8 overflow-y-auto text-[16px]">
      <div className="fixed inset-0 -z-10">
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>
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
      </div>

      <StepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
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
                          <FormLabel className="flex items-center gap-2 text-white/90 text-base">
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
                      <FormLabel className="flex items-center gap-2 text-white/90 text-base mb-3">
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
                            className="aspect-square rounded-xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-1 text-white/50 hover:border-primary/50 hover:text-primary transition-colors"
                            data-testid="button-add-photo"
                          >
                            {isUploadingPhoto ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <>
                                <Camera className="w-6 h-6" />
                                <span className="text-xs">Aggiungi</span>
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
                            <FormLabel className="text-white/90 text-base">Nome</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" placeholder="Il tuo nome" {...field} data-testid="input-name" />
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
                            <FormLabel className="text-white/90 text-base">Età</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" type="number" placeholder="25" {...field} data-testid="input-age" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="gender" label="Genere" options={genderOptions} testId="select-gender" />
                      <SelectField control={form.control} name="preferredGender" label="Cerco" options={genderOptions} testId="select-preferred-gender" />
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
                            <FormLabel className="flex items-center gap-2 text-white/90 text-base">
                              <MapPin className="w-4 h-4" />
                              Citta
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
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

                    <div className="space-y-2">
                      <FormLabel className="flex items-center gap-2 text-white/90 text-base">
                        <Phone className="w-4 h-4" />
                        Telefono
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="phonePrefix"
                          render={({ field }) => (
                            <FormItem className="w-[140px]">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-white/10 backdrop-blur-sm border-white/20 text-white" data-testid="select-phone-prefix">
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
                                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
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
                    </div>

                    <SelectField control={form.control} name="alienType" label="Tipo Cosmico" options={alienTypes} testId="select-alien-type" placeholder="Seleziona il tuo tipo" />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Ruler className="w-5 h-5 text-accent" />
                    Aspetto Fisico
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="hairColor" label="Colore Capelli" options={hairColorOptions} testId="select-hair-color" />
                      <SelectField control={form.control} name="eyeColor" label="Colore Occhi" options={eyeColorOptions} testId="select-eye-color" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <SelectField control={form.control} name="bodyType" label="Corporatura" options={bodyTypeOptions} testId="select-body-type" />
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/90 text-base">Altezza (cm)</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" type="number" placeholder="175" {...field} data-testid="input-height" />
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
                            <FormLabel className="text-white/90 text-base">Età Min</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" type="number" placeholder="18" {...field} data-testid="input-age-min" />
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
                            <FormLabel className="text-white/90 text-base">Età Max</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" type="number" placeholder="40" {...field} data-testid="input-age-max" />
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
                            <FormLabel className="text-white/90 text-base">Altezza Min (cm)</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" type="number" placeholder="150" {...field} data-testid="input-height-min" />
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
                            <FormLabel className="text-white/90 text-base">Altezza Max (cm)</FormLabel>
                            <FormControl>
                              <Input className="bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40" type="number" placeholder="190" {...field} data-testid="input-height-max" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <SelectField control={form.control} name="education" label="Istruzione" options={educationOptions} testId="select-education" />
                    <SelectField control={form.control} name="preferredEducation" label="Istruzione Preferita" options={educationOptions} testId="select-preferred-education" />
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Star className="w-5 h-5 text-accent" />
                    Personalità e Stile
                  </div>
                    <SelectField control={form.control} name="zodiacSign" label="Segno Zodiacale" options={zodiacSignOptions} testId="select-zodiac" />
                    <SelectField control={form.control} name="loveLanguage" label="Come Esprimi il Tuo Amore" options={loveLanguageOptions} testId="select-love-language" />
                    <div>
                      <FormLabel className="mb-3 block text-white/90 text-base">Come Preferisci Comunicare</FormLabel>
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
                    <SelectField control={form.control} name="lifestyle" label="Stile di Vita" options={lifestyleOptions} testId="select-lifestyle" />
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Search className="w-5 h-5 text-primary" />
                    Cosa Cerchi
                  </div>
                    <SelectField control={form.control} name="relationshipType" label="Tipo di Relazione" options={relationshipTypeOptions} testId="select-relationship" />
                    <SelectField control={form.control} name="wantsChildren" label="Figli" options={wantsChildrenOptions} testId="select-children" />
                    <SelectField control={form.control} name="accessMotivation" label="Perché Sei Qui" options={accessMotivationOptions} testId="select-motivation" />
                </div>
              )}

              {step === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xl font-semibold text-white">
                    <Languages className="w-5 h-5 text-secondary" />
                    Lingue e Bio
                  </div>
                    <div>
                      <FormLabel className="mb-3 block text-white/90 text-base">Lingue Parlate</FormLabel>
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
                          <FormLabel className="text-white/90 text-base">La Tua Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Racconta qualcosa di te..."
                              className="resize-none min-h-[120px] bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
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
                    <p className="text-sm text-white/60">
                      Seleziona fino a 10 interessi ({interests.length}/10)
                    </p>

                    {interests.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
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
                        className="pl-9 bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder:text-white/40"
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
                            className={`flex items-center gap-2 p-3 rounded-lg text-left text-sm transition-all border ${
                              isSelected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border hover:border-muted-foreground/50"
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
              <Button
                type="submit"
                disabled={isPending}
                className="gap-2"
                data-testid="button-save-profile"
              >
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {existingProfile ? "Salva Modifiche" : "Crea Profilo"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
