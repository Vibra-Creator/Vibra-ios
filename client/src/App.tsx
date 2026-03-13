import { useState, useCallback, useEffect, Component, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import PushSoundHandler from "@/components/PushSoundHandler";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoBackground } from "@/components/VideoBackground";
import { Header, BottomNav } from "@/components/Header";
import { SplashScreen } from "@/components/SplashScreen";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Matches from "@/pages/matches";
import Profile from "@/pages/profile";
import ProfileEdit from "@/pages/profile-edit";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Support from "@/pages/support";
import ChildSafety from "@/pages/child-safety";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Chat from "@/pages/chat";
import Admin from "@/pages/admin";
import Rooms from "@/pages/rooms";
import Challenges from "@/pages/challenges";
import PrivateRooms from "@/pages/private-rooms";
import PrivateRoomDetail from "@/pages/private-room-detail";
import RoomDetail from "@/pages/room-detail";
import PrimaImpressione from "@/pages/prima-impressione";
import Vibing from "@/pages/vibing";
import VibrappChat from "@/pages/vibrapp";
import Signals from "@/pages/signals";
import LocationMap from "@/pages/location-map";
import Onboarding from "@/pages/onboarding";
import ForgotPassword from "@/pages/forgot-password";
import VideoUpload from "@/pages/video-upload";
import { useAuth } from "@/hooks/use-auth";
import { GuestProvider, useGuest } from "@/hooks/use-guest";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { ViewportSelector } from "@/components/ViewportSelector";
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
  const { isSupported, isSubscribed, permission, subscribe } = usePushNotifications();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(() => {
    const val = localStorage.getItem(DISMISS_KEY);
    if (!val) return false;
    return Date.now() - parseInt(val, 10) < DISMISS_DURATION_MS;
  });

  if (!isSupported || isSubscribed || permission === "denied" || dismissed) return null;

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notifiche attivate!", description: "Riceverai avvisi per messaggi e risposte anche con l'app chiusa." });
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/80 border-b border-purple-500/30 backdrop-blur-sm z-50" data-testid="banner-push-notifications">
      <Bell className="w-4 h-4 text-purple-300 shrink-0" />
      <p className="flex-1 text-xs text-white/80">Attiva le notifiche per ricevere messaggi anche con l'app chiusa</p>
      <Button
        size="sm"
        className="text-xs h-7 px-3 bg-purple-600 hover:bg-purple-500 text-white shrink-0"
        onClick={handleEnable}
        data-testid="button-banner-enable-push"
      >
        Attiva
      </Button>
      <button onClick={handleDismiss} className="text-white/50 hover:text-white/80 shrink-0" data-testid="button-banner-dismiss-push">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
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
      <Route path="/login" component={RedirectHome} />
      <Route path="/register" component={RedirectHome} />
      <Route path="/forgot-password" component={RedirectHome} />
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/chat/:matchId" component={Chat} />
      <Route path="/profile" component={Profile} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/profile/edit" component={ProfileEdit} />
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
      <Route path="/dove-sei" component={LocationMap} />
      <Route path="/video-upload" component={VideoUpload} />
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
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/" component={Landing} />
      <Route component={Landing} />
    </Switch>
  );
}

const pagesWithOwnBackground = ["/login", "/register", "/forgot-password", "/", "/privacy", "/terms", "/onboarding", "/profile/edit"];

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
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isGuest && !isAuthenticated) {
    if (isGuestPublicPage) {
      return <UnauthenticatedRouter />;
    }

    return (
      <>
        <VideoBackground fallbackGradient={true} />
        <div className="h-full flex flex-col overflow-hidden">
          <GuestBanner />
          <Header />
          <main className="flex-1 flex flex-col overflow-hidden">
            <GuestRouter />
          </main>
          <BottomNav />
        </div>
      </>
    );
  }

  if (!isAuthenticated && !isPublicPage) {
    return <UnauthenticatedRouter />;
  }

  const showHeader = isAuthenticated && !isPublicPage && location !== "/profile/edit" && location !== "/video-upload";

  return (
    <>
      {!hideVideoBackground && <VideoBackground fallbackGradient={true} />}
      <div className="h-full flex flex-col overflow-hidden">
        {showHeader && <Header />}
        {isAuthenticated && !isPublicPage && <NotificationBanner />}
        <main className="flex-1 flex flex-col overflow-hidden">
          {isAuthenticated ? <AuthenticatedRouter /> : <UnauthenticatedRouter />}
        </main>
        {showHeader && <BottomNav />}
      </div>
    </>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem("vibra-splash-seen");
    return !seen;
  });

  useEffect(() => {
    const htmlSplash = document.getElementById("html-splash");
    if (htmlSplash) {
      htmlSplash.style.opacity = "0";
      setTimeout(() => htmlSplash.remove(), 500);
    }
  }, []);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem("vibra-splash-seen", "1");
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
