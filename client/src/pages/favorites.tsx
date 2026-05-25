import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart } from "lucide-react";

type FavoriteItem = {
  id: string;
  favoritedProfileId: string;
  profile: {
    id: string;
    name: string;
    age: number;
    imageUrl: string;
    location: string;
  };
};

export default function Favorites() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<FavoriteItem[]>({ queryKey: ["/api/favorites"] });

  return (
    <div className="min-h-screen p-4" style={{ background: "#0a0118" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Button>
          <h1 className="text-2xl font-bold text-white">Preferiti</h1>
        </div>
        {isLoading ? (
          <div className="text-white/70">Caricamento...</div>
        ) : !data?.length ? (
          <div className="text-white/70">Nessun preferito ancora.</div>
        ) : (
          <div className="grid gap-3">
            {data.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 border border-white/10">
                <img src={item.profile.imageUrl} alt={item.profile.name} className="w-14 h-14 rounded-full object-cover" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold truncate">{item.profile.name}</div>
                  <div className="text-white/60 text-sm">{item.profile.age} • {item.profile.location}</div>
                </div>
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}