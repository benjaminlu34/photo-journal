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

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  profileImageUrl: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

interface WelcomePageProps {
  user: AuthUser | null
  onComplete: (updatedUser: AuthUser) => void
}

export function WelcomePage({ user, onComplete }: WelcomePageProps) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to update profile")
      }

      const updatedUser = await response.json()
      
      toast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
      })

      onComplete(updatedUser)
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
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
      const formData = new FormData()
      formData.append("file", file)

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to upload image")
      }

      const { url } = await response.json()
      form.setValue("profileImageUrl", url)
      
      toast({
        title: "Image uploaded",
        description: "Your profile image has been uploaded.",
      })
    } catch (error) {
      console.error("Error uploading image:", error)
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
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
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full shadow-lg bg-white/70 dark:bg-gray-900/80 p-2">
                <Avatar className="h-28 w-28">
                  {previewUrl || form.watch("profileImageUrl") ? (
                    <AvatarImage src={previewUrl || form.watch("profileImageUrl")} />
                  ) : (
                    <AvatarFallback className="text-2xl">
                      {form.watch("firstName")?.[0]}{form.watch("lastName")?.[0]}
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              <div className="flex items-center justify-center w-full">
                <input
                  id="picture"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  className="w-full text-lg py-2"
                  onClick={() => document.getElementById('picture')?.click()}
                >
                  {isUploading ? "Uploading..." : "Upload Picture"}
                </Button>
              </div>
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
            <Button type="submit" className="w-full text-lg py-2" disabled={isUploading}>Complete Profile</Button>
          </form>
        </Form>
      </div>
    </div>
  )
} 