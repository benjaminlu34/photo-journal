-- Migration to remove obsolete profile_image_url field
-- This field is now replaced by Supabase storage bucket

-- Remove the profile_image_url column from users table
ALTER TABLE users DROP COLUMN IF EXISTS profile_image_url;

-- Note: Any existing profile pictures will need to be migrated to Supabase storage
-- This migration assumes users will re-upload their profile pictures