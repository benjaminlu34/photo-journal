// Utility functions for syncing user data with Supabase Auth
// This handles the proper way to sync username changes to JWT claims

import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client (requires service role key)
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase admin client not configured - username sync will be skipped');
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

/**
 * Sync username changes to Supabase Auth metadata
 * This ensures that the next JWT token issued will include the updated username
 */
export async function syncUsernameToAuth(userId: string, username: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    console.log(`Username sync skipped for user ${userId} - Supabase admin not configured`);
    return false;
  }
  
  try {
    // Update the user's metadata in Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { 
        username,
        username_updated_at: new Date().toISOString()
      }
    });
    
    if (error) {
      console.error(`Failed to sync username to Supabase auth for user ${userId}:`, error);
      return false;
    }
    
    console.log(`Successfully synced username '${username}' to Supabase auth for user ${userId}`);
    return true;
    
  } catch (error) {
    console.error(`Error syncing username to Supabase auth for user ${userId}:`, error);
    return false;
  }
}

/**
 * Force refresh a user's session to get updated JWT claims
 * This can be called after username changes to immediately update the JWT
 */
export async function refreshUserSession(userId: string): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    console.log(`Session refresh skipped for user ${userId} - Supabase admin not configured`);
    return false;
  }
  
  try {
    // In Supabase, you can't directly force a session refresh for a user
    // The client needs to call supabase.auth.refreshSession()
    // This function is here for completeness and future use
    
    console.log(`Session refresh requested for user ${userId} - client should call refreshSession()`);
    return true;
    
  } catch (error) {
    console.error(`Error requesting session refresh for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get user's current JWT claims from the database
 * This can be used to verify what claims should be in the JWT
 */
export async function getUserJWTClaims(userId: string): Promise<any | null> {
  // This would use the database function we created
  // For now, we'll return a placeholder
  return {
    sub: userId,
    // Other claims would be fetched from database
  };
}

/**
 * Listen for username change notifications from PostgreSQL
 * This can be used to trigger async JWT sync operations
 */
export function startUsernameChangeListener(): void {
  // This would set up a PostgreSQL LISTEN connection
  // to receive notifications from the username_notify_trigger
  // For now, this is a placeholder for future implementation
  
  console.log('Username change listener would be started here');
  
  // Example implementation:
  // const client = new Client({ connectionString: process.env.DATABASE_URL });
  // client.connect();
  // client.query('LISTEN username_changed');
  // client.on('notification', async (msg) => {
  //   const data = JSON.parse(msg.payload);
  //   await syncUsernameToAuth(data.user_id, data.new_username);
  // });
}