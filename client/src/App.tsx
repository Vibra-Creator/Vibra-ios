import { Switch, Route } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/matches" component={Matches} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VideoBackground fallbackGradient={true} />
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 flex flex-col">
            <Router />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
