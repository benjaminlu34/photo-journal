import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Calendar, Users, Palette } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100">
      {/* Header */}
      <div className="border-b border-primary-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shadow-soft">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-secondary-800">FlowJournal</h1>
                <p className="text-sm text-secondary-500">Connect & Create</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = "/api/login"}
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl shadow-neumorphic hover:shadow-lg transition-all"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-secondary-800 mb-6">
            Share Moments with{" "}
            <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
              Loved Ones
            </span>
          </h2>
          <p className="text-xl text-secondary-600 max-w-3xl mx-auto mb-8">
            A social journaling platform designed for college friends to capture memories, 
            coordinate plans, and stay connected through beautiful, interactive content blocks.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-4 text-lg rounded-2xl shadow-neumorphic hover:shadow-lg transition-all"
          >
            Start Your Journey
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="bg-white/60 backdrop-blur-sm border-primary-100 shadow-neumorphic hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Palette className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-secondary-800 mb-2">Drag & Drop Content</h3>
              <p className="text-sm text-secondary-600">
                Create with sticky notes, photos, checklists, and voice memos. Arrange them however you like.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-primary-100 shadow-neumorphic hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-secondary-800 mb-2">Multiple Views</h3>
              <p className="text-sm text-secondary-600">
                Switch between daily, weekly calendar, creative Pinterest-style, and monthly views.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-primary-100 shadow-neumorphic hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-secondary-800 mb-2">Friend Collaboration</h3>
              <p className="text-sm text-secondary-600">
                Share journal entries with friends and see who's online for spontaneous planning.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-primary-100 shadow-neumorphic hover:shadow-lg transition-all">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-secondary-800 mb-2">Neumorphic Design</h3>
              <p className="text-sm text-secondary-600">
                Calming, stress-reducing interface with soft shadows and warm colors for comfort.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mock Interface Preview */}
        <div className="relative">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-5xl mx-auto">
            <div className="aspect-video bg-gradient-to-br from-primary-25 to-secondary-50 rounded-2xl relative overflow-hidden">
              {/* Mock content blocks */}
              <div className="absolute top-8 left-8 w-48 h-32 bg-warm-yellow rounded-2xl shadow-neumorphic transform rotate-2 p-4">
                <div className="text-sm text-amber-800">Morning coffee thoughts ☕</div>
              </div>
              <div className="absolute top-16 right-12 w-56 h-40 bg-white rounded-2xl shadow-neumorphic transform -rotate-1 p-3">
                <div className="bg-primary-50 rounded-xl h-24 mb-2"></div>
                <div className="text-xs text-secondary-600">Photo memories...</div>
              </div>
              <div className="absolute bottom-8 left-16 w-52 h-36 bg-primary-100 rounded-2xl shadow-neumorphic transform rotate-1 p-4">
                <div className="text-sm text-secondary-700">✅ Plan weekend</div>
                <div className="text-sm text-secondary-700">✅ Text friends</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-primary-100 bg-white/80 backdrop-blur-sm mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-secondary-500">
              Built for college friends who want to stay connected and create together.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
