import { motion } from "framer-motion";
import { User, MapPin, Sparkles, Edit2, Settings, Heart, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const mockUserProfile = {
  id: "user-1",
  name: "Viaggiatore Cosmico",
  age: 28,
  bio: "Esploratore di galassie in cerca di anime affini. Amo le stelle, la musica cosmica e le conversazioni profonde sotto le aurore di Andromeda.",
  imageUrl: "/images/profile-1.png",
  location: "Nebulosa di Orione",
  interests: ["Esplorazione Spaziale", "Musica Cosmica", "Filosofia Galattica", "Ologrammi"],
  alienType: "Viaggiatore Stellare",
};

const stats = [
  { icon: Heart, label: "Match", value: "12", color: "text-accent" },
  { icon: Star, label: "Super Like", value: "5", color: "text-secondary" },
  { icon: Zap, label: "Boost", value: "3", color: "text-primary" },
];

export default function Profile() {
  return (
    <div className="flex-1 p-4 max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="relative">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden">
            <img
              src={mockUserProfile.imageUrl}
              alt={mockUserProfile.name}
              className="w-full h-full object-cover"
              data-testid="user-profile-image"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>
          
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-4 right-4"
            data-testid="button-edit-profile"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          
          <div className="absolute bottom-4 left-4 right-4">
            <Badge 
              variant="secondary" 
              className="bg-primary/80 text-primary-foreground backdrop-blur-sm mb-2"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {mockUserProfile.alienType}
            </Badge>
            <h1 className="text-2xl font-bold text-white" data-testid="user-profile-name">
              {mockUserProfile.name}, {mockUserProfile.age}
            </h1>
            <div className="flex items-center gap-1 text-white/80">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{mockUserProfile.location}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card className="text-center">
                <CardContent className="p-4">
                  <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Bio
              </h3>
              <p className="text-muted-foreground text-sm" data-testid="user-profile-bio">
                {mockUserProfile.bio}
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-secondary" />
                Interessi
              </h3>
              <div className="flex flex-wrap gap-2">
                {mockUserProfile.interests.map((interest, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline"
                    className="bg-muted/50"
                  >
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3"
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
              Impostazioni
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
