import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <Card className="w-full max-w-md mx-4 border-purple-100 shadow-xl">
        <CardContent className="pt-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
            <p className="text-gray-600">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleGoHome}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Button>
            
            <p className="text-xs text-gray-500">
              If you were trying to access login or signup, please use the forms on the home page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
