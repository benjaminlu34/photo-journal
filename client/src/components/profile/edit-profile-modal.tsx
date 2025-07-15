import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StorageService } from '@/services/storage.service';
import { useToast } from '@/hooks/use-toast';
import { getInitials, invalidateProfilePicture } from '@/hooks/useProfilePicture';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, user }) => {
  const { toast } = useToast();
  const { refetch } = useUser();
  
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load current profile picture on mount
  React.useEffect(() => {
    const loadProfilePicture = async () => {
      const storageService = StorageService.getInstance();
      const url = await storageService.getLatestProfilePictureUrl(user.id);
      setProfilePicturePreview(url);
    };
    loadProfilePicture();
  }, [user.id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Use the centralized validation from StorageService
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      
      if (!validExtensions.includes(fileExtension || '')) {
        toast({
          title: "Invalid file type",
          description: "Please select a JPEG, PNG, WebP, or GIF file",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 2MB",
          variant: "destructive",
        });
        return;
      }

      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfilePicture = async (file: File): Promise<string | null> => {
    try {
      const storageService = StorageService.getInstance();
      const result = await storageService.uploadProfilePicture(user.id, file);
      
      // Invalidate cache and update preview
      invalidateProfilePicture(user.id);
      setProfilePicturePreview(result.url);
      
      toast({
        title: "Success",
        description: "Profile picture updated and old photos cleaned up",
      });
      
      return result.url;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload profile picture",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleRemoveProfilePicture = async () => {
    try {
      const storageService = StorageService.getInstance();
      await storageService.deleteAllUserProfilePictures(user.id);
      
      setProfilePicturePreview(null);
      invalidateProfilePicture(user.id);
      
      toast({
        title: "Profile picture removed",
        description: "Your profile picture has been removed",
      });
    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast({
        title: "Removal failed",
        description: "Could not remove profile picture",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (profilePicture) {
        await uploadProfilePicture(profilePicture);
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          ...(firstName.trim() !== '' && { firstName: firstName.trim() }),
          ...(lastName.trim() !== '' && { lastName: lastName.trim() }),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to update profile');
      }

      await refetch();
      invalidateProfilePicture(user.id);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Could not update profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = getInitials(firstName, lastName, user.email);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-foreground">Edit Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center space-y-4">
            <label className="relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <Avatar className="h-24 w-24">
                <AvatarImage src={profilePicturePreview || undefined} alt="Profile" />
                <AvatarFallback className="bg-secondary text-foreground text-2xl border-2 border-dashed border-border group-hover:border-accent transition-colors">
                  {profilePicturePreview ? (
                    <div className="w-full h-full flex items-center justify-center">
                      {initials}
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-xs">Upload</span>
                    </div>
                  )}
                </AvatarFallback>
              </Avatar>
            </label>
            
            {profilePicturePreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveProfilePicture}
                className="text-muted-foreground hover:text-destructive"
              >
                Remove Picture
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-foreground">First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                placeholder="Enter first name"
              />
            </div>

            <div>
              <Label className="text-foreground">Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="neu-card border-border text-foreground hover:bg-secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="ghost"
              disabled={isSubmitting}
              className="neu-card bg-primary text-primary-foreground hover:bg-accent"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
