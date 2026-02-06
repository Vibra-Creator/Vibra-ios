import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Camera, Star, CheckCircle, Clock, ImagePlus, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { DailyChallenge, ChallengeSubmission } from "@shared/schema";

function ChallengeSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}

export default function Challenges() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingChallengeId, setUploadingChallengeId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: challenges, isLoading } = useQuery<DailyChallenge[]>({
    queryKey: ["/api/challenges"],
    enabled: !!user,
  });

  const { data: submissions } = useQuery<ChallengeSubmission[]>({
    queryKey: ["/api/challenges/submissions/me"],
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ challengeId, file }: { challengeId: string; file: File }) => {
      const formData = new FormData();
      formData.append("photo", file);
      const response = await fetch(`/api/challenges/${challengeId}/submit`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Foto caricata!",
        description: "La tua foto per la sfida e' stata inviata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/submissions/me"] });
      resetUpload();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare la foto",
        variant: "destructive",
      });
    },
  });

  const defaultChallenges: DailyChallenge[] = [
    { id: "1", title: "Truccato/a da Donna", description: "Scatta una foto di te stesso truccato da donna - mostra il tuo lato divertente!", points: 20, isActive: true, imageExample: null },
    { id: "2", title: "Pulizia Bagno", description: "Fotografati mentre pulisci il bagno - dimostra che sai essere responsabile!", points: 15, isActive: true, imageExample: null },
    { id: "3", title: "Chef per un Giorno", description: "Prepara un piatto e fotografalo - mostra le tue abilita' culinarie!", points: 15, isActive: true, imageExample: null },
    { id: "4", title: "Animale Domestico", description: "Scatta un selfie con un animale - mostra il tuo lato dolce!", points: 10, isActive: true, imageExample: null },
    { id: "5", title: "Tramonto Romantico", description: "Fotografa un tramonto dalla tua posizione - condividi la bellezza!", points: 10, isActive: true, imageExample: null },
    { id: "6", title: "Talento Nascosto", description: "Mostra un tuo talento nascosto in foto - sorprendici!", points: 25, isActive: true, imageExample: null },
    { id: "7", title: "Look del Mattino", description: "Selfie appena sveglio/a senza filtri - sii autentico/a!", points: 20, isActive: true, imageExample: null },
    { id: "8", title: "Outfit Creativo", description: "Indossa qualcosa di creativo o divertente e fotografati!", points: 15, isActive: true, imageExample: null },
  ];

  const displayChallenges = challenges?.length ? challenges : defaultChallenges;

  const getSubmissionForChallenge = (challengeId: string) => {
    return submissions?.find(s => s.challengeId === challengeId);
  };

  const handleSelectPhoto = (challengeId: string) => {
    setUploadingChallengeId(challengeId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato non valido",
        description: "Seleziona un file immagine (JPG, PNG, WebP, GIF)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File troppo grande",
        description: "L'immagine deve essere inferiore a 10MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleConfirmUpload = () => {
    if (!selectedFile || !uploadingChallengeId) return;
    submitMutation.mutate({ challengeId: uploadingChallengeId, file: selectedFile });
  };

  const resetUpload = () => {
    setUploadingChallengeId(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalPoints = submissions?.reduce((sum, s) => {
    const challenge = displayChallenges.find(c => c.id === s.challengeId);
    return sum + (challenge?.points || 0);
  }, 0) || 0;

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto">
      <div className="fixed inset-0 -z-10">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="/backgrounds/vibra-video-1.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-challenge-photo"
      />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-challenges-title">Sfide Giornaliere</h1>
            <p className="text-sm text-white/60" data-testid="text-challenges-subtitle">Completa le sfide per guadagnare punti!</p>
          </div>
        </div>
      </motion.div>

      <div className="rounded-xl p-4 flex items-center justify-between gap-4 mb-6" data-testid="card-user-points">
        <div className="flex items-center gap-3">
          <Star className="w-8 h-8 text-accent" />
          <div>
            <p className="font-bold text-lg text-white" data-testid="text-points-label">I tuoi punti</p>
            <p className="text-sm text-white/70">
              {submissions?.length || 0} sfide completate
            </p>
          </div>
        </div>
        <div className="text-3xl font-bold text-accent" data-testid="text-points-value">{totalPoints}</div>
      </div>

      {previewUrl && uploadingChallengeId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <div className="rounded-xl p-4" data-testid="card-photo-preview">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">Anteprima Foto</h3>
              <Button size="icon" variant="ghost" onClick={resetUpload} data-testid="button-cancel-upload">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="aspect-square rounded-lg overflow-hidden mb-4 max-w-xs mx-auto">
              <img
                src={previewUrl}
                alt="Anteprima"
                className="w-full h-full object-cover"
                data-testid="img-photo-preview"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetUpload}
                disabled={submitMutation.isPending}
                data-testid="button-change-photo"
              >
                Cambia foto
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmUpload}
                disabled={submitMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Invia Foto
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {isLoading ? (
        <ChallengeSkeleton />
      ) : (
        <div className="space-y-4">
          {displayChallenges.map((challenge, index) => {
            const submission = getSubmissionForChallenge(challenge.id);
            const isCompleted = !!submission;

            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={`rounded-xl p-4 overflow-hidden ${isCompleted ? "" : ""}`}
                  data-testid={`card-challenge-${challenge.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="secondary" className="bg-accent/20 text-accent">
                          <Star className="w-3 h-3 mr-1" />
                          {challenge.points} punti
                        </Badge>
                        {isCompleted ? (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completata
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Oggi
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-lg text-white mb-1">{challenge.title}</h3>
                      <p className="text-sm text-white/70">{challenge.description}</p>
                    </div>

                    {isCompleted ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                        <img
                          src={submission.imageUrl}
                          alt="Submission"
                          className="w-full h-full object-cover"
                          data-testid={`img-submission-${challenge.id}`}
                        />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 shrink-0"
                        onClick={() => handleSelectPhoto(challenge.id)}
                        disabled={submitMutation.isPending}
                        data-testid={`button-submit-challenge-${challenge.id}`}
                      >
                        <ImagePlus className="w-4 h-4" />
                        Carica Foto
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
