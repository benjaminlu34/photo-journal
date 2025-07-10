import { useEffect } from "react";
import { StickyBoard } from "@/components/board/StickyBoard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus } from "lucide-react";

function HomeContent() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const currentDate = new Date();

  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [user, isLoading, toast]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, hsl(220, 14%, 96%) 0%, hsl(220, 14%, 99%) 50%, hsl(220, 14%, 94%) 100%)",
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary-600">Loading your journal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-purple-100 px-8 py-4 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h2 className="text-2xl font-bold text-gray-800">
              FlowJournal - Sticky Notes Board
            </h2>
            <p className="text-gray-600">
              {currentDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              className="neu-nav-pill font-semibold active text-gray-700 hover:text-[rgb(139,92,246)]"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Calendar
            </Button>

            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/api/logout")}
              className="neu-nav-pill font-semibold active text-gray-700 hover:text-red-500"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky Board Workspace */}
      <div className="flex-1 overflow-hidden">
        <StickyBoard />
      </div>
    </div>
  );
}

export default function Home() {
  return <HomeContent />;
}
