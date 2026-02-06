import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoBackground } from "@/components/VideoBackground";
import { Header, BottomNav } from "@/components/Header";
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

const publicPages = ["/privacy", "/terms", "/login", "/register"];

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !isPublicPage) {
    return <UnauthenticatedRouter />;
  }

  const showHeader = isAuthenticated && !isPublicPage;

  return (
    <div className="min-h-screen flex flex-col">
      {showHeader && <Header />}
      <main className="flex-1 flex flex-col overflow-hidden">
        {isAuthenticated ? <AuthenticatedRouter /> : <UnauthenticatedRouter />}
      </main>
      {showHeader && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VideoBackground fallbackGradient={true} />
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
