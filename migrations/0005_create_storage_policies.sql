-- Migration: Create Storage Policies for Profile Pictures
-- This migration sets up secure storage for profile pictures with proper RLS

-- Create storage bucket for profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for storage
-- Policy: Users can upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own profile pictures
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE
USING (
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects FOR DELETE
USING (
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Profile pictures are publicly viewable
CREATE POLICY "Profile pictures are publicly viewable"
ON storage.objects FOR SELECT
USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_storage_objects_foldername 
ON storage.objects USING gin (storage.foldername(name));

-- Update existing objects to ensure they follow the new naming convention
-- This is a safety measure for any existing uploads
UPDATE storage.objects
SET name = regexp_replace(name, '^profile-pictures/', 'profile-pictures/')
WHERE bucket_id = 'profile-pictures' AND NOT name LIKE 'profile-pictures/%';

-- Add metadata column for tracking upload metadata
ALTER TABLE storage.objects
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create function to extract user ID from path
CREATE OR REPLACE FUNCTION storage.extract_user_id(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (storage.foldername(name))[1];
END;
$$ LANGUAGE plpgsql IMMUTABLE;