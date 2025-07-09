import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Calendar, Users, Palette } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white font-semibold">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Allie and Ben's Journal
                </h1>
                <p className="text-sm text-gray-600">I love you!</p>
              </div>
            </div>
            <Button
              onClick={() => (window.location.href = "/api/login")}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-indigo-600 transition-colors"
            >
              Get Started!
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <Button
            onClick={() => (window.location.href = "/api/login")}
            size="lg"
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-12 py-4 text-lg rounded-2xl font-bold hover:from-purple-600 hover:to-indigo-600 transition-colors"
          >
            Start Our Journey!
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="bg-white border border-purple-100 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Palette className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Drag & Drop Content
              </h3>
              <p className="text-sm text-gray-600">
                Create with sticky notes, photos, checklists, and voice memos.
                Arrange them however you like.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-purple-100 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Multiple Views
              </h3>
              <p className="text-sm text-gray-600">
                Switch between daily, weekly calendar, creative Pinterest-style,
                and monthly views.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-purple-100 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Collaboration!
              </h3>
              <p className="text-sm text-gray-600">
                Share journal entries with each other and see what we did each
                day!
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border border-purple-100 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Neumorphic Design
              </h3>
              <p className="text-sm text-gray-600">
                pretty design (not efficient tho...)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mock Interface Preview */}
        <div className="relative">
          <div className="bg-white rounded-3xl p-8 max-w-5xl mx-auto border border-purple-100 shadow-xl">
            <div className="aspect-video bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl relative overflow-hidden">
              {/* Mock content blocks */}
              <div className="absolute top-8 left-8 w-48 h-32 bg-gradient-to-br from-yellow-200 to-yellow-300 rounded-2xl transform rotate-2 p-4 shadow-lg">
                <div className="text-sm text-yellow-800 font-medium">
                  Morning selfie
                </div>
              </div>
              <div className="absolute top-16 right-12 w-56 h-40 bg-white rounded-2xl transform -rotate-1 p-3 shadow-lg border border-purple-100">
                <div className="bg-purple-100 rounded-xl h-24 mb-2"></div>
                <div className="text-xs text-gray-600">
                  Photo memories... a lot of them...
                </div>
              </div>
              <div className="absolute bottom-8 left-16 w-52 h-36 bg-gradient-to-br from-purple-200 to-purple-300 rounded-2xl transform rotate-1 p-4 shadow-lg">
                <div className="text-sm text-purple-800 font-medium">
                  ✅ Watch MSI
                </div>
                <div className="text-sm text-purple-800 font-medium">
                  ✅ Discord call!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-purple-100 mt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-gray-600">Built with love and care :)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
