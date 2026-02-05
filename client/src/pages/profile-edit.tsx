import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Sparkles, MapPin, User, Heart, ArrowLeft, Save, Plus, X } from "lucide-react";
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
import type { Profile } from "@shared/schema";

const CURRENT_USER_ID = "user-1";

const alienTypes = [
  "Nebulare",
  "Cristallino", 
  "Biotico",
  "Dimensionale",
  "Solare",
  "Viaggiatore Stellare",
  "Quantico",
  "Etereo",
];

const profileFormSchema = z.object({
  name: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
  age: z.coerce.number().min(18, "Devi avere almeno 18 anni cosmici").max(999, "Età massima 999"),
  bio: z.string().min(10, "La bio deve avere almeno 10 caratteri").max(500, "Massimo 500 caratteri"),
  location: z.string().min(2, "Inserisci una posizione valida"),
  alienType: z.string().min(1, "Seleziona un tipo alieno"),
  imageUrl: z.string().min(1, "Seleziona un'immagine"),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const availableImages = [
  "/images/profile-1.png",
  "/images/profile-2.png",
  "/images/profile-3.png",
  "/images/profile-4.png",
  "/images/profile-5.png",
];

const suggestedInterests = [
  "Esplorazione Spaziale",
  "Musica Cosmica",
  "Filosofia Galattica",
  "Ologrammi",
  "Danza Luminescente",
  "Navigazione Stellare",
  "Poesia Quantica",
  "Arte Cristallina",
  "Meditazione Cosmica",
  "Botanica Aliena",
  "Viaggi Dimensionali",
  "Fisica Quantistica",
  "Aurora Boreale",
  "Energie Luminose",
  "Telepatia",
  "Alchimia Stellare",
];

export default function ProfileEdit() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");

  const { data: existingProfile, isLoading } = useQuery<Profile | null>({
    queryKey: ["/api/my-profile", CURRENT_USER_ID],
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
      });
      setInterests(existingProfile.interests || []);
    }
  }, [existingProfile, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ProfileFormValues & { interests: string[] }) => {
      return apiRequest("POST", "/api/profiles", {
        ...data,
        userId: CURRENT_USER_ID,
        interests: data.interests,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-profile", CURRENT_USER_ID] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Profilo Creato!",
        description: "Il tuo profilo cosmico è pronto per essere scoperto.",
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
    mutationFn: async (data: ProfileFormValues & { interests: string[] }) => {
      return apiRequest("PUT", `/api/profiles/${existingProfile!.id}`, {
        ...data,
        interests: data.interests,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-profile", CURRENT_USER_ID] });
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

    const profileData = { ...data, interests };
    
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
    setInterests(interests.filter(i => i !== interest));
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
    <div className="flex-1 p-4 max-w-lg mx-auto pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
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
            <h1 className="text-2xl font-bold">
              {existingProfile ? "Modifica Profilo" : "Crea il Tuo Profilo"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {existingProfile ? "Aggiorna le tue informazioni cosmiche" : "Unisciti alla comunità galattica"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                              <img
                                src={img}
                                alt={`Avatar ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-secondary" />
                  Informazioni Base
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Il tuo nome cosmico"
                          {...field}
                          data-testid="input-name"
                        />
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
                      <FormLabel>Età (anni cosmici)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="25"
                          {...field}
                          data-testid="input-age"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Posizione Galattica
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nebulosa di Orione"
                          {...field}
                          data-testid="input-location"
                        />
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
                        Tipo Alieno
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="w-5 h-5 text-accent" />
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
                          placeholder="Racconta qualcosa di te... Cosa ti rende unico nell'universo?"
                          className="min-h-[120px] resize-none"
                          {...field}
                          data-testid="input-bio"
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground text-right">
                        {field.value?.length || 0}/500
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel className="mb-3 block">Interessi ({interests.length}/8)</FormLabel>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {interests.map((interest) => (
                      <Badge
                        key={interest}
                        variant="secondary"
                        className="pl-3 pr-1 py-1 gap-1"
                      >
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

            <Button
              type="submit"
              className="w-full h-12 text-lg"
              disabled={isPending}
              data-testid="button-save-profile"
            >
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
