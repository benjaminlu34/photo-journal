import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Calendar, Users, Palette, Mail, Lock, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthMigration } from "@/hooks/useAuthMigration";
import { useToast } from "@/hooks/use-toast";

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
    <div className="min-h-screen bg-white">
=      <div className="bg-white border-b border-purple-100">
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
                <p className="text-sm text-gray-600">Built for Allie!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Your memories, beautifully organized
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Create a collaborative journal with photos, notes, and more. Share your memories with loved ones.
            </p>
            
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
          
          <div>
            <Card className="bg-white border border-purple-100 shadow-xl">
              <CardContent className="p-6">
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
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
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

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl p-8 max-w-5xl mx-auto border border-purple-100 shadow-xl">
          <div className="aspect-video bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl relative overflow-hidden">
            <div className="absolute top-8 left-8 w-48 h-32 bg-gradient-to-br from-yellow-200 to-yellow-300 rounded-2xl transform rotate-2 p-4 shadow-lg">
              <div className="text-sm text-yellow-800 font-medium">
                goodmornings :)
              </div>
            </div>
            <div className="absolute top-16 right-12 w-56 h-40 bg-white rounded-2xl transform -rotate-1 p-3 shadow-lg border border-purple-100">
              <div className="bg-purple-100 rounded-xl h-24 mb-2"></div>
              <div className="text-xs text-gray-600">
                selfies !
              </div>
            </div>
            <div className="absolute bottom-8 left-16 w-52 h-36 bg-gradient-to-br from-purple-200 to-purple-300 rounded-2xl transform rotate-1 p-4 shadow-lg">
              <div className="text-sm text-purple-800 font-medium">
                ✅ Watch MSI!
              </div>
              <div className="text-sm text-purple-800 font-medium">
                ✅ Call on discord :)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-purple-100 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-gray-600">Built with ❤️ mwah!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
