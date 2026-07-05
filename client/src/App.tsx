import { useState, useCallback, useEffect, Component, lazy, Suspense, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import PushSoundHandler from "@/components/PushSoundHandler";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoBackground } from "@/components/VideoBackground";
import { Header, BottomNav } from "@/components/Header";
import { SplashScreen } from "@/components/SplashScreen";
import { EmailVerificationGate } from "@/components/EmailVerificationGate";

const NotFound = lazy(() => import("@/pages/not-found"));
const Home = lazy(() => import("@/pages/home"));
const Matches = lazy(() => import("@/pages/matches"));
const Profile = lazy(() => import("@/pages/profile"));
const ProfileEdit = lazy(() => import("@/pages/profile-edit"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const Support = lazy(() => import("@/pages/support"));
const ChildSafety = lazy(() => import("@/pages/child-safety"));
const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const Chat = lazy(() => import("@/pages/chat"));
const Admin = lazy(() => import("@/pages/admin"));
const Rooms = lazy(() => import("@/pages/rooms"));
const Challenges = lazy(() => import("@/pages/challenges"));
const PrivateRooms = lazy(() => import("@/pages/private-rooms"));
const PrivateRoomDetail = lazy(() => import("@/pages/private-room-detail"));
const RoomDetail = lazy(() => import("@/pages/room-detail"));
const PrimaImpressione = lazy(() => import("@/pages/prima-impressione"));
const Vibing = lazy(() => import("@/pages/vibing"));
const VibrappChat = lazy(() => import("@/pages/vibrapp"));
const Signals = lazy(() => import("@/pages/signals"));
const LocationMap = lazy(() => import("@/pages/location-map"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const VideoUpload = lazy(() => import("@/pages/video-upload"));
const Favorites = lazy(() => import("@/pages/favorites"));
const PublicProfile = lazy(() => import("@/pages/public-profile"));
const Reels = lazy(() => import("@/pages/reels"));
const Blog = lazy(() => import("@/pages/blog"));
const VibraStory = lazy(() => import("@/pages/vibrastory"));
const VibraVault = lazy(() => import("@/pages/vibravault"));
const VibraQuests = lazy(() => import("@/pages/vibraquests"));
const Costellazioni = lazy(() => import("@/pages/costellazioni"));
const VibraLegacyPage = lazy(() => import("@/pages/vibralegacy"));
const VerifyEmail = lazy(() => import("@/pages/verify-email"));
import { useAuth } from "@/hooks/use-auth";
import { GuestProvider, useGuest } from "@/hooks/use-guest";
import { VibrappSocketProvider } from "@/contexts/VibrappSocketContext";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ViewportSelector } from "@/components/ViewportSelector";
import { VibraAI } from "@/components/VibraAI";
import { AlertTriangle, RefreshCw, Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useToast } from "@/hooks/use-toast";

const publicPages = ["/privacy", "/terms", "/child-safety", "/login", "/register", "/onboarding", "/forgot-password"];

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0118" }}>
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Qualcosa è andato storto</h2>
            <p className="text-white/60 mb-6">
              Prova a ricaricare l'app. Se il problema persiste, cancella la cache del browser.
            </p>
            <Button
              onClick={() => {
                if ('caches' in window) {
                  caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                  });
                }
                window.location.reload();
              }}
              className="w-full"
              data-testid="button-reload-app"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Ricarica App
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const DISMISS_KEY = "vibra-push-banner-dismissed";
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

function NotificationBanner() {
  // Auto-subscription now happens in the hook, banner is hidden
  // Users can manage notifications in profile settings instead
  return null;
}

function RedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/"); }, []);
  return null;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/child-safety" component={ChildSafety} />
      <Route path="/support" component={Support} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/login" component={RedirectHome} />
      <Route path="/register" component={RedirectHome} />
      <Route path="/forgot-password" component={RedirectHome} />
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/chat/:matchId" component={Chat} />
      <Route path="/profile" component={Profile} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/profile/edit" component={ProfileEdit} />
      <Route path="/profile/edit/:profileId" component={ProfileEdit} />
      <Route path="/admin" component={Admin} />
      <Route path="/rooms" component={Rooms} />
      <Route path="/room/:roomId" component={RoomDetail} />
      <Route path="/challenges" component={Challenges} />
      <Route path="/private-rooms" component={PrivateRooms} />
      <Route path="/private-room/:roomId" component={PrivateRoomDetail} />
      <Route path="/prima-impressione" component={PrimaImpressione} />
      <Route path="/vibing" component={Vibing} />
      <Route path="/vibrapp" component={VibrappChat} />
      <Route path="/signals" component={Signals} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/stories" component={VibraStory} />
      <Route path="/story/:id" component={VibraStory} />
      <Route path="/vault" component={VibraVault} />
      <Route path="/quests" component={VibraQuests} />
      <Route path="/constellations" component={Costellazioni} />
      <Route path="/legacy" component={VibraLegacyPage} />
      <Route path="/dove-sei" component={LocationMap} />
      <Route path="/video-upload" component={VideoUpload} />
      <Route path="/reels" component={Reels} />
      <Route path="/blog" component={Blog} />
      <Route path="/p/:profileId" component={PublicProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GuestRedirectHome() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/"); }, []);
  return null;
}

function GuestRedirectRooms() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/rooms"); }, []);
  return null;
}

function GuestRedirectPrivateRooms() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/private-rooms"); }, []);
  return null;
}

function GuestRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/child-safety" component={ChildSafety} />
      <Route path="/support" component={Support} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/chat/:matchId" component={GuestRedirectHome} />
      <Route path="/profile" component={Profile} />
      <Route path="/rooms" component={Rooms} />
      <Route path="/room/:roomId" component={GuestRedirectRooms} />
      <Route path="/challenges" component={Challenges} />
      <Route path="/private-rooms" component={PrivateRooms} />
      <Route path="/private-room/:roomId" component={GuestRedirectPrivateRooms} />
      <Route path="/prima-impressione" component={PrimaImpressione} />
      <Route path="/vibing" component={Vibing} />
      <Route path="/signals" component={Signals} />
      <Route path="/reels" component={Reels} />
      <Route path="/blog" component={Blog} />
      <Route path="/p/:profileId" component={PublicProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/child-safety" component={ChildSafety} />
      <Route path="/support" component={Support} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/blog" component={Blog} />
      <Route path="/p/:profileId" component={PublicProfile} />
      <Route path="/" component={Landing} />
      <Route component={Landing} />
    </Switch>
  );
}

const pagesWithOwnBackground = ["/login", "/register", "/forgot-password", "/", "/privacy", "/terms", "/onboarding", "/profile/edit", "/p/"];

function GuestBanner() {
  const { exitGuestMode } = useGuest();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-primary/90 to-accent/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-2" data-testid="guest-banner">
      <span className="text-xs text-white font-medium truncate">
        {t("guest.banner")}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="text-xs text-white border-white/40 shrink-0"
        onClick={() => {
          exitGuestMode();
          setLocation("/register");
          window.location.reload();
        }}
        data-testid="button-guest-register-banner"
      >
        {t("guest.registerBtn")}
      </Button>
    </div>
  );
}

function AppContent() {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { isGuest } = useGuest();

  // GA4 page tracking on every route change
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "page_view", {
        page_path: location,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [location]);
  const isPublicPage = publicPages.includes(location);
  const guestPublicPages = ["/login", "/register", "/privacy", "/terms"];
  const isGuestPublicPage = guestPublicPages.includes(location);
  const hideVideoBackground = pagesWithOwnBackground.includes(location) || (!isAuthenticated && !isGuest);

  const { data: myProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAuthenticated && !isGuest,
    retry: false,
  });


  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#0a0118", zIndex: 9998 }}>
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Email verification gate — authenticated but not verified (non-admin, non-bot)
  if (
    isAuthenticated &&
    user &&
    !user.isAdmin &&
    user.emailVerified === false &&
    location !== "/verify-email"
  ) {
    return (
      <EmailVerificationGate
        email={user.email || ""}
        onLogout={() => {
          fetch("/api/logout", { method: "POST", credentials: "include" }).then(() => {
            queryClient.setQueryData(["/api/auth/user"], null);
            window.location.href = "/";
          });
        }}
      />
    );
  }

  const pageFallback = (
    <div className="flex-1 flex items-center justify-center" style={{ background: "transparent" }}>
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (isGuest && !isAuthenticated) {
    if (isGuestPublicPage) {
      return <Suspense fallback={pageFallback}><UnauthenticatedRouter /></Suspense>;
    }

    return (
      <>
        <VideoBackground fallbackGradient={true} />
        <div className="h-full flex flex-col overflow-hidden">
          <GuestBanner />
          <Header />
          <main className="flex-1 flex flex-col overflow-hidden">
            <Suspense fallback={pageFallback}><GuestRouter /></Suspense>
          </main>
          <BottomNav />
        </div>
      </>
    );
  }

  if (!isAuthenticated && !isPublicPage) {
    return <Suspense fallback={pageFallback}><UnauthenticatedRouter /></Suspense>;
  }

  const showHeader = isAuthenticated && !isPublicPage && location !== "/profile/edit" && location !== "/video-upload";

  const content = (
    <>
      {!hideVideoBackground && <VideoBackground fallbackGradient={true} />}
      <div className="h-full flex flex-col overflow-hidden">
        {showHeader && <Header />}
        {isAuthenticated && !isPublicPage && <NotificationBanner />}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Suspense fallback={pageFallback}>
            {isAuthenticated ? <AuthenticatedRouter /> : <UnauthenticatedRouter />}
          </Suspense>
        </main>
        {showHeader && <BottomNav />}
      </div>
      {isAuthenticated && !isPublicPage && <VibraAI />}
    </>
  );

  // Wrap authenticated users with the global Vibrapp socket provider so DM
  // notifications (banner + sound) arrive on every page, not just /vibrapp.
  // Always render the provider when authenticated (empty profileId = no socket yet)
  if (isAuthenticated) {
    return (
      <VibrappSocketProvider profileId={myProfile?.id ?? ""}>
        {content}
      </VibrappSocketProvider>
    );
  }

  return content;
}

function App() {
  const currentPath = window.location.pathname;
  const [showSplash, setShowSplash] = useState(() => {
    // Mai mostrare la splash sui profili pubblici (/p/...)
    if (currentPath.startsWith("/p/")) return false;
    try {
      const seen = localStorage.getItem("vibra-splash-seen");
      return !seen;
    } catch {
      return false; // se localStorage non è disponibile, salta la splash
    }
  });

  useEffect(() => {
    const htmlSplash = document.getElementById("html-splash");
    if (htmlSplash) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          htmlSplash.style.opacity = "0";
          setTimeout(() => htmlSplash.remove(), 500);
        });
      });
    }
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    try { localStorage.setItem("vibra-splash-seen", "1"); } catch {}
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <GuestProvider>
              {showSplash ? (
                <SplashScreen onComplete={handleSplashComplete} />
              ) : (
                <ViewportSelector>
                  <AppContent />
                  <Toaster />
                  <PushSoundHandler />
                </ViewportSelector>
              )}
            </GuestProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
