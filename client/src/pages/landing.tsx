import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Calendar, Users, Palette } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border neumorphic-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full gradient-button flex items-center justify-center text-white font-semibold">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">FlowJournal</h1>
                <p className="text-sm text-muted-foreground">Connect & Create</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = "/api/login"}
              className="gradient-button text-white px-8 py-3 rounded-xl font-semibold"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-6xl font-bold text-foreground mb-6">
            Share Moments with{" "}
            <span className="text-gradient">
              Loved Ones
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            A social journaling platform designed for college friends to capture memories, 
            coordinate plans, and stay connected through beautiful, interactive content blocks.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="gradient-button text-white px-12 py-4 text-lg rounded-2xl font-bold"
          >
            Start Your Journey
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="neumorphic-card border-none">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Palette className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Drag & Drop Content</h3>
              <p className="text-sm text-muted-foreground">
                Create with sticky notes, photos, checklists, and voice memos. Arrange them however you like.
              </p>
            </CardContent>
          </Card>

          <Card className="neumorphic-card border-none">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Multiple Views</h3>
              <p className="text-sm text-muted-foreground">
                Switch between daily, weekly calendar, creative Pinterest-style, and monthly views.
              </p>
            </CardContent>
          </Card>

          <Card className="neumorphic-card border-none">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Friend Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Share journal entries with friends and see who's online for spontaneous planning.
              </p>
            </CardContent>
          </Card>

          <Card className="neumorphic-card border-none">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Neumorphic Design</h3>
              <p className="text-sm text-muted-foreground">
                Calming, stress-reducing interface with soft shadows and warm colors for comfort.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mock Interface Preview */}
        <div className="relative">
          <div className="neumorphic-card rounded-3xl p-8 max-w-5xl mx-auto">
            <div className="aspect-video bg-gradient-to-br from-background to-card rounded-2xl relative overflow-hidden border border-white/5">
              {/* Mock content blocks */}
              <div className="absolute top-8 left-8 w-48 h-32 content-block-sticky rounded-2xl transform rotate-2 p-4">
                <div className="text-sm text-amber-800 font-medium">Morning coffee thoughts ☕</div>
              </div>
              <div className="absolute top-16 right-12 w-56 h-40 neumorphic-card rounded-2xl transform -rotate-1 p-3">
                <div className="bg-primary/20 rounded-xl h-24 mb-2"></div>
                <div className="text-xs text-muted-foreground">Photo memories...</div>
              </div>
              <div className="absolute bottom-8 left-16 w-52 h-36 content-block-lavender rounded-2xl transform rotate-1 p-4">
                <div className="text-sm text-purple-800 font-medium">✅ Plan weekend</div>
                <div className="text-sm text-purple-800 font-medium">✅ Text friends</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border neumorphic-card mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-muted-foreground">
              Built for college friends who want to stay connected and create together.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
