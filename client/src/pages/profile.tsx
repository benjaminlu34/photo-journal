import React, { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { EditProfileModal } from '@/components/profile/edit-profile-modal/edit-profile-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation } from 'wouter';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';
import { getInitials } from '@/hooks/useProfilePicture';

export default function ProfilePage() {
  const { data: user, isLoading, error } = useUser();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleBack = () => {
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="bg-[var(--card)] rounded-lg p-6 shadow-lg border border-[var(--border)]">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <div className="bg-[var(--card)] rounded-lg p-6 shadow-lg border border-[var(--border)]">
            <p className="text-[var(--muted-foreground)] text-center">Unable to load profile. Please try again.</p>
            <Button onClick={handleBack} className="mt-4 mx-auto block">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const initials = getInitials(user.firstName, user.lastName, user.email);

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="neu-card bg-[var(--card)] rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Profile</h2>
              <p className="text-[var(--muted-foreground)]">
                Manage your personal information and preferences
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <ProfilePicture userId={user.id} size="xl" />
              <div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {user.firstName || ''} {user.lastName || ''}
                </h3>
                {user.username && (
                  <p className="text-lg font-medium text-[var(--primary)] mb-1">
                    @{user.username}
                  </p>
                )}
                <p className="text-[var(--muted-foreground)]">{user.email}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)]">Username</label>
                <p className="text-lg text-[var(--foreground)]">
                  {user.username ? `@${user.username}` : 'Not set'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">First Name</label>
                  <p className="text-lg text-[var(--foreground)]">{user.firstName || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--muted-foreground)]">Last Name</label>
                  <p className="text-lg text-[var(--foreground)]">{user.lastName || 'Not set'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                onClick={handleBack}
                variant="ghost"
                className="neu-card text-[var(--foreground)] hover:bg-[var(--secondary)]"
              >
                Back to Journal
              </Button>
              <Button
                onClick={() => setIsEditModalOpen(true)}
                variant="ghost"
                className="neu-card bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        <EditProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={user}
        />
      </div>
    </div>
  );
}