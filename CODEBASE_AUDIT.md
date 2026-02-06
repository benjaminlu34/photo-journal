# Photo Journal Codebase Structured Audit

This document provides a comprehensive audit framework for the Photo Journal codebase, divided into manageable sections. Each section includes:
- **Scope**: What code to examine
- **Common Bug Patterns**: What to look for
- **Agent Prompt**: Instructions for another AI agent to audit and fix that section

---

## Section 1: Authentication & Authorization Middleware

### Scope
- `server/middleware/auth.ts` - JWT verification and user extraction
- `shared/auth.ts` - Shared authentication types

### Common Bug Patterns
- JWT secret not being validated at startup
- Missing token expiration checks
- Username extraction mismatch between JWT and database
- Race conditions in user provisioning

### Agent Prompt
```
You are auditing the Authentication & Authorization Middleware of a Photo Journal app.

FILES TO EXAMINE:
- server/middleware/auth.ts
- shared/auth.ts

POTENTIAL BUGS TO FIND AND FIX:
1. JWT SECRET VALIDATION: Check if SUPABASE_JWT_SECRET is validated at application startup (not just at request time). The current code only checks inside the middleware - if the secret is missing, the first request fails instead of failing fast at boot.

2. TOKEN EXPIRATION HANDLING: Look for missing 'exp' claim validation. The current code uses jwt.verify() but doesn't explicitly check if the token is expired before the verify call.

3. USERNAME PROPAGATION: The JWT may contain a username claim, but in isAuthenticatedSupabase, username is explicitly set to undefined. Check if this causes issues with routes that expect req.user.username to be populated.

4. OPTIONAL AUTH INCONSISTENCY: In optionalAuth middleware, the username IS extracted from JWT, but in isAuthenticatedSupabase it's set to undefined. This inconsistency could cause bugs where optionalAuth has more user data than required auth.

5. ERROR LEAKAGE: JWT verification errors are logged with console.error which could leak sensitive information in production logs.

FIX REQUIREMENTS:
- Add startup validation for SUPABASE_JWT_SECRET in server/index.ts
- Ensure consistent username handling across both middleware functions
- Add proper error sanitization for production environments
- Maintain backward compatibility with existing route handlers

TESTING NOTES:
- Check that routes with isAuthenticatedSupabase still work correctly
- Verify that optionalAuth routes can still access username when present
- Ensure missing JWT secret causes immediate failure at startup, not on first request
```

---

## Section 2: Rate Limiting System

### Scope
- `server/middleware/rateLimit.ts` - Express rate limiting middleware
- `server/utils/redis.ts` - Redis-based rate limiter with memory fallback

### Common Bug Patterns
- Race conditions in Redis pipeline operations
- Memory leaks in fallback memory store
- Inconsistent rate limit headers between Redis and memory fallbacks
- Window boundary issues causing double-counting

### Agent Prompt
```
You are auditing the Rate Limiting System of a Photo Journal app.

FILES TO EXAMINE:
- server/middleware/rateLimit.ts (all 483 lines)
- server/utils/redis.ts (all 283 lines)
- tests/unit/leak-rate-algorithm.test.ts
- tests/unit/redis-rate-limiter.test.ts

POTENTIAL BUGS TO FIND AND FIX:

1. MEMORY FALLBACK LEAK: In RedisRateLimiter.checkMemoryRateLimit(), the fallbackMemory Map accumulates entries without cleanup. When Redis is unavailable, entries for different users/IPs pile up indefinitely. The cleanup only happens when accessing an existing key, but keys that are never accessed again remain forever.

2. WINDOW BOUNDARY RACE: The window calculation uses Math.floor(now / config.windowMs) * config.windowMs which creates fixed windows. Rapid requests at window boundaries can bypass limits (e.g., 50 requests at 00:59:59 and 50 more at 01:00:00 = 100 requests in 1 second).

3. INCONSISTENT HEADER FORMATS: Redis check returns 'ratelimit-reset' as seconds since epoch, but memory fallback might return different format. Check that both return consistent formats.

4. REDIS PIPELINE ERROR HANDLING: In checkRedisRateLimit(), pipeline.exec() can throw but the error handling only catches at the higher level. If Redis fails mid-pipeline, the error might not be properly caught.

5. SKIP RATE LIMITING BYPASS: The skip function checks process.env.NODE_ENV === 'test' but NODE_ENV might not be set in some test environments, causing rate limiting to interfere with tests unexpectedly.

6. USERNAME CHANGE RATE LIMIT RESET LOGIC: In usernameChangeRateLimit, the resetTime calculation uses Math.max on dates converted to timestamps but might return NaN if changedAt is null.

FIX REQUIREMENTS:
- Add periodic cleanup for memory fallback (LRU eviction or TTL)
- Consider sliding window algorithm instead of fixed window for better accuracy
- Ensure consistent header formats between Redis and memory fallbacks
- Add defensive null checks for date calculations
- Make the test environment detection more robust

TESTING NOTES:
- Run tests/integration/rate-limiting-security.test.ts
- Verify memory fallback doesn't leak with simulated Redis failures
- Check window boundary behavior with rapid sequential requests
```

---

## Section 3: Permission Resolution System

### Scope
- `server/middleware/permission.ts` - Express permission middleware
- `server/utils/permission-resolver.ts` - Core permission logic
- `server/utils/websocket-permissions.ts` - WebSocket permission helpers

### Common Bug Patterns
- Incorrect role intersection logic
- Missing null checks for sharedEntry
- Cache invalidation issues with permission changes
- Race conditions in permission checks during concurrent edits

### Agent Prompt
```
You are auditing the Permission Resolution System of a Photo Journal app.

FILES TO EXAMINE:
- server/middleware/permission.ts (all 377 lines)
- server/utils/permission-resolver.ts (all 224 lines)
- server/utils/websocket-permissions.ts (all lines)

POTENTIAL BUGS TO FIND AND FIX:

1. MISSING NULL CHECK FOR SHAREDENTRY: In resolveEffectivePermission, sharedEntry is checked with "sharedEntry.sharedWithId === userId" but if sharedEntry exists but sharedWithId is null/undefined, this comparison silently fails. The check should validate sharedWithId exists.

2. PERMISSION CACHING ISSUE: The permissionResult is attached to req but never cleared between requests. If middleware is reused across requests (some server configurations), stale permissions could bleed between requests.

3. CONTRIBUTOR EDIT LOGIC GAP: In permission-resolver.ts, contributors have canEdit: false in getPermissionsForRole, but canEditContentBlock() allows contributors to edit their own blocks. This inconsistency could cause confusion in middleware that checks canEdit instead of canEditContentBlock.

4. ROLE RANK MAPPING BUG: The ROLE_RANKS object has both 'editor' and 'edit' mapped to 3, but mapRankToRole only handles the editor case. If an entry has permission 'edit', mapEntryPermissionToRole returns 'editor', but the reverse mapping isn't tested.

5. WEBSOCKET PERMISSION DESYNC: Check websocket-permissions.ts for cases where WebSocket permission checks might not match the HTTP permission checks. Real-time collaboration could allow operations that HTTP would block.

6. AUDIT LOG MISSING ACTOR: In permission.ts resolveJournalPermissions, when creating a new entry placeholder (lines 76-79), the actualEntryId is set to `new-entry-${uuidv4()}`. This ID format might not be recognized by downstream audit logging, causing actor attribution issues.

FIX REQUIREMENTS:
- Add comprehensive null checks for all sharedEntry fields
- Ensure WebSocket permission checks exactly match HTTP checks
- Document the contributor edit behavior clearly (global vs block-level)
- Ensure permission results don't persist across requests
- Verify audit logging works with placeholder entry IDs

TESTING NOTES:
- Test contributor trying to edit their own content block vs others
- Test permission changes taking effect immediately (no caching issues)
- Test WebSocket operations respect the same permission boundaries as HTTP
```

---

## Section 4: Friendship System Core

### Scope
- `server/utils/friendship.ts` - Canonical ID management and validation
- `server/utils/friendship-events.ts` - Event management
- `client/src/hooks/useFriendshipEvents.ts` - Client WebSocket handling

### Common Bug Patterns
- Canonical ID ordering edge cases with UUID comparison
- Race conditions in friendship status transitions
- WebSocket reconnection state inconsistencies
- Missing cleanup for event listeners

### Agent Prompt
```
You are auditing the Friendship System of a Photo Journal app.

FILES TO EXAMINE:
- server/utils/friendship.ts (all 148 lines)
- server/utils/friendship-events.ts (all lines)
- client/src/hooks/useFriendshipEvents.ts (all 321 lines)

POTENTIAL BUGS TO FIND AND FIX:

1. UUID COMPARISON BUG: In buildCanonicalFriendshipIds, the ordering uses string comparison (userA < userB). UUIDs are hexadecimal strings, and string comparison might not produce consistent ordering across different locales or Unicode handling. For example, 'a' < 'A' in some comparisons but not others.

2. COOLDOWN CHECK PRECISION: In canSendFriendRequest, the cooldown uses Date.now() - lastStatusChange.getTime() > 24 * 60 * 60 * 1000. This is a strict inequality (>), so a request made exactly 24 hours later is allowed. But if lastStatusChange has millisecond precision and the check happens at the exact same millisecond 24 hours later, it might fail due to floating point.

3. STATUS TRANSITION VALIDATION HOLE: isValidStatusTransition checks allowed transitions but doesn't verify the friendship actually exists. A null/undefined friendship passed through could cause unexpected behavior.

4. WEBSOCKET AUTH RACE: In useFriendshipEvents.ts, the WebSocket sends authentication immediately on onopen, but if the connection drops between onopen and the send, the auth message is lost without error.

5. RECONNECT EXPONENTIAL BACKOFF MISSING: The reconnect logic uses a fixed 3-second timeout. Under heavy load or network issues, this creates a thundering herd problem. No exponential backoff or jitter is implemented.

6. HANDLER REFERENCE STALENESS: handlersRef.current is updated on every render (line 64), but the WebSocket message handler captures handlersRef at connection time. If handlers change after connection, the old handlers are still used until reconnection.

7. MISSING PING/PONG: The WebSocket implementation doesn't send periodic ping frames to keep the connection alive. Proxies might close idle connections, causing silent disconnections.

FIX REQUIREMENTS:
- Use locale-independent UUID comparison (e.g., normalize to lowercase and compare)
- Add exponential backoff with jitter for reconnections
- Implement WebSocket ping/pong keepalive
- Ensure handler updates propagate to active connections
- Add defensive checks for null friendships in transition validation

TESTING NOTES:
- Test friendship creation with UUIDs that have different first characters
- Test rapid friend request/unfriend cycles around the 24-hour boundary
- Test WebSocket behavior when network drops silently (no close event)
- Verify friendship events work after component re-renders
```

---

## Section 5: Storage Layer & Database Access

### Scope
- `server/storage.ts` - Database storage implementation (750+ lines)
- `server/db.ts` - Database connection
- `migrations/*.sql` - Database schema

### Common Bug Patterns
- Missing transaction boundaries for multi-table operations
- Race conditions in upsert operations
- Incorrect pagination cursor handling
- Inefficient queries without proper indexing hints

### Agent Prompt
```
You are auditing the Storage Layer & Database Access of a Photo Journal app.

FILES TO EXAMINE:
- server/storage.ts (all ~750 lines, very large file)
- server/db.ts (all lines)
- Key migrations: 0010_add_friends_system_enhancements.sql, 0013_add_friendships_rls_policies.sql, 0014_fix_rls_policies_conflicts.sql, 0016_rls_policies_final.sql

POTENTIAL BUGS TO FIND AND FIX:

1. MISSING TRANSACTION BOUNDARIES: In createFriendshipWithCanonicalOrdering, multiple database operations happen (check existing, create friendship, log change) without a transaction. If the server crashes mid-operation, the database could be in an inconsistent state.

2. PAGINATION CURSOR ISSUE: In getFriendsWithRoles, the function accepts limit and offset but uses them inconsistently. The totalCount query doesn't consider the same filters as the main query, causing pagination mismatch.

3. CASE-INSENSITIVE USERNAME QUERY: In getUserByUsername, it uses LOWER() function on the column which prevents index usage if the index was created on the raw column. Check if there's a functional index or if this causes sequential scans.

4. UPSERT RACE CONDITION: In upsertUser, the onConflictDoUpdate might have a race condition where two simultaneous requests both try to insert, both see no conflict, and both insert, causing unique constraint violations.

5. FRIENDSHIP AUDIT LOG MISSING ACTOR: In updateFriendshipStatusWithAudit, the actorId is passed but check if it's properly validated against the friendship participants before logging. A malicious actor ID could forge audit logs.

6. DATE RANGE QUERY BUG: In getJournalEntriesInRange, the date comparison uses gte/lte but might not handle timezone boundaries correctly. Entries created near midnight might appear in the wrong range.

7. CONTENT BLOCK DELETION CASCADE: Check if deleting a journal entry properly cascades to delete content blocks, or if orphaned blocks accumulate in the database.

FIX REQUIREMENTS:
- Wrap multi-step operations in database transactions
- Ensure pagination counts match the actual filtered results
- Add proper timezone handling for date range queries
- Verify cascade deletes are properly configured
- Consider adding functional indexes for LOWER(username) queries

TESTING NOTES:
- Test concurrent friendship creation between the same two users
- Test pagination with large friend lists (100+ friends)
- Verify audit logs accurately reflect who made changes
- Test date range queries across timezone boundaries
```

---

## Section 6: API Routes

### Scope
- `server/routes.ts` - Main API routes (75KB, ~2000+ lines)
- Route handlers for auth, journal, friends, calendar, photos, sharing

### Common Bug Patterns
- Missing input validation before processing
- Race conditions in multi-step operations
- Inconsistent error response formats
- File upload security issues

### Agent Prompt
```
You are auditing the API Routes of a Photo Journal app.

FILES TO EXAMINE:
- server/routes.ts (all ~2000+ lines, very large file)
- Focus on: friendship routes, journal routes, photo upload routes, calendar OAuth routes

POTENTIAL BUGS TO FIND AND FIX:

1. MISSING VALIDATION IN FILE UPLOAD: The multer configuration validates mimetype but doesn't validate the actual file content (magic numbers). Attackers could upload executable files with image mime types.

2. RACE CONDITION IN FRIEND REQUEST: Two users could simultaneously send friend requests to each other, creating two friendship rows. The canonical ordering should prevent this but check if the unique constraint is properly enforced.

3. CALENDAR OAUTH STATE PARAMETER: In OAuth flow, the state parameter might not be properly validated or might be predictable, allowing CSRF attacks on calendar connections.

4. PHOTO PATH TRAVERSAL: In photo upload/download routes, check if userId is properly validated before being used in file paths. Malicious userIds like "../otheruser" could access other users' photos.

5. INCONSISTENT ERROR FORMATS: Some routes return { error: string }, others return { message: string }, and others return { error: object }. This inconsistency makes client-side error handling difficult.

6. MISSING CONTENT-TYPE VALIDATION: API endpoints might not validate Content-Type headers, allowing requests with incorrect body parsing.

7. TOCTOU IN USERNAME CHECK: The username availability check and username update are separate operations. Between the check and the update, another request could take the username.

8. MEMORY LEAK IN CALENDAR FEED FETCHING: Calendar feed routes might not have timeout handling, causing the server to hang on slow external requests.

FIX REQUIREMENTS:
- Add file content validation (magic numbers) in addition to mime type
- Ensure all database uniqueness constraints prevent race conditions
- Standardize error response format across all routes
- Add proper timeout handling for external API calls
- Validate and sanitize all user input before use

TESTING NOTES:
- Test file upload with fake image extension but executable content
- Test simultaneous friend requests between two users
- Test error responses from different routes for consistency
- Test photo access with path traversal attempts
```

---

## Section 7: Client State Management (Zustand Stores)

### Scope
- `client/src/lib/store.ts` - Main application store
- `client/src/lib/calendar-store.ts` - Calendar state management
- `client/src/lib/board-store.ts` - Board/note state management

### Common Bug Patterns
- State mutation instead of immutable updates
- Missing cleanup on unmount
- Race conditions in async actions
- Memory leaks from event listeners

### Agent Prompt
```
You are auditing the Client State Management (Zustand Stores) of a Photo Journal app.

FILES TO EXAMINE:
- client/src/lib/store.ts (all ~300 lines)
- client/src/lib/calendar-store.ts (all 364 lines)
- client/src/lib/board-store.ts (all lines)

POTENTIAL BUGS TO FIND AND FIX:

1. CALENDAR STORE STATE MUTATION: In calendar-store.ts, the friendEvents object is spread correctly, but check if any nested objects are being mutated directly. Zustand requires immutable updates.

2. MISSING LOADING STATE RESET: In calendar-store's loadFriendEventsForWeek, if an error occurs for one friend, the loading state is set to false even though other friends might still be loading. This causes premature loading state clearing.

3. BOARD STORE CLEANUP: Check if the board store properly cleans up Yjs providers and IndexedDB connections when the user logs out or switches boards. Memory leaks from Yjs are common.

4. STATE PERSISTENCE RACE: If multiple tabs are open, localStorage-based persistence could cause race conditions where state from one tab overwrites another incorrectly.

5. ACTION REFERENCE STABILITY: In calendar-store, actions are recreated on every store update. This causes React components to re-render unnecessarily when using action references in useEffect dependencies.

6. CIRCULAR DEPENDENCY IN FEEDS: The calendar store has a feeds array that references friend data, but friend data might also reference calendar feeds. Check for circular JSON serialization issues.

7. MISSING ERROR BOUNDARY INTEGRATION: Store actions throw errors that aren't caught, potentially crashing the entire app instead of showing user-friendly error states.

FIX REQUIREMENTS:
- Ensure all state updates are truly immutable (use Immer if needed)
- Implement proper cleanup for Yjs providers and IndexedDB
- Use refs or memoization to keep action references stable
- Add error boundaries around store-dependent components
- Handle multi-tab state synchronization properly

TESTING NOTES:
- Test calendar navigation while friend events are loading
- Test memory usage during extended sessions (Yjs cleanup)
- Test rapid state changes from multiple sources
- Verify error handling in UI when store actions fail
```

---

## Section 8: Client CRDT/Calendar SDK

### Scope
- `client/src/lib/calendar-sdk.ts` - Calendar CRDT SDK
- `client/src/lib/weekly-calendar-document.ts` - Yjs document management
- `client/src/lib/board-sdk.ts` - Board CRDT SDK

### Common Bug Patterns
- Yjs provider cleanup issues
- Awareness state desync
- Offline/online sync conflicts
- Document destruction race conditions

### Agent Prompt
```
You are auditing the Client CRDT/Calendar SDK of a Photo Journal app.

FILES TO EXAMINE:
- client/src/lib/calendar-sdk.ts (all lines)
- client/src/lib/weekly-calendar-document.ts (all ~350 lines)
- client/src/lib/board-sdk.ts (all ~200 lines)

POTENTIAL BUGS TO FIND AND FIX:

1. YJS PROVIDER CLEANUP RACE: In calendar-sdk.ts destroy(), if destroy() is called while the provider is still connecting, the cleanup might be incomplete. Check if the provider's 'connecting' state is handled.

2. AWARENESS STATE LEAK: When a user disconnects, their awareness state might persist in the document. Other users see "ghost" collaborators who are no longer connected.

3. WEBRTC SIGNALING FAILURE: If the WebRTC signaling server is unavailable, the provider keeps retrying without backoff, potentially causing a denial of service on the signaling server.

4. DOCUMENT VERSION MISMATCH: When loading a document from IndexedDB and then connecting to WebRTC, if the local version is newer than the server, conflicts might not be resolved correctly.

5. MISSING TRANSACTION BOUNDARIES: Yjs transactions should be used when making multiple related changes. Without transactions, observers might see intermediate inconsistent states.

6. INDEXEDDB QUOTA EXCEEDED: If the IndexedDB quota is exceeded, the SDK might crash without handling the error gracefully, causing data loss.

7. OFFLINE SYNC CONFLICT: When coming back online, if both local and remote documents have been modified, the conflict resolution might favor the wrong version.

FIX REQUIREMENTS:
- Ensure complete cleanup of Yjs providers including in-progress connections
- Add proper awareness state cleanup on disconnect
- Implement exponential backoff for WebRTC reconnection
- Add IndexedDB error handling with user notification
- Use Yjs transactions for atomic updates
- Implement proper conflict resolution for offline/online sync

TESTING NOTES:
- Test rapid connect/disconnect cycles
- Test with multiple tabs open (awareness state)
- Test offline modification followed by online sync with conflicting changes
- Test IndexedDB quota exceeded scenarios
- Test WebRTC signaling server failures
```

---

## Section 9: Client Services

### Scope
- `client/src/services/calendar-feed.service.ts` - Calendar feed management
- `client/src/services/offline-calendar.service.ts` - Offline support
- `client/src/services/recurrence-expansion.service.ts` - Event recurrence
- `client/src/services/snapshot.service.ts` - Yjs snapshotting

### Common Bug Patterns
- Memory leaks from intervals/timeouts
- Race conditions in service initialization
- Inefficient data synchronization
- Missing cleanup for service workers

### Agent Prompt
```
You are auditing the Client Services of a Photo Journal app.

FILES TO EXAMINE:
- client/src/services/calendar-feed.service.ts (~32K, very large)
- client/src/services/offline-calendar.service.ts (all ~400 lines)
- client/src/services/recurrence-expansion.service.ts (all ~400 lines)
- client/src/services/snapshot.service.ts (all ~300 lines)
- client/src/services/friend-calendar.service.ts (all ~500 lines)

POTENTIAL BUGS TO FIND AND FIX:

1. CALENDAR FEED POLLING LEAK: If calendar feeds are added and removed rapidly, interval cleanup might fail, causing memory leaks and unnecessary network requests.

2. RECURRENCE INFINITE LOOP: In recurrence-expansion.service.ts, if a malformed recurrence rule has no end condition (COUNT or UNTIL), the expansion could run indefinitely.

3. SNAPSHOT TIMING ISSUE: The snapshot service batches changes but might not snapshot before the user closes the browser, causing data loss if the interval hasn't fired.

4. OFFLINE SERVICE PROVIDER PATTERN: The offline-calendar.service uses a setter for feedsProvider that stores a function reference. If the provider function captures component state, it could cause memory leaks.

5. TIMEZONE HANDLING BUGS: Recurrence expansion might not handle DST transitions correctly, causing events to appear at wrong times during timezone changes.

6. FRIEND CALENDAR PERMISSION CHECK: The friend-calendar.service might cache friend calendar data without checking if permissions have been revoked, allowing access after a role change.

7. SERVICE INITIALIZATION ORDER: Services have circular dependencies (snapshot needs store, store needs services). Check if initialization order is guaranteed.

FIX REQUIREMENTS:
- Ensure all intervals/timeouts are properly cleaned up
- Add safety limits to recurrence expansion (max iterations, max date range)
- Implement beforeunload handler for final snapshot
- Audit timezone handling for DST edge cases
- Add permission checks before serving cached friend calendar data
- Resolve circular dependency issues

TESTING NOTES:
- Test rapid add/remove of calendar feeds
- Test recurrence rules with no end date
- Test closing browser during active editing
- Test during DST transitions
- Test friend calendar access after role downgrade
```

---

## Section 10: Client Hooks

### Scope
- `client/src/hooks/useFriendshipEvents.ts` - Friendship WebSocket hook
- `client/src/hooks/useAuth.ts` - Authentication hook
- `client/src/hooks/useFriendSearch.ts` - Friend search hook

### Common Bug Patterns
- Stale closures in event handlers
- Missing dependency array entries
- Race conditions in async effects
- Memory leaks from subscriptions

### Agent Prompt
```
You are auditing the Client Hooks of a Photo Journal app.

FILES TO EXAMINE:
- client/src/hooks/useFriendshipEvents.ts (all 321 lines)
- client/src/hooks/useAuth.ts (all lines)
- client/src/hooks/useFriendSearch.ts (all lines)
- client/src/hooks/useAuthMigration.ts (all lines)

POTENTIAL BUGS TO FIND AND FIX:

1. STALE HANDLER REFERENCES: In useFriendshipEvents, handlersRef.current is updated on every render, but the WebSocket onmessage handler was set up with the original reference. Handlers passed to the hook won't receive events until reconnection.

2. MISSING CLEANUP IN AUTH MIGRATION: useAuthMigration polls for session changes but might not clean up the interval if the component unmounts during polling.

3. RACE CONDITION IN FRIEND SEARCH: useFriendSearch debounces the search query but doesn't cancel in-flight requests when the query changes. Results from a slow old request might overwrite newer results.

4. MEMORY LEAK IN EVENT SUBSCRIPTIONS: Supabase realtime subscriptions in hooks might not be properly cleaned up if the hook unmounts during the subscription setup.

5. INFINITE LOOP IN USER DATA FETCHING: If useAuth or useUser has a dependency that changes when user data updates, it could cause an infinite fetch loop.

6. CONDITIONAL HOOK CALLS: Check if any hooks have conditional early returns before other hook calls. This violates React's rules of hooks.

7. CALLBACK REFERENCE INSTABILITY: Hooks return callbacks that might not be memoized, causing child components to re-render unnecessarily.

FIX REQUIREMENTS:
- Ensure handler updates propagate to active WebSocket connections
- Add proper cleanup for all intervals and subscriptions
- Cancel in-flight requests when inputs change
- Ensure consistent hook call order (no conditional hooks)
- Memoize returned callbacks to prevent unnecessary re-renders

TESTING NOTES:
- Test changing event handlers while WebSocket is connected
- Test rapid search query changes
- Test component unmount during auth operations
- Test hook behavior in React StrictMode (double mounting)
```

---

## Section 11: Database Migrations & RLS Policies

### Scope
- `migrations/*.sql` - All database migrations
- `migrations/0013_add_friendships_rls_policies.sql` - RLS policies
- `migrations/0016_rls_policies_final.sql` - Final RLS fixes

### Common Bug Patterns
- Overlapping or conflicting RLS policies
- Missing policies for new tables
- Policy bypass through indirect access
- Inefficient policies causing slow queries

### Agent Prompt
```
You are auditing the Database Migrations & RLS Policies of a Photo Journal app.

FILES TO EXAMINE:
- All files in migrations/ directory
- Focus on: 0013_add_friendships_rls_policies.sql, 0014_fix_rls_policies_conflicts.sql, 0016_rls_policies_final.sql

POTENTIAL BUGS TO FIND AND FIX:

1. RLS POLICY CONFLICTS: Multiple policies on the same table might have overlapping conditions. PostgreSQL combines them with OR, which might allow unintended access.

2. FRIENDSHIP CANONICAL ORDERING IN RLS: RLS policies that check friendships need to handle the canonical ordering (userId < friendId). Policies that only check one direction might miss friendships.

3. MISSING POLICY FOR CONTENT BLOCKS: Check if content_blocks table has appropriate RLS policies that respect the entry ownership and sharing permissions.

4. POLICY BYPASS THROUGH JOURNAL ENTRIES: If journal_entries has different RLS policies than content_blocks, a user might be able to infer content block existence through entry metadata.

5. PERFORMANCE ISSUE IN SEARCH: Policies that use ilike or complex joins might cause sequential scans, slowing down the application as data grows.

6. USERNAME CHANGES AUDIT GAP: The username_changes table tracks changes, but RLS policies might prevent users from seeing their own audit trail.

7. TRIGGER RECURSION: Triggers that sync JWT claims or audit changes might cause infinite recursion if they update tables that have their own triggers.

FIX REQUIREMENTS:
- Review all RLS policies for logical completeness
- Ensure friendship lookups handle canonical ordering
- Add missing policies for content_blocks and other tables
- Optimize policies for performance with indexes
- Prevent trigger recursion with proper guards

TESTING NOTES:
- Test RLS policies with psql as different users
- Verify friendship access works regardless of who initiated
- Test that users can only see their own audit logs
- Test policy performance with large datasets
```

---

## Section 12: Photo/Storage System

### Scope
- `server/utils/photo-storage.ts` - Photo storage utilities
- `client/src/hooks/useProfilePicture.ts` - Profile picture hook
- `client/src/services/storage.service/` - Client storage service

### Common Bug Patterns
- URL expiration handling
- Cache invalidation issues
- File type validation bypass
- Race conditions in uploads

### Agent Prompt
```
You are auditing the Photo/Storage System of a Photo Journal app.

FILES TO EXAMINE:
- server/utils/photo-storage.ts (all lines)
- client/src/hooks/useProfilePicture.ts (all lines)
- client/src/services/storage.service/ directory

POTENTIAL BUGS TO FIND AND FIX:

1. SIGNED URL EXPIRATION RACE: Signed URLs have an expiration time, but if the client clock is out of sync with the server, URLs might appear valid but be rejected by Supabase.

2. CACHE INVALIDATION BUG: When a user updates their profile picture, old URLs might be cached by the browser or CDN. Check if cache-busting query parameters are used.

3. MAGIC NUMBER VALIDATION: The photo storage validates file types by extension but should validate by magic numbers (file headers) to prevent spoofing.

4. UPLOAD PROGRESS RACE: If an upload is cancelled and restarted quickly, the cleanup of the partial upload might interfere with the new upload.

5. PATH TRAVERSAL IN STORAGE: User-provided paths might contain "../" sequences that could access files outside the intended directory.

6. MISSING QUOTA CHECKS: Users might be able to upload unlimited photos, filling up storage. Check if quota enforcement exists.

7. TEMP FILE CLEANUP: Uploaded files might not be cleaned up if processing fails mid-way, causing disk space issues.

FIX REQUIREMENTS:
- Add clock skew handling for signed URLs
- Implement cache-busting for updated photos
- Add magic number validation for file types
- Ensure proper cleanup on upload cancellation
- Sanitize all user-provided paths
- Add storage quota enforcement

TESTING NOTES:
- Test with system clock set to different times
- Test rapid upload/cancel/upload cycles
- Test with files that have mismatched extensions and content
- Test path traversal attempts in filenames
```

---

## Section 13: Token/Crypto Utilities

### Scope
- `server/utils/token-crypto.ts` - Token encryption/decryption
- Client-side token handling

### Common Bug Patterns
- IV reuse in encryption
- Timing attacks on comparison
- Weak key derivation
- Plaintext token logging

### Agent Prompt
```
You are auditing the Token/Crypto Utilities of a Photo Journal app.

FILES TO EXAMINE:
- server/utils/token-crypto.ts (all lines)
- tests/unit/token-crypto.test.ts

POTENTIAL BUGS TO FIND AND FIX:

1. IV GENERATION: The initialization vector (IV) should be unique for every encryption operation. Check if IVs are randomly generated and never reused.

2. KEY DERIVATION: If a password is used directly as an encryption key, it's vulnerable to brute force. Check if a proper key derivation function (PBKDF2, Argon2, etc.) is used.

3. TIMING ATTACK: String comparison for token validation might be vulnerable to timing attacks. Check if constant-time comparison is used.

4. PADDING ORACLE: If using CBC mode without proper authentication (MAC/HMAC), the decryption might be vulnerable to padding oracle attacks.

5. ERROR INFORMATION LEAKAGE: Encryption/decryption errors might leak information about the plaintext (e.g., "padding error" vs "decryption error").

6. KEY STORAGE: The encryption key might be hardcoded or stored insecurely. Check if it's properly managed (environment variable, key management service).

FIX REQUIREMENTS:
- Ensure unique IV for each encryption operation
- Use authenticated encryption (AES-GCM) or add HMAC
- Implement constant-time comparison for tokens
- Sanitize error messages to prevent information leakage
- Ensure keys are properly managed, not hardcoded

TESTING NOTES:
- Verify IVs are unique across multiple encryptions
- Test for timing differences in comparison
- Test error handling doesn't leak information
- Test with tampered ciphertext
```

---

## Cross-Cutting Concerns

These bugs span multiple sections and require coordination:

### 1. Error Handling Consistency
- **Issue**: Different parts of the codebase use different error formats
- **Fix**: Standardize on { error: string, code: string, details?: any } format

### 2. Logging Strategy
- **Issue**: Mix of console.log, console.error, and no logging
- **Fix**: Implement structured logging with levels (debug, info, warn, error)

### 3. Type Safety Gaps
- **Issue**: Many `any` types, especially in API responses and event handlers
- **Fix**: Add strict typing for all API contracts and event payloads

### 4. Test Coverage
- **Issue**: Some critical paths lack unit tests
- **Fix**: Add tests for: permission resolution, friendship transitions, CRDT conflict resolution

### 5. Documentation
- **Issue**: Complex logic lacks inline documentation
- **Fix**: Add JSDoc comments for all exported functions, especially in utils/

---

## Testing Strategy

Before any fixes are deployed:

1. **Unit Tests**: Run `vitest run` to ensure existing tests pass
2. **Integration Tests**: Run integration tests with `docker-compose -f docker-compose.ci.yml up`
3. **End-to-End Testing**: Test critical user flows manually:
   - Sign up → Create journal → Add notes → Share with friend
   - Friend accepts → Views shared content → Adds collaborative content
   - Role changes → Permission updates reflect immediately
   - Calendar sync → Events appear correctly

4. **Load Testing**: Test with 100+ friends, 1000+ calendar events
5. **Security Testing**: Run basic penetration tests (SQL injection, XSS, CSRF)

---

## Priority Matrix

| Priority | Section | Reason |
|----------|---------|--------|
| P0 | Section 1 (Auth) | Security critical |
| P0 | Section 6 (API Routes) | Security critical |
| P1 | Section 3 (Permissions) | Data integrity |
| P1 | Section 5 (Storage) | Data integrity |
| P1 | Section 11 (RLS) | Security critical |
| P2 | Section 4 (Friendship) | Core feature |
| P2 | Section 8 (CRDT) | Core feature |
| P2 | Section 13 (Crypto) | Security |
| P3 | Section 2 (Rate Limiting) | Performance |
| P3 | Section 7 (State) | UX |
| P3 | Section 9 (Services) | UX |
| P3 | Section 10 (Hooks) | UX |
| P3 | Section 12 (Photos) | UX |

---

## Audit Completion Checklist

- [ ] Section 1: Auth Middleware audited and fixed
- [ ] Section 2: Rate Limiting audited and fixed
- [ ] Section 3: Permissions audited and fixed
- [ ] Section 4: Friendship System audited and fixed
- [ ] Section 5: Storage Layer audited and fixed
- [ ] Section 6: API Routes audited and fixed
- [ ] Section 7: State Management audited and fixed
- [ ] Section 8: CRDT SDK audited and fixed
- [ ] Section 9: Services audited and fixed
- [ ] Section 10: Hooks audited and fixed
- [ ] Section 11: RLS Policies audited and fixed
- [ ] Section 12: Photo Storage audited and fixed
- [ ] Section 13: Token Crypto audited and fixed
- [ ] All tests passing
- [ ] Integration tests passing
- [ ] Manual QA completed
