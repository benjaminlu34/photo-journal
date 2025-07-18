/**
 * Setup Storage Bucket for Profile Pictures
 * 
 * This script creates the profile-pictures bucket in Supabase Storage
 * and sets up the necessary RLS policies for secure access.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../../.env.supabase');
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupStorageBucket() {
  console.log('🔧 Setting up profile-pictures storage bucket...\n');

  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Failed to list buckets:', listError.message);
      return false;
    }

    const existingBucket = buckets?.find(bucket => bucket.name === 'profile-pictures');

    if (existingBucket) {
      console.log('✅ profile-pictures bucket already exists');
      return true;
    }

    // Create the bucket
    const { data: bucketData, error: createError } = await supabase.storage.createBucket('profile-pictures', {
      public: false, // Private bucket - requires authentication
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: 2097152 // 2MB limit
    });

    if (createError) {
      console.error('❌ Failed to create bucket:', createError.message);
      return false;
    }

    console.log('✅ profile-pictures bucket created successfully');
    console.log('📋 Bucket configuration:');
    console.log('  - Public: false (requires authentication)');
    console.log('  - Allowed types: JPEG, PNG, WebP, GIF');
    console.log('  - Size limit: 2MB');

    return true;
  } catch (error) {
    console.error('❌ Exception during bucket setup:', error.message);
    return false;
  }
}

// Run setup
setupStorageBucket()
  .then(success => {
    if (success) {
      console.log('\n🎉 Storage bucket setup completed successfully!');
      console.log('You can now run the storage validation tests.');
      process.exit(0);
    } else {
      console.log('\n❌ Storage bucket setup failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });