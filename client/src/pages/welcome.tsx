import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";
import { WelcomePage } from "@/components/ui/welcome-modal";

export default function Welcome() {
  const { user, updateProfile, refreshSession } = useAuth();
  const [, setLocation] = useLocation();

  const handleComplete = async (updatedUser: any) => {
    await refreshSession();
    setLocation("/");
  };

  return <WelcomePage user={user} onComplete={handleComplete} />;
} 