import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Calendar, Users, Palette, Mail, Lock, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, signUp, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Auto-redirect if already logged in
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
      toast({
        title: "Sign up failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

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
                  Photo Journal
                </h1>
                <p className="text-sm text-gray-600">Capture your memories</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section with Auth */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Your memories, beautifully organized
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Create a collaborative journal with photos, notes, and more. Share your memories with loved ones.
            </p>
            
            {/* Features List */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                  <Palette className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Creative Freedom</h3>
                  <p className="text-gray-600">Arrange your memories spatially like a bulletin board</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Real-time Collaboration</h3>
                  <p className="text-gray-600">Create memories together, even when apart</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Multiple Views</h3>
                  <p className="text-gray-600">Daily, weekly, and monthly perspectives</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Auth Card */}
          <div>
            <Card className="bg-white border border-purple-100 shadow-xl">
              <CardContent className="p-6">
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            id="email" 
                            type="email" 
                            placeholder="your@email.com"
                            className="pl-10" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            id="password" 
                            type="password" 
                            placeholder="••••••••"
                            className="pl-10" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  </TabsContent>
                  
                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            id="signup-email" 
                            type="email" 
                            placeholder="your@email.com"
                            className="pl-10" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input 
                            id="signup-password" 
                            type="password" 
                            placeholder="••••••••"
                            className="pl-10" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
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

      {/* Mock Interface Preview */}
      <div className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl p-8 max-w-5xl mx-auto border border-purple-100 shadow-xl">
          <div className="aspect-video bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl relative overflow-hidden">
            {/* Mock content blocks */}
            <div className="absolute top-8 left-8 w-48 h-32 bg-gradient-to-br from-yellow-200 to-yellow-300 rounded-2xl transform rotate-2 p-4 shadow-lg">
              <div className="text-sm text-yellow-800 font-medium">
                Morning thoughts
              </div>
            </div>
            <div className="absolute top-16 right-12 w-56 h-40 bg-white rounded-2xl transform -rotate-1 p-3 shadow-lg border border-purple-100">
              <div className="bg-purple-100 rounded-xl h-24 mb-2"></div>
              <div className="text-xs text-gray-600">
                Photo memories
              </div>
            </div>
            <div className="absolute bottom-8 left-16 w-52 h-36 bg-gradient-to-br from-purple-200 to-purple-300 rounded-2xl transform rotate-1 p-4 shadow-lg">
              <div className="text-sm text-purple-800 font-medium">
                ✅ Morning walk
              </div>
              <div className="text-sm text-purple-800 font-medium">
                ✅ Read a book
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-purple-100 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-gray-600">Built with ❤️ and modern web technologies</p>
          </div>
        </div>
      </div>
    </div>
  );
}
