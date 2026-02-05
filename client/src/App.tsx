import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VideoBackground } from "@/components/VideoBackground";
import { Header } from "@/components/Header";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Matches from "@/pages/matches";
import Profile from "@/pages/profile";
import ProfileEdit from "@/pages/profile-edit";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Landing from "@/pages/landing";
import { useAuth } from "@/hooks/use-auth";

const publicPages = ["/privacy", "/terms"];

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/profile" component={Profile} />
      <Route path="/profile/edit" component={ProfileEdit} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRouter() {
  return (
    <Switch>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
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
      <main className="flex-1 flex flex-col">
        {isAuthenticated ? <AuthenticatedRouter /> : <UnauthenticatedRouter />}
      </main>
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
