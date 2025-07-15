"use client"

import * as React from "react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AuthUser } from '@shared/auth';
import { supabase } from "@/contexts/auth-context";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Camera } from "lucide-react"
import { getInitials } from "@/hooks/useProfilePicture"

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  profileImageUrl: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

interface WelcomePageProps {
  user: AuthUser | null
  onComplete: (updatedUser: AuthUser) => void
  updateProfile: (profileData: any) => Promise<AuthUser>
}

export function WelcomePage({ user, onComplete, updateProfile }: WelcomePageProps) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Initialize form with default values
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      profileImageUrl: user?.profileImageUrl || "",
    },
  })

  // Handle form submission
  async function onSubmit(data: ProfileFormValues) {
    setIsSubmitting(true)
    try {
      const updatedUser = await updateProfile({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        ...(data.profileImageUrl && { profileImageUrl: data.profileImageUrl }),
      })
      
      // Invalidate profile picture cache
      if (data.profileImageUrl && updatedUser.id) {
        const { invalidateProfilePicture } = await import('@/hooks/useProfilePicture')
        invalidateProfilePicture(updatedUser.id)
      }
      
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      })

      // Navigate to the main app immediately
      onComplete(updatedUser)
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Create a preview URL
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Upload the image
    setIsUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error("No authenticated user found")
      }

      const userId = session.user.id
      const { StorageService } = await import('@/services/storage.service')
      const { invalidateProfilePicture } = await import('@/hooks/useProfilePicture')
      const storageService = StorageService.getInstance()
      
      const result = await storageService.uploadProfilePicture(userId, file)
      
      form.setValue("profileImageUrl", result.path)
      
      // Invalidate the cache to ensure immediate updates across the app
      invalidateProfilePicture(userId)
      
      toast({
        title: "Image uploaded",
        description: "Your profile image has been uploaded.",
      })
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-glass-1 via-glass-2 to-glass-3 dark:from-dark-1 dark:via-dark-2 dark:to-dark-3">
      <div className="w-full max-w-md p-10 rounded-3xl shadow-xl bg-white/60 dark:bg-gray-900/80 backdrop-blur-md border border-white/30 dark:border-white/10">
        <h2 className="text-3xl font-extrabold mb-2 text-center text-gray-900 dark:text-white drop-shadow-sm">Welcome to Photo Journal!</h2>
        <p className="mb-8 text-center text-gray-600 dark:text-gray-300 text-lg">
          Complete your profile to get started. This information helps personalize your experience.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex flex-col items-center space-y-4">
              <label className="relative cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <Avatar className="h-28 w-28">
                  <AvatarImage src={previewUrl || form.watch("profileImageUrl") || undefined} alt="Profile" />
                  <AvatarFallback className="bg-secondary text-foreground text-2xl border-2 border-dashed border-border group-hover:border-accent transition-colors">
                    {previewUrl || form.watch("profileImageUrl") ? (
                      <div className="w-full h-full flex items-center justify-center">
                        {getInitials(form.watch("firstName"), form.watch("lastName"), user?.email)}
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                        <Camera className="w-8 h-8 mb-1" />
                        <span className="text-xs">{isUploading ? "Uploading..." : "Upload"}</span>
                      </div>
                    )}
                  </AvatarFallback>
                </Avatar>
              </label>
            </div>
            <div className="space-y-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-200">First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your first name" {...field} className="bg-white/70 dark:bg-gray-900/70 rounded-xl shadow-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 dark:text-gray-200">Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your last name" {...field} className="bg-white/70 dark:bg-gray-900/70 rounded-xl shadow-sm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full text-lg py-2" disabled={isUploading || isSubmitting}>
              {isSubmitting ? "Saving..." : "Complete Profile"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
} 