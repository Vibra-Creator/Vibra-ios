import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, ShieldCheck, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface OnboardingSlide {
  icon: typeof Heart;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: Sparkles,
    title: "Swipe & Match",
    description: "Scorri i profili e trova chi vibra con te. Un like reciproco crea una connessione speciale.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: MessageCircle,
    title: "Chat & Connessioni",
    description: "Chatta con chi hai matchato e crea legami autentici. Ogni conversazione può essere l'inizio di qualcosa di speciale.",
    color: "from-cyan-500 to-blue-500"
  },
  {
    icon: ShieldCheck,
    title: "Profili Verificati",
    description: "Ogni profilo è verificato. Vibra è uno spazio sicuro dove puoi essere te stesso.",
    color: "from-green-500 to-emerald-500"
  }
];

export default function Onboarding() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [, setLocation] = useLocation();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      localStorage.setItem("vibra_onboarding_complete", "true");
      setLocation("/login");
    }
  };

  const handleSkip = () => {
    localStorage.setItem("vibra_onboarding_complete", "true");
    setLocation("/login");
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background via-background to-card">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-skip-onboarding"
        >
          Salta
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center"
          >
            <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${slide.color} flex items-center justify-center mb-8`}
                 style={{ boxShadow: "0 0 40px rgba(139, 92, 246, 0.4)" }}>
              <Icon className="w-14 h-14 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-4">
              {slide.title}
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide
                  ? "bg-primary w-8"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              data-testid={`dot-slide-${index}`}
            />
          ))}
        </div>

        <Button
          onClick={handleNext}
          className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90"
          data-testid="button-next-onboarding"
        >
          {currentSlide < slides.length - 1 ? (
            <>
              Avanti
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          ) : (
            "Entra in Vibrazione"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Nessun costo dopo l'iscrizione
        </p>
      </div>
    </div>
  );
}
