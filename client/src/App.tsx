import { useState, useCallback, Component, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

const publicPages = ["/privacy", "/terms", "/login", "/register"];

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

function RedirectHome() {
  const [, setLocation] = useLocation();
  setLocation("/");
  return null;
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/login" component={RedirectHome} />
      <Route path="/register" component={RedirectHome} />
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/chat/:matchId" component={Chat} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/edit" component={ProfileEdit} />
      <Route path="/admin" component={Admin} />
      <Route path="/rooms" component={Rooms} />
      <Route path="/room/:roomId" component={RoomDetail} />
      <Route path="/challenges" component={Challenges} />
      <Route path="/private-rooms" component={PrivateRooms} />
      <Route path="/private-room/:roomId" component={PrivateRoomDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Landing} />
      <Route component={Landing} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const isPublicPage = publicPages.includes(location);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !isPublicPage) {
    return <UnauthenticatedRouter />;
  }

  const showHeader = isAuthenticated && !isPublicPage;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showHeader && <Header />}
      <main className="flex-1 flex flex-col overflow-hidden">
        {isAuthenticated ? <AuthenticatedRouter /> : <UnauthenticatedRouter />}
      </main>
      {showHeader && <BottomNav />}
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem("vibra-splash-seen");
    return !seen;
  });

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem("vibra-splash-seen", "1");
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
          <VideoBackground fallbackGradient={true} />
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
