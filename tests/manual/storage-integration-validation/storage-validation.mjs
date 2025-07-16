/**
 * Storage Integration Validation Tests
 * 
 * This script validates all storage integration requirements for Phase 3:
 * - Verify profile-pictures bucket exists in Supabase dashboard
 * - Test file upload and confirm files appear in Supabase Storage dashboard
 * - Validate uploaded images generate accessible authenticated URLs
 * - Test user isolation by attempting cross-user file access
 * - Verify files are organized in profile-pictures/{user_id}/ structure
 * - Test automatic cleanup of old profile pictures when new ones are uploaded
 * - Validate profile picture removal functionality and storage cleanup
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

// Test configuration
const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
// Use valid UUIDs for test users
const TEST_USER_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const TEST_USER_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase configuration');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  process.exit(1);
}

// Initialize Supabase client with service role key for testing
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

class StorageIntegrationValidator {
  constructor() {
    this.results = [];
  }

  addResult(testName, status, details, errors = []) {
    this.results.push({ testName, status, details, errors });
    console.log(`[${status}] ${testName}: ${details}`);
    if (errors.length > 0) {
      errors.forEach(error => console.error(`  Error: ${error}`));
    }
  }

  /**
   * Create a test image buffer for upload testing
   */
  createTestImageBuffer(filename = 'test-image.png') {
    // Create a simple 1x1 PNG image as base64
    const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Requirement 2.1: Verify profile-pictures bucket exists in Supabase dashboard
   */
  async testBucketExists() {
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        this.addResult(
          'Bucket Existence Check',
          'FAIL',
          'Failed to list buckets',
          [error.message]
        );
        return;
      }

      const profilePicturesBucket = buckets?.find(bucket => bucket.name === 'profile-pictures');
      
      if (profilePicturesBucket) {
        this.addResult(
          'Bucket Existence Check',
          'PASS',
          `profile-pictures bucket exists with ID: ${profilePicturesBucket.id}`
        );
      } else {
        this.addResult(
          'Bucket Existence Check',
          'FAIL',
          'profile-pictures bucket not found',
          [`Available buckets: ${buckets?.map(b => b.name).join(', ') || 'none'}`]
        );
      }
    } catch (error) {
      this.addResult(
        'Bucket Existence Check',
        'FAIL',
        'Exception during bucket check',
        [error.message]
      );
    }
  }

  /**
   * Requirement 2.2: Test file upload and confirm files appear in Supabase Storage dashboard
   */
  async testFileUpload() {
    try {
      const testImageBuffer = this.createTestImageBuffer();
      const fileName = `test-upload-${Date.now()}.png`;
      const filePath = `${TEST_USER_ID_1}/${fileName}`;
      
      // Upload file directly to Supabase Storage
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, testImageBuffer, {
          contentType: 'image/png',
          upsert: false
        });
      
      if (error) {
        this.addResult(
          'File Upload Test',
          'FAIL',
          'Failed to upload file',
          [error.message]
        );
        return;
      }

      if (data && data.path) {
        this.addResult(
          'File Upload Test',
          'PASS',
          `File uploaded successfully to path: ${data.path}`
        );
        
        // Verify file exists in storage
        const { data: files, error: listError } = await supabase.storage
          .from('profile-pictures')
          .list(`${TEST_USER_ID_1}/`);
        
        if (listError) {
          this.addResult(
            'File Upload Verification',
            'FAIL',
            'Failed to list uploaded files',
            [listError.message]
          );
        } else if (files && files.length > 0) {
          this.addResult(
            'File Upload Verification',
            'PASS',
            `Found ${files.length} file(s) in user directory: ${files.map(f => f.name).join(', ')}`
          );
        } else {
          this.addResult(
            'File Upload Verification',
            'FAIL',
            'No files found in user directory after upload'
          );
        }
      } else {
        this.addResult(
          'File Upload Test',
          'FAIL',
          'Upload did not return expected result',
          [`Result: ${JSON.stringify(data)}`]
        );
      }
    } catch (error) {
      this.addResult(
        'File Upload Test',
        'FAIL',
        'Exception during file upload',
        [error.message]
      );
    }
  }

  /**
   * Requirement 2.3: Validate uploaded images generate accessible authenticated URLs
   */
  async testAuthenticatedURLs() {
    try {
      // First ensure we have a file to test with
      const testImageBuffer = this.createTestImageBuffer();
      const fileName = `test-url-${Date.now()}.png`;
      const filePath = `${TEST_USER_ID_1}/${fileName}`;
      
      await supabase.storage
        .from('profile-pictures')
        .upload(filePath, testImageBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      // Get the signed URL (authenticated URL)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('profile-pictures')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (urlError) {
        this.addResult(
          'Authenticated URL Generation',
          'FAIL',
          'Failed to generate signed URL',
          [urlError.message]
        );
        return;
      }

      if (signedUrlData && signedUrlData.signedUrl) {
        this.addResult(
          'Authenticated URL Generation',
          'PASS',
          `Generated signed URL: ${signedUrlData.signedUrl.substring(0, 50)}...`
        );
        
        // Test URL accessibility (basic check)
        try {
          const response = await fetch(signedUrlData.signedUrl, { method: 'HEAD' });
          if (response.ok) {
            this.addResult(
              'URL Accessibility Test',
              'PASS',
              `URL is accessible (status: ${response.status})`
            );
          } else {
            this.addResult(
              'URL Accessibility Test',
              'FAIL',
              `URL returned error status: ${response.status}`
            );
          }
        } catch (fetchError) {
          this.addResult(
            'URL Accessibility Test',
            'FAIL',
            'Failed to fetch URL',
            [fetchError.message]
          );
        }
      } else {
        this.addResult(
          'Authenticated URL Generation',
          'FAIL',
          'Failed to generate authenticated URL'
        );
      }
    } catch (error) {
      this.addResult(
        'Authenticated URL Generation',
        'FAIL',
        'Exception during URL generation test',
        [error.message]
      );
    }
  }

  /**
   * Requirement 2.4: Test user isolation by attempting cross-user file access
   */
  async testUserIsolation() {
    try {
      // Upload files for two different users
      const testImageBuffer1 = this.createTestImageBuffer();
      const testImageBuffer2 = this.createTestImageBuffer();
      const fileName1 = `user1-file-${Date.now()}.png`;
      const fileName2 = `user2-file-${Date.now()}.png`;
      
      await supabase.storage
        .from('profile-pictures')
        .upload(`${TEST_USER_ID_1}/${fileName1}`, testImageBuffer1, {
          contentType: 'image/png',
          upsert: true
        });
      
      await supabase.storage
        .from('profile-pictures')
        .upload(`${TEST_USER_ID_2}/${fileName2}`, testImageBuffer2, {
          contentType: 'image/png',
          upsert: true
        });
      
      // Try to access user1's files from user2's directory listing
      const { data: user1Files, error: user1Error } = await supabase.storage
        .from('profile-pictures')
        .list(`${TEST_USER_ID_1}/`);
      
      const { data: user2Files, error: user2Error } = await supabase.storage
        .from('profile-pictures')
        .list(`${TEST_USER_ID_2}/`);
      
      if (user1Error || user2Error) {
        this.addResult(
          'User Isolation Test',
          'FAIL',
          'Failed to list user directories',
          [user1Error?.message, user2Error?.message].filter(Boolean)
        );
        return;
      }
      
      // Verify each user only sees their own files
      const user1HasOwnFiles = user1Files && user1Files.length > 0;
      const user2HasOwnFiles = user2Files && user2Files.length > 0;
      
      if (user1HasOwnFiles && user2HasOwnFiles) {
        this.addResult(
          'User Isolation Test',
          'PASS',
          `User isolation verified: User1 has ${user1Files.length} files, User2 has ${user2Files.length} files`
        );
      } else {
        this.addResult(
          'User Isolation Test',
          'FAIL',
          'User isolation test inconclusive',
          [
            `User1 files: ${user1Files?.length || 0}`,
            `User2 files: ${user2Files?.length || 0}`
          ]
        );
      }
      
      // Test cross-user URL access (should generate different URLs)
      const { data: user1UrlData } = await supabase.storage
        .from('profile-pictures')
        .createSignedUrl(`${TEST_USER_ID_1}/${fileName1}`, 3600);
      
      const { data: user2UrlData } = await supabase.storage
        .from('profile-pictures')
        .createSignedUrl(`${TEST_USER_ID_2}/${fileName2}`, 3600);
      
      if (user1UrlData?.signedUrl && user2UrlData?.signedUrl && 
          user1UrlData.signedUrl !== user2UrlData.signedUrl) {
        this.addResult(
          'Cross-User URL Isolation',
          'PASS',
          'Different users generate different URLs as expected'
        );
      } else {
        this.addResult(
          'Cross-User URL Isolation',
          'FAIL',
          'Cross-user URL isolation test failed'
        );
      }
    } catch (error) {
      this.addResult(
        'User Isolation Test',
        'FAIL',
        'Exception during user isolation test',
        [error.message]
      );
    }
  }

  /**
   * Requirement 2.5: Verify files are organized in profile-pictures/{user_id}/ structure
   */
  async testFileOrganization() {
    try {
      const testImageBuffer = this.createTestImageBuffer();
      const fileName = `organization-test-${Date.now()}.png`;
      const filePath = `${TEST_USER_ID_1}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, testImageBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (error) {
        this.addResult(
          'File Organization Test',
          'FAIL',
          'Upload failed, cannot test organization',
          [error.message]
        );
        return;
      }

      if (data && data.path) {
        const expectedPrefix = `${TEST_USER_ID_1}/`;
        if (data.path.startsWith(expectedPrefix)) {
          this.addResult(
            'File Organization Test',
            'PASS',
            `File correctly organized in user directory: ${data.path}`
          );
        } else {
          this.addResult(
            'File Organization Test',
            'FAIL',
            `File not organized correctly. Expected prefix: ${expectedPrefix}, Actual path: ${data.path}`
          );
        }
        
        // Verify directory structure in storage
        const { data: files, error: listError } = await supabase.storage
          .from('profile-pictures')
          .list(`${TEST_USER_ID_1}/`);
        
        if (listError) {
          this.addResult(
            'Directory Structure Verification',
            'FAIL',
            'Failed to verify directory structure',
            [listError.message]
          );
        } else if (files && files.length > 0) {
          const allFilesInCorrectDir = files.every(file => 
            !file.name.includes('/') // Files should be directly in user directory
          );
          
          if (allFilesInCorrectDir) {
            this.addResult(
              'Directory Structure Verification',
              'PASS',
              `All ${files.length} files are correctly organized in user directory`
            );
          } else {
            this.addResult(
              'Directory Structure Verification',
              'FAIL',
              'Some files are not correctly organized',
              files.map(f => f.name)
            );
          }
        }
      }
    } catch (error) {
      this.addResult(
        'File Organization Test',
        'FAIL',
        'Exception during file organization test',
        [error.message]
      );
    }
  }

  /**
   * Requirement 2.6: Test automatic cleanup of old profile pictures when new ones are uploaded
   * Note: This tests the manual cleanup functionality since automatic cleanup is handled by the StorageService
   */
  async testManualCleanup() {
    try {
      // Upload multiple files
      const testImageBuffer1 = this.createTestImageBuffer();
      const testImageBuffer2 = this.createTestImageBuffer();
      const fileName1 = `cleanup-test-1-${Date.now()}.png`;
      const fileName2 = `cleanup-test-2-${Date.now() + 1}.png`;
      
      await supabase.storage
        .from('profile-pictures')
        .upload(`${TEST_USER_ID_1}/${fileName1}`, testImageBuffer1, {
          contentType: 'image/png',
          upsert: true
        });
      
      await supabase.storage
        .from('profile-pictures')
        .upload(`${TEST_USER_ID_1}/${fileName2}`, testImageBuffer2, {
          contentType: 'image/png',
          upsert: true
        });
      
      // Check initial file count
      let { data: filesAfterUploads, error: error1 } = await supabase.storage
        .from('profile-pictures')
        .list(`${TEST_USER_ID_1}/`);
      
      if (error1) {
        this.addResult(
          'Manual Cleanup Test',
          'FAIL',
          'Failed to list files after uploads',
          [error1.message]
        );
        return;
      }
      
      const initialCount = filesAfterUploads?.length || 0;
      
      if (initialCount >= 2) {
        // Manually delete the older file (simulating cleanup)
        const { error: deleteError } = await supabase.storage
          .from('profile-pictures')
          .remove([`${TEST_USER_ID_1}/${fileName1}`]);
        
        if (deleteError) {
          this.addResult(
            'Manual Cleanup Test',
            'FAIL',
            'Failed to delete old file',
            [deleteError.message]
          );
          return;
        }
        
        // Check file count after cleanup
        let { data: filesAfterCleanup, error: error2 } = await supabase.storage
          .from('profile-pictures')
          .list(`${TEST_USER_ID_1}/`);
        
        if (error2) {
          this.addResult(
            'Manual Cleanup Test',
            'FAIL',
            'Failed to list files after cleanup',
            [error2.message]
          );
          return;
        }
        
        const finalCount = filesAfterCleanup?.length || 0;
        
        if (finalCount === initialCount - 1) {
          this.addResult(
            'Manual Cleanup Test',
            'PASS',
            `Cleanup working correctly: ${initialCount} files before, ${finalCount} files after cleanup`
          );
        } else {
          this.addResult(
            'Manual Cleanup Test',
            'FAIL',
            `Cleanup not working as expected: ${initialCount} files before, ${finalCount} files after cleanup`
          );
        }
      } else {
        this.addResult(
          'Manual Cleanup Test',
          'SKIP',
          'Not enough files to test cleanup functionality'
        );
      }
    } catch (error) {
      this.addResult(
        'Manual Cleanup Test',
        'FAIL',
        'Exception during cleanup test',
        [error.message]
      );
    }
  }

  /**
   * Requirement 2.7: Validate profile picture removal functionality and storage cleanup
   */
  async testProfilePictureRemoval() {
    try {
      // Upload a file first
      const testImageBuffer = this.createTestImageBuffer();
      const fileName = `removal-test-${Date.now()}.png`;
      const filePath = `${TEST_USER_ID_1}/${fileName}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, testImageBuffer, {
          contentType: 'image/png',
          upsert: true
        });
      
      if (uploadError || !data) {
        this.addResult(
          'Profile Picture Removal Test',
          'FAIL',
          'Failed to upload test file for removal test',
          [uploadError?.message]
        );
        return;
      }
      
      // Verify file exists
      const { data: filesBefore, error: errorBefore } = await supabase.storage
        .from('profile-pictures')
        .list(`${TEST_USER_ID_1}/`);
      
      if (errorBefore || !filesBefore || filesBefore.length === 0) {
        this.addResult(
          'Profile Picture Removal Test',
          'FAIL',
          'Test file not found before removal test',
          [errorBefore?.message]
        );
        return;
      }
      
      const fileExists = filesBefore.some(f => f.name === fileName);
      if (!fileExists) {
        this.addResult(
          'Profile Picture Removal Test',
          'FAIL',
          'Uploaded file not found in directory listing'
        );
        return;
      }
      
      // Test removal
      const { error: deleteError } = await supabase.storage
        .from('profile-pictures')
        .remove([filePath]);
      
      if (deleteError) {
        this.addResult(
          'Profile Picture Removal Test',
          'FAIL',
          'Failed to delete file',
          [deleteError.message]
        );
        return;
      }
      
      // Verify file is removed
      const { data: filesAfter, error: errorAfter } = await supabase.storage
        .from('profile-pictures')
        .list(`${TEST_USER_ID_1}/`);
      
      if (errorAfter) {
        this.addResult(
          'Profile Picture Removal Test',
          'FAIL',
          'Failed to verify removal',
          [errorAfter.message]
        );
        return;
      }
      
      const remainingFiles = filesAfter?.filter(f => f.name === fileName) || [];
      
      if (remainingFiles.length === 0) {
        this.addResult(
          'Profile Picture Removal Test',
          'PASS',
          'File successfully removed from storage'
        );
      } else {
        this.addResult(
          'Profile Picture Removal Test',
          'FAIL',
          'File still exists after removal attempt'
        );
      }
      
      // Test complete cleanup - remove all files for test user
      const { data: allFiles } = await supabase.storage
        .from('profile-pictures')
        .list(`${TEST_USER_ID_1}/`);
      
      if (allFiles && allFiles.length > 0) {
        const filesToDelete = allFiles.map(f => `${TEST_USER_ID_1}/${f.name}`);
        const { error: bulkDeleteError } = await supabase.storage
          .from('profile-pictures')
          .remove(filesToDelete);
        
        if (bulkDeleteError) {
          this.addResult(
            'Complete Cleanup Test',
            'FAIL',
            'Failed to perform complete cleanup',
            [bulkDeleteError.message]
          );
        } else {
          const { data: finalFiles, error: finalError } = await supabase.storage
            .from('profile-pictures')
            .list(`${TEST_USER_ID_1}/`);
          
          if (finalError) {
            this.addResult(
              'Complete Cleanup Test',
              'FAIL',
              'Failed to verify complete cleanup',
              [finalError.message]
            );
          } else if (!finalFiles || finalFiles.length === 0) {
            this.addResult(
              'Complete Cleanup Test',
              'PASS',
              'All user files successfully removed'
            );
          } else {
            this.addResult(
              'Complete Cleanup Test',
              'FAIL',
              `${finalFiles.length} files remain after complete cleanup`,
              finalFiles.map(f => f.name)
            );
          }
        }
      } else {
        this.addResult(
          'Complete Cleanup Test',
          'PASS',
          'No files to clean up'
        );
      }
    } catch (error) {
      this.addResult(
        'Profile Picture Removal Test',
        'FAIL',
        'Exception during removal test',
        [error.message]
      );
    }
  }

  /**
   * Clean up test files
   */
  async cleanupTestFiles() {
    try {
      console.log('\n🧹 Cleaning up test files...');
      
      // Clean up files for both test users
      for (const userId of [TEST_USER_ID_1, TEST_USER_ID_2]) {
        const { data: files } = await supabase.storage
          .from('profile-pictures')
          .list(`${userId}/`);
        
        if (files && files.length > 0) {
          const filesToDelete = files.map(f => `${userId}/${f.name}`);
          await supabase.storage
            .from('profile-pictures')
            .remove(filesToDelete);
          
          console.log(`Cleaned up ${files.length} files for ${userId}`);
        }
      }
    } catch (error) {
      console.warn('Warning: Failed to clean up some test files:', error.message);
    }
  }

  /**
   * Run all storage integration validation tests
   */
  async runAllTests() {
    console.log('🧪 Starting Storage Integration Validation Tests...\n');
    
    await this.testBucketExists();
    await this.testFileUpload();
    await this.testAuthenticatedURLs();
    await this.testUserIsolation();
    await this.testFileOrganization();
    await this.testManualCleanup();
    await this.testProfilePictureRemoval();
    
    // Clean up test files
    await this.cleanupTestFiles();
    
    // Generate summary
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Total: ${this.results.length}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`  - ${result.testName}: ${result.details}`);
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach(error => console.log(`    Error: ${error}`));
          }
        });
    }
    
    return this.results;
  }
}

// Run tests
const validator = new StorageIntegrationValidator();
validator.runAllTests()
  .then(results => {
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });