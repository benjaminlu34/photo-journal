import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  Calendar,
  Users,
  Palette,
  Lock,
  MousePointer,
  Users2,
  Shield,
  Sparkles,
  Image,
  Type,
  Mic,
  PenTool,
  RefreshCw,
  Radio,
  Database,
  CloudOff
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuthMigration } from "@/hooks/useAuthMigration";
import { useToast } from "@/hooks/use-toast";
import { AppLogo } from "@/components/ui/app-logo";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, signUp, isLoading, user } = useAuthMigration();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation('/');
    }
  }, [user, setLocation]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email, password);
      toast({
        title: "Sign up successful",
        description: "Please check your email to verify your account",
      });
    } catch (error: any) {
      let errorMessage = "Sign up failed. Please try again";
      if (error.message?.includes("User already registered") ||
        error.message?.includes("already exists") ||
        error.message?.includes("duplicate")) {
        errorMessage = "This email is already registered. Please sign in instead.";
      } else if (error.message?.includes("invalid email")) {
        errorMessage = "Please enter a valid email address.";
      } else if (error.message?.includes("password")) {
        errorMessage = "Password must be at least 6 characters.";
      } else if (error.message?.includes("rate limit")) {
        errorMessage = "Too many attempts. Please try again later.";
      } else {
        errorMessage = error.message || "Sign up failed. Please try again.";
      }

      toast({
        title: "Sign up failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-25 to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 via-red-400 to-pink-400 flex items-center justify-center text-white font-semibold shadow-lg backdrop-blur-sm border border-white/20">
                <AppLogo size="lg" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Glassly
                </h1>
                <p className="text-sm text-gray-600">Beautiful memories, beautifully organized</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section with Sign Up */}
      <div className="py-20 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Your memories, beautifully organized
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Create a collaborative journal with photos, notes, and more. Share your memories with loved ones in real-time.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-4">
                    <Palette className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Creative Freedom</h3>
                    <p className="text-gray-600">Arrange your memories spatially like a bulletin board</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-4">
                    <Users className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Real-time Collaboration</h3>
                    <p className="text-gray-600">Create memories together, even when apart</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center mr-4">
                    <Calendar className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Multiple Views</h3>
                    <p className="text-gray-600">Daily, weekly, and monthly perspectives</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Card className="bg-white/80 backdrop-blur-sm border border-orange-100 shadow-xl">
                <CardContent className="p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Get Started Today</h3>
                    <p className="text-gray-600">Join thousands creating beautiful memories</p>
                  </div>

                  <Tabs defaultValue="signin" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="signin">Sign In</TabsTrigger>
                      <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    <TabsContent value="signin">
                      <form onSubmit={handleSignIn} className="space-y-6">
                        <FloatingInput
                          type="email"
                          label="Email Address"
                          value={email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                          required
                          className="w-full"
                        />

                        <FloatingInput
                          type="password"
                          label="Password"
                          value={password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                          required
                          className="w-full"
                        />

                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white"
                          disabled={isLoading}
                        >
                          {isLoading ? "Signing in..." : "Sign In"}
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="signup">
                      <form onSubmit={handleSignUp} className="space-y-6">
                        <FloatingInput
                          type="email"
                          label="Email Address"
                          value={email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                          required
                          className="w-full"
                        />

                        <FloatingInput
                          type="password"
                          label="Password"
                          value={password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                          required
                          className="w-full"
                        />

                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white"
                          disabled={isLoading}
                        >
                          {isLoading ? "Signing up..." : "Sign Up"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Powered by Next-Gen Technology Section */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Powered by Next-Gen Technology
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built with cutting-edge technology for instant, collaborative journaling
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center group cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-1">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-orange-100 transition-all duration-200 border border-orange-100">
                <RefreshCw className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform duration-200 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg group-hover:text-orange-700 transition-colors duration-200">CRDT-powered editing</h3>
              <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-200">
                Conflict-free real-time collaboration with automatic sync
              </p>
            </div>

            <div className="text-center group cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-1">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-red-100 transition-all duration-200 border border-red-100">
                <Radio className="w-8 h-8 text-red-500 group-hover:scale-110 transition-transform duration-200" />
              </div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg group-hover:text-red-700 transition-colors duration-200">WebRTC Peer-to-Peer</h3>
              <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-200">
                Direct peer connections for lightning-fast synchronization
              </p>
            </div>

            <div className="text-center group cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-1">
              <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-pink-100 transition-all duration-200 border border-pink-100">
                <Database className="w-8 h-8 text-pink-500 group-hover:scale-110 transition-transform duration-200" />
              </div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg group-hover:text-pink-700 transition-colors duration-200">Supabase Integration</h3>
              <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-200">
                Bank-level security with end-to-end encryption
              </p>
            </div>

            <div className="text-center group cursor-pointer transition-all duration-200 ease-in-out hover:-translate-y-1">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 relative group-hover:bg-amber-100 transition-all duration-200 border border-amber-100">
                <CloudOff className="w-8 h-8 text-amber-600 group-hover:scale-110 transition-transform duration-200" />
                <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                  Online
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-3 text-lg group-hover:text-amber-700 transition-colors duration-200">Offline-first</h3>
              <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors duration-200">
                Seamlessly works offline with instant sync when reconnected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Endless Possibilities Section */}
      <div className="py-16 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Endless possibilities for every journey
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Transform your memories into beautiful stories that last a lifetime
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-orange-100 group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 group-hover:scale-110 transition-all duration-200">
                  <Heart className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-orange-700 transition-colors duration-200">Family Memory Books</h3>
                <p className="text-sm text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-200">
                  Preserve precious family moments, milestones, and everyday joys in beautifully curated photo albums that tell your family's unique story across generations.
                </p>
                <p className="text-xs text-orange-600 font-medium group-hover:text-orange-700 transition-colors duration-200">230 memories created</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-red-100 group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-200 group-hover:scale-110 transition-all duration-200">
                  <Users2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-red-700 transition-colors duration-200">Travel Journals with Friends</h3>
                <p className="text-sm text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-200">
                  Document adventures, share insider tips, and relive epic journeys with travel companions through collaborative storytelling and immersive photo experiences.
                </p>
                <p className="text-xs text-red-600 font-medium group-hover:text-red-700 transition-colors duration-200">40 countries explored</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-pink-100 group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-200 group-hover:scale-110 transition-all duration-200">
                  <Palette className="w-6 h-6 text-pink-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-pink-700 transition-colors duration-200">Creative Project Documentation</h3>
                <p className="text-sm text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-200">
                  Showcase professional portfolios, artistic endeavors, and creative workflows with project management tools designed specifically for visual storytellers.
                </p>
                <p className="text-xs text-pink-600 font-medium group-hover:text-pink-700 transition-colors duration-200">12 projects showcased</p>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-amber-100 group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-200 group-hover:scale-110 transition-all duration-200">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-amber-700 transition-colors duration-200">Personal Growth Tracking</h3>
                <p className="text-sm text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-200">
                  Track personal development milestones, reflect on life changes, and document your journey toward becoming the best version of yourself through meaningful visual narratives.
                </p>
                <p className="text-xs text-amber-600 font-medium group-hover:text-amber-700 transition-colors duration-200">45 reflections shared</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid Section */}
      <div className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-100 group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-200 group-hover:scale-110 transition-all duration-200">
                  <MousePointer className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-orange-700 transition-colors duration-200">Spatial Freedom</h3>
                <p className="text-gray-600 mb-6 group-hover:text-gray-700 transition-colors duration-200">
                  Place your memories anywhere on an infinite canvas. No more rigid grids or linear constraints.
                </p>
                <div className="bg-white/50 rounded-xl p-4 relative group-hover:bg-white/70 transition-colors duration-200">
                  <div className="flex items-center space-x-2 bg-white rounded-lg p-2 shadow-sm w-fit group-hover:shadow-md transition-shadow duration-200">
                    <Image className="w-4 h-4 text-gray-600 group-hover:text-orange-500 transition-colors duration-200" />
                    <Type className="w-4 h-4 text-gray-600 group-hover:text-orange-500 transition-colors duration-200" />
                    <Mic className="w-4 h-4 text-gray-600 group-hover:text-orange-500 transition-colors duration-200" />
                    <PenTool className="w-4 h-4 text-gray-600 group-hover:text-orange-500 transition-colors duration-200" />
                  </div>
                  <div className="absolute bottom-2 right-2 w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-red-100 shadow-lg group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-200 group-hover:scale-110 transition-all duration-200">
                  <Users className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-red-700 transition-colors duration-200">Real-time Collaboration</h3>
                <p className="text-gray-600 mb-6 group-hover:text-gray-700 transition-colors duration-200">
                  Share your journal with friends and collaborate in real-time with live cursors and seamless sync.
                </p>
                <div className="text-sm text-gray-500 mb-4 group-hover:text-red-600 transition-colors duration-200">3 people editing</div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                  <div className="w-3 h-3 bg-pink-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-pink-100 shadow-lg group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-200 group-hover:scale-110 transition-all duration-200">
                  <Shield className="w-6 h-6 text-pink-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-pink-700 transition-colors duration-200">Privacy-First Security</h3>
                <p className="text-gray-600 mb-6 group-hover:text-gray-700 transition-colors duration-200">
                  End-to-end encryption and local-first architecture keeps your memories yours.
                </p>
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-2 text-gray-500 group-hover:text-pink-600 transition-colors duration-200">
                    <Lock className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
                    <span className="text-sm">Encrypted</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 border border-amber-100 group cursor-pointer transition-all duration-200 ease-in-out hover:shadow-xl hover:-translate-y-2 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-200 group-hover:scale-110 transition-all duration-200">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-amber-700 transition-colors duration-200">Smart Organization</h3>
                <p className="text-gray-600 mb-6 group-hover:text-gray-700 transition-colors duration-200">
                  AI-powered tagging and intelligent categorization automatically organize your memories.
                </p>
                <div className="flex items-center justify-center py-4">
                  <div className="bg-amber-200 text-amber-800 text-xs px-2 py-1 rounded-full group-hover:bg-amber-300 group-hover:scale-105 transition-all duration-200">
                    #Travel
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-2 text-gray-500 group-hover:text-amber-600 transition-colors duration-200">
                    <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                    <span className="text-sm">AI Tagging</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Demo Section */}
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 rounded-3xl p-8 max-w-5xl mx-auto border border-orange-100 shadow-xl backdrop-blur-sm">
            <div className="aspect-video bg-gradient-to-br from-orange-25 to-pink-25 rounded-2xl relative overflow-hidden">
              <div className="absolute top-8 left-8 w-48 h-32 bg-gradient-to-br from-amber-200 to-orange-300 rounded-2xl transform rotate-2 p-4 shadow-lg">
                <div className="text-sm text-amber-800 font-medium">
                  goodmornings :)
                </div>
              </div>
              <div className="absolute top-16 right-12 w-56 h-40 bg-white/90 backdrop-blur-sm rounded-2xl transform -rotate-1 p-3 shadow-lg border border-orange-100">
                <div className="bg-gradient-to-br from-orange-100 to-red-100 rounded-xl h-24 mb-2"></div>
                <div className="text-xs text-gray-600">
                  selfies !
                </div>
              </div>
              <div className="absolute bottom-8 left-16 w-52 h-36 bg-gradient-to-br from-red-200 to-pink-300 rounded-2xl transform rotate-1 p-4 shadow-lg">
                <div className="text-sm text-red-800 font-medium">
                  ✅ Watch MSI!
                </div>
                <div className="text-sm text-red-800 font-medium">
                  ✅ Call on discord :)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-100">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-gray-600">Built with ❤️ for beautiful memories</p>
          </div>
        </div>
      </div>
    </div>
  );
}
