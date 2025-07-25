import React from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { FriendsPage } from '@/components/friends/friends-page';

export default function Friends() {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleBack}
              variant="ghost"
              size="sm"
              className="neu-card"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Journal
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-[var(--foreground)]">Friends</h1>
              <p className="text-[var(--muted-foreground)]">
                Manage your friends and share your journal entries
              </p>
            </div>
          </div>
        </div>
        <FriendsPage />
      </div>
    </div>
  );
}