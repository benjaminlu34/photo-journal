#!/usr/bin/env tsx
/**
 * Username Back-fill Migration Script
 * 
 * This script generates usernames for all existing users who don't have one yet.
 * It converts email addresses to valid usernames and resolves conflicts with unique suffixes.
 * 
 * Requirements addressed:
 * - 5.1: Generate usernames for all existing users
 * - 5.2: Derive usernames from email addresses
 * - 5.3: Resolve conflicts with unique suffix generation
 * - 5.4: Ensure 100% username coverage
 */

import 'dotenv/config';
import { db } from '../server/db';
import { users, usernameChanges } from '@shared/schema/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = ['admin', 'api', 'support', 'help', 'root', 'system', 'moderator'];

interface UsernameMigrationResult {
  userId: string;
  originalEmail: string;
  generatedUsername: string;
  hadConflict: boolean;
  conflictResolution?: string;
}

/**
 * Sanitizes an email address to create a valid username
 * Converts to lowercase, removes invalid characters, and handles edge cases
 */
function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email provided for sanitization');
  }

  return email
    .split('@')[0]                    // Take part before @
    .toLowerCase()                    // Convert to lowercase
    .replace(/[^a-z0-9_]/g, '_')     // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_')          // Replace multiple underscores with single
    .replace(/^_|_$/g, '')           // Remove leading/trailing underscores
    .slice(0, 20);                   // Ensure max length of 20
}

/**
 * Checks if a username already exists in the database (case-insensitive)
 */
async function usernameExists(username: string): Promise<boolean> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`lower(username) = lower(${username})`);

    return Number(result[0].count) > 0;
  } catch (error) {
    console.error('Error checking username existence:', error);
    throw error;
  }
}

/**
 * Generates a unique username from an email address
 * Handles conflicts by appending unique suffixes
 */
async function generateUniqueUsername(email: string): Promise<{ username: string; hadConflict: boolean; conflictResolution?: string }> {
  const baseUsername = sanitizeEmail(email);

  // Handle edge cases where sanitization results in empty or too short username
  if (!baseUsername || baseUsername.length < 3) {
    const fallbackUsername = `user_${nanoid(8).toLowerCase()}`;
    return {
      username: fallbackUsername,
      hadConflict: true,
      conflictResolution: `Email sanitization resulted in invalid username, used fallback: ${fallbackUsername}`
    };
  }

  // Check if base username is reserved
  if (RESERVED_USERNAMES.includes(baseUsername.toLowerCase())) {
    const suffix = nanoid(4).toLowerCase();
    const reservedUsername = `${baseUsername}_${suffix}`.slice(0, 20);
    return {
      username: reservedUsername,
      hadConflict: true,
      conflictResolution: `Username was reserved, added suffix: ${suffix}`
    };
  }

  // Check if base username is available
  if (!(await usernameExists(baseUsername))) {
    return {
      username: baseUsername,
      hadConflict: false
    };
  }

  // Resolve conflicts with unique suffixes
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const suffix = nanoid(4).toLowerCase();
    const maxBaseLength = 20 - suffix.length - 1; // -1 for underscore
    const candidate = `${baseUsername.slice(0, maxBaseLength)}_${suffix}`;

    if (!(await usernameExists(candidate))) {
      return {
        username: candidate,
        hadConflict: true,
        conflictResolution: `Added unique suffix after ${attempts + 1} attempts: ${suffix}`
      };
    }

    attempts++;
  }

  // Fallback if all attempts failed (very unlikely)
  const fallbackUsername = `user_${nanoid(12).toLowerCase()}`.slice(0, 20);
  return {
    username: fallbackUsername,
    hadConflict: true,
    conflictResolution: `All attempts failed, used random fallback: ${fallbackUsername}`
  };
}

/**
 * Updates a user's username and records the change in the audit table
 */
async function updateUserUsername(userId: string, username: string): Promise<void> {
  try {
    // Start a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // Update the user's username
      await tx
        .update(users)
        .set({
          username: username,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      // Record the change in the audit table (old_username is empty string for first change)
      await tx
        .insert(usernameChanges)
        .values({
          userId: userId,
          oldUsername: '', // Empty string indicates this is the initial username assignment
          newUsername: username,
          changedAt: new Date()
        });
    });
  } catch (error) {
    console.error(`Error updating username for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Verifies that all users have usernames after the migration
 */
async function verifyMigrationCompletion(): Promise<{ totalUsers: number; usersWithUsernames: number; usersWithoutUsernames: number }> {
  try {
    const [totalResult, withUsernameResult, withoutUsernameResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(sql`username IS NOT NULL`),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(isNull(users.username))
    ]);

    return {
      totalUsers: Number(totalResult[0].count),
      usersWithUsernames: Number(withUsernameResult[0].count),
      usersWithoutUsernames: Number(withoutUsernameResult[0].count)
    };
  } catch (error) {
    console.error('Error verifying migration completion:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function backfillUsernames(): Promise<UsernameMigrationResult[]> {
  console.log('🚀 Starting username back-fill migration...');

  try {
    // Get all users without usernames
    const usersWithoutUsernames = await db
      .select({
        id: users.id,
        email: users.email
      })
      .from(users)
      .where(isNull(users.username));

    console.log(`📊 Found ${usersWithoutUsernames.length} users without usernames`);

    if (usersWithoutUsernames.length === 0) {
      console.log('✅ All users already have usernames. Migration not needed.');
      return [];
    }

    const results: UsernameMigrationResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of usersWithoutUsernames) {
      try {
        if (!user.email) {
          console.warn(`⚠️  User ${user.id} has no email address, skipping...`);
          continue;
        }

        console.log(`Processing user ${user.id} (${user.email})...`);

        // Generate unique username
        const { username, hadConflict, conflictResolution } = await generateUniqueUsername(user.email);

        // Update user in database
        await updateUserUsername(user.id, username);

        // Record result
        const result: UsernameMigrationResult = {
          userId: user.id,
          originalEmail: user.email,
          generatedUsername: username,
          hadConflict,
          conflictResolution
        };

        results.push(result);
        successCount++;

        console.log(`✅ Generated username "${username}" for ${user.email}${hadConflict ? ` (${conflictResolution})` : ''}`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to process user ${user.id} (${user.email}):`, error);
      }
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   ✅ Successfully processed: ${successCount} users`);
    console.log(`   ❌ Failed to process: ${errorCount} users`);

    return results;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Run the migration
    const results = await backfillUsernames();

    // Verify completion
    const verification = await verifyMigrationCompletion();

    console.log(`\n🔍 Migration Verification:`);
    console.log(`   Total users: ${verification.totalUsers}`);
    console.log(`   Users with usernames: ${verification.usersWithUsernames}`);
    console.log(`   Users without usernames: ${verification.usersWithoutUsernames}`);

    if (verification.usersWithoutUsernames === 0) {
      console.log('✅ Migration completed successfully! All users have usernames.');
    } else {
      console.log(`⚠️  Warning: ${verification.usersWithoutUsernames} users still don't have usernames.`);
    }

    // Display detailed results if any conflicts occurred
    const conflictResults = results.filter(r => r.hadConflict);
    if (conflictResults.length > 0) {
      console.log(`\n🔧 Conflict Resolution Details:`);
      conflictResults.forEach(result => {
        console.log(`   ${result.originalEmail} → ${result.generatedUsername} (${result.conflictResolution})`);
      });
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Script execution failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('backfill-usernames.ts');
if (isMainModule) {
  main();
}

// Export functions for testing
export {
  sanitizeEmail,
  usernameExists,
  generateUniqueUsername,
  updateUserUsername,
  verifyMigrationCompletion,
  backfillUsernames
};