import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import {
  Heart,
  MessageCircle,
  Users,
  Camera,
  Gift,
  Lock,
  Star,
  MapPin,
  Zap,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Rocket,
  ArrowLeft,
} from "lucide-react";

const featureIcons = [Heart, MessageCircle, Users, Lock, Camera, Gift, Star, Zap, MapPin, UserCheck];
const featureColors = [
  { color: "text-pink-400", bg: "bg-pink-500/20" },
  { color: "text-cyan-400", bg: "bg-cyan-500/20" },
  { color: "text-blue-400", bg: "bg-blue-500/20" },
  { color: "text-purple-400", bg: "bg-purple-500/20" },
  { color: "text-amber-400", bg: "bg-amber-500/20" },
  { color: "text-rose-400", bg: "bg-rose-500/20" },
  { color: "text-yellow-400", bg: "bg-yellow-500/20" },
  { color: "text-green-400", bg: "bg-green-500/20" },
  { color: "text-orange-400", bg: "bg-orange-500/20" },
  { color: "text-teal-400", bg: "bg-teal-500/20" },
];

const ITEMS_PER_PAGE = 4;
const totalPages = Math.ceil(featureIcons.length / ITEMS_PER_PAGE);

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(0);
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const { data: existingProfile } = useQuery<any>({
    queryKey: ["/api/profiles/me"],
    enabled: isAuthenticated,
  });
  const hasProfile = !!existingProfile;

  const features = featureIcons.map((icon, i) => ({
    icon,
    title: t(`onboarding.feature${i + 1}Title`),
    description: t(`onboarding.feature${i + 1}Desc`),
    ...featureColors[i],
  }));

  const currentFeatures = features.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  const isLastPage = page === totalPages - 1;

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="fixed inset-0 z-0">
        <img
          src="/images/onboarding-bg.gif"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/75 to-black/85" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col p-5 pb-8 overflow-y-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(isAuthenticated ? "/profile" : "/landing")}
          className="absolute top-4 left-4 z-20 text-white bg-black/30 backdrop-blur-sm"
          data-testid="button-back-from-onboarding"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 mt-4"
        >
          <h1
            className="text-3xl font-bold text-white drop-shadow-lg"
            data-testid="text-onboarding-title"
          >
            {t("onboarding.welcome")}
          </h1>
          <p className="text-white/80 mt-1 text-base drop-shadow-md">
            {t("onboarding.welcomeDesc")}
          </p>
          <div className="flex justify-center gap-2 mt-3">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === page ? "w-8 bg-cyan-400" : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="flex-1 space-y-3"
          >
            {currentFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="flex items-start gap-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 p-4"
                  data-testid={`card-feature-${index + page * ITEMS_PER_PAGE}`}
                >
                  <div
                    className={`shrink-0 w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-[15px] leading-tight drop-shadow-sm">
                      {feature.title}
                    </h3>
                    <p className="text-white/80 text-sm leading-snug mt-0.5 drop-shadow-sm">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center gap-3">
          {page > 0 && (
            <Button
              variant="outline"
              onClick={() => setPage(page - 1)}
              className="border-white/20 text-white bg-black/30 backdrop-blur-sm"
              data-testid="button-onboarding-prev"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t("onboarding.back")}
            </Button>
          )}

          <div className="flex-1" />

          {isLastPage ? (
            <div className="flex flex-col items-end gap-2">
              <Button
                onClick={() => setLocation(
                  !isAuthenticated ? "/register" : 
                  hasProfile ? "/profile" : "/profile/edit"
                )}
                className="bg-gradient-to-r from-primary to-accent text-white px-6"
                data-testid="button-onboarding-start"
              >
                <Rocket className="w-4 h-4 mr-2" />
                {!isAuthenticated ? t("onboarding.registerNow") : 
                 hasProfile ? t("onboarding.backToProfile") : t("onboarding.createProfile")}
              </Button>
              <span className="text-white/40 text-[11px] italic" data-testid="text-created-by">
                Created by Fabio Mattoni
              </span>
            </div>
          ) : (
            <Button
              onClick={() => setPage(page + 1)}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6"
              data-testid="button-onboarding-next"
            >
              {t("onboarding.next")}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
