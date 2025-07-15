import { useAuthMigration } from "@/hooks/useAuthMigration";
import { useLocation } from "wouter";
import { WelcomePage } from "@/components/ui/welcome-modal";

export default function Welcome() {
  const { user, updateProfile } = useAuthMigration();
  const [, setLocation] = useLocation();

  const handleComplete = async (updatedUser: any) => {
    // The new hook automatically refetches after profile updates
    setLocation("/");
  };

  return <WelcomePage user={user} onComplete={handleComplete} />;
}