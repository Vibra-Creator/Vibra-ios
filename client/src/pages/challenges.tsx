import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Camera, Star, Upload, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { DailyChallenge } from "@shared/schema";

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

  const { data: challenges, isLoading } = useQuery<DailyChallenge[]>({
    queryKey: ["/api/challenges"],
    enabled: !!user,
  });

  const defaultChallenges: DailyChallenge[] = [
    { id: "1", title: "Truccato/a da Donna", description: "Scatta una foto di te stesso truccato da donna - mostra il tuo lato divertente!", points: 20, isActive: true, imageExample: null },
    { id: "2", title: "Pulizia Bagno", description: "Fotografati mentre pulisci il bagno - dimostra che sai essere responsabile!", points: 15, isActive: true, imageExample: null },
    { id: "3", title: "Chef per un Giorno", description: "Prepara un piatto e fotografalo - mostra le tue abilità culinarie!", points: 15, isActive: true, imageExample: null },
    { id: "4", title: "Animale Domestico", description: "Scatta un selfie con un animale - mostra il tuo lato dolce!", points: 10, isActive: true, imageExample: null },
    { id: "5", title: "Tramonto Romantico", description: "Fotografa un tramonto dalla tua posizione - condividi la bellezza!", points: 10, isActive: true, imageExample: null },
    { id: "6", title: "Talento Nascosto", description: "Mostra un tuo talento nascosto in foto - sorprendici!", points: 25, isActive: true, imageExample: null },
    { id: "7", title: "Look del Mattino", description: "Selfie appena sveglio/a senza filtri - sii autentico/a!", points: 20, isActive: true, imageExample: null },
    { id: "8", title: "Outfit Creativo", description: "Indossa qualcosa di creativo o divertente e fotografati!", points: 15, isActive: true, imageExample: null },
  ];

  const displayChallenges = challenges?.length ? challenges : defaultChallenges;

  const handleSubmitChallenge = (challengeId: string) => {
    toast({
      title: "Funzionalità in arrivo!",
      description: "Presto potrai caricare le tue foto per le sfide.",
    });
  };

  return (
    <div className="flex-1 p-4 pb-8 overflow-y-auto">
      <div className="fixed inset-0 -z-10">
        <img src="/backgrounds/vibra-hero.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>
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
            <h1 className="text-2xl font-bold" data-testid="text-challenges-title">Sfide Giornaliere</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-challenges-subtitle">Completa le sfide per guadagnare punti!</p>
          </div>
        </div>
      </motion.div>

      <Card className="mb-6 bg-gradient-to-r from-primary/20 to-accent/20 border-primary/30" data-testid="card-user-points">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-accent" />
            <div>
              <p className="font-bold text-lg" data-testid="text-points-label">I tuoi punti</p>
              <p className="text-sm text-muted-foreground">Completa sfide per salire in classifica</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-accent" data-testid="text-points-value">0</div>
        </CardContent>
      </Card>

      {isLoading ? (
        <ChallengeSkeleton />
      ) : (
        <div className="space-y-4">
          {displayChallenges.map((challenge, index) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="overflow-hidden hover-elevate" data-testid={`card-challenge-${challenge.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-accent/20 text-accent">
                          <Star className="w-3 h-3 mr-1" />
                          {challenge.points} punti
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Oggi
                        </Badge>
                      </div>
                      <h3 className="font-bold text-lg mb-1">{challenge.title}</h3>
                      <p className="text-sm text-muted-foreground">{challenge.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1 shrink-0"
                      onClick={() => handleSubmitChallenge(challenge.id)}
                      data-testid={`button-submit-challenge-${challenge.id}`}
                    >
                      <Camera className="w-4 h-4" />
                      Partecipa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
