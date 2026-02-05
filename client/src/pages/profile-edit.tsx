import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Sparkles, MapPin, User, Heart, ArrowLeft, Save, Plus, X, Users, Ruler, GraduationCap, Languages, Star, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  suggestedInterests,
  availableImages,
} from "@/lib/profile-options";
import type { Profile } from "@shared/schema";

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
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfileEdit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");

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
      });
      setInterests(existingProfile.interests || []);
      setLanguages(existingProfile.languages || []);
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
      toast({
        title: "Profilo Creato!",
        description: "Il tuo profilo è pronto per essere scoperto.",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile creare il profilo.",
        variant: "destructive",
      });
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
      toast({
        title: "Profilo Aggiornato!",
        description: "Le tue modifiche sono state salvate.",
      });
      setLocation("/profile");
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Non è stato possibile aggiornare il profilo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    if (interests.length === 0) {
      toast({
        title: "Aggiungi Interessi",
        description: "Aggiungi almeno un interesse al tuo profilo.",
        variant: "destructive",
      });
      return;
    }

    const profileData = { ...data, interests, languages };

    if (existingProfile) {
      updateMutation.mutate(profileData);
    } else {
      createMutation.mutate(profileData);
    }
  };

  const addInterest = (interest: string) => {
    if (interest.trim() && !interests.includes(interest.trim()) && interests.length < 8) {
      setInterests([...interests, interest.trim()]);
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      setLanguages(languages.filter((l) => l !== lang));
    } else {
      setLanguages([...languages, lang]);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 max-w-lg mx-auto pb-8 overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(existingProfile ? "/profile" : "/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{existingProfile ? "Modifica Profilo" : "Crea il Tuo Profilo"}</h1>
            <p className="text-sm text-muted-foreground">
              {existingProfile ? "Aggiorna le tue informazioni" : "Unisciti alla comunità"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Foto Profilo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Camera className="w-5 h-5 text-primary" />
                  Foto Profilo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
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
              </CardContent>
            </Card>

            {/* Informazioni Base */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-secondary" />
                  Informazioni Base
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Il tuo nome" {...field} data-testid="input-name" />
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
                        <FormLabel>Età</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="25" {...field} data-testid="input-age" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Genere</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {genderOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
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
                    name="preferredGender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cerco</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-preferred-gender">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {genderOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Posizione
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="La tua città" {...field} data-testid="input-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="alienType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Tipo Cosmico
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-alien-type">
                            <SelectValue placeholder="Seleziona il tuo tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {alienTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Aspetto Fisico */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ruler className="w-5 h-5 text-accent" />
                  Aspetto Fisico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hairColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colore Capelli</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-hair-color">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {hairColorOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
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
                    name="eyeColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colore Occhi</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-eye-color">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {eyeColorOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bodyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Corporatura</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-body-type">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bodyTypeOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
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
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Altezza (cm)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="175" {...field} data-testid="input-height" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preferenze Partner */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-primary" />
                  Preferenze Partner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="preferredAgeMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Età Min</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="18" {...field} data-testid="input-age-min" />
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
                        <FormLabel>Età Max</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="40" {...field} data-testid="input-age-max" />
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
                        <FormLabel>Altezza Min (cm)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="150" {...field} data-testid="input-height-min" />
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
                        <FormLabel>Altezza Max (cm)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="200" {...field} data-testid="input-height-max" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="preferredEducation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Istruzione Preferita</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-preferred-education">
                            <SelectValue placeholder="Qualsiasi" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {educationOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Personalità e Stile */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="w-5 h-5 text-secondary" />
                  Personalità e Stile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="zodiacSign"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segno Zodiacale</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-zodiac">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {zodiacSignOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
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
                    name="education"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Istruzione</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-education">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {educationOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="loveLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Come Esprimi l'Amore</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-love-language">
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loveLanguageOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="communicationStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stile Comunicativo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-communication">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {communicationStyleOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
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
                    name="lifestyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stile di Vita</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lifestyle">
                              <SelectValue placeholder="Seleziona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {lifestyleOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Relazione */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="w-5 h-5 text-accent" />
                  Cosa Cerchi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="relationshipType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo di Relazione</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-relationship">
                            <SelectValue placeholder="Cosa stai cercando?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {relationshipTypeOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
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
                  name="wantsChildren"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vuoi Figli?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-children">
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {wantsChildrenOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
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
                  name="accessMotivation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Perché sei qui?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-motivation">
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accessMotivationOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Lingue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Languages className="w-5 h-5 text-primary" />
                  Lingue Parlate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {languageOptions.map((lang) => (
                    <Badge
                      key={lang}
                      variant={languages.includes(lang) ? "default" : "outline"}
                      className="cursor-pointer hover-elevate"
                      onClick={() => toggleLanguage(lang)}
                      data-testid={`badge-language-${lang}`}
                    >
                      {lang}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Bio e Interessi */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageCircle className="w-5 h-5 text-accent" />
                  Chi Sei
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Racconta qualcosa di te..."
                          className="min-h-[120px] resize-none"
                          {...field}
                          data-testid="input-bio"
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground text-right">{field.value?.length || 0}/500</div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel className="mb-3 block">Interessi ({interests.length}/8)</FormLabel>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {interests.map((interest) => (
                      <Badge key={interest} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                        {interest}
                        <button
                          type="button"
                          onClick={() => removeInterest(interest)}
                          className="ml-1 hover:bg-muted rounded p-0.5"
                          data-testid={`button-remove-interest-${interest}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-3">
                    <Input
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      placeholder="Aggiungi interesse..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addInterest(newInterest);
                        }
                      }}
                      disabled={interests.length >= 8}
                      data-testid="input-new-interest"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => addInterest(newInterest)}
                      disabled={interests.length >= 8 || !newInterest.trim()}
                      data-testid="button-add-interest"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {suggestedInterests
                      .filter((i) => !interests.includes(i))
                      .slice(0, 8)
                      .map((interest) => (
                        <Badge
                          key={interest}
                          variant="outline"
                          className="cursor-pointer hover-elevate text-xs"
                          onClick={() => addInterest(interest)}
                          data-testid={`badge-suggested-${interest}`}
                        >
                          + {interest}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-12 text-lg" disabled={isPending} data-testid="button-save-profile">
              {isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Salvataggio...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-5 h-5" />
                  {existingProfile ? "Salva Modifiche" : "Crea Profilo"}
                </span>
              )}
            </Button>
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
