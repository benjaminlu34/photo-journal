# API Routes Security Audit Report

## Executive Summary

This report documents security vulnerabilities found in `/home/engine/project/server/routes.ts` (2075 lines, ~75KB) during a comprehensive security audit of the Photo Journal application's API routes.

## Critical Vulnerabilities Found

### 1. MISSING MAGIC NUMBER VALIDATION IN FILE UPLOAD (HIGH SEVERITY)

**Location:** `/api/upload` endpoint (lines 482-533)

**Issue:**
The generic file upload endpoint validates MIME types but does not validate actual file content using magic numbers. This allows attackers to upload executable files with image MIME type extensions.

**Current Code:**
```typescript
const validateFileUpload = (req: Request, file: Express.Multer.File): string | null => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxFileSize = 2 * 1024 * 1024; // 2MB

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.';
  }

  if (file.size > maxFileSize) {
    return 'File size must be less than 2MB.';
  }

  return null;
};
```

**Attack Scenario:**
An attacker can:
1. Create a malicious executable file (e.g., malware.exe)
2. Rename it to have an image extension (e.g., malware.jpg)
3. Upload it with a forged Content-Type header (image/jpeg)
4. The current validation would accept it
5. If served/executed, could compromise the system

**Recommendation:**
The photo upload endpoint (`/api/photos/upload`) already implements magic number validation (lines 564-570) using `validateFileContent` from `./utils/photo-storage.ts`. The same validation should be applied to all file uploads.

**Fix Required:**
- Add `validateFileUploadWithMagicNumber` function that reads file bytes and validates magic numbers
- Use the existing `validateFileContent` utility which has proper magic number checking for JPEG, PNG, GIF, and WebP

---

### 2. RACE CONDITION IN FRIEND REQUEST (MEDIUM SEVERITY)

**Location:** Friend request creation (lines 1006-1010)

**Issue:**
While the database has a unique constraint on `(user_id, friend_id)` (enforced in migration 0010), the application does not handle unique constraint violations gracefully. Two users sending simultaneous friend requests will cause one request to fail with an unhandled database error instead of a proper HTTP error response.

**Current Code:**
```typescript
const friendship = await storage.createFriendshipWithCanonicalOrdering(
  currentUserId,
  targetUser.id,
  currentUserId
);
```

**Attack Scenario:**
1. User A sends friend request to User B at t=0
2. User B sends friend request to User A at t=0 (simultaneous)
3. Both requests create friendship with canonical ordering (min(userA, userB), max(userA, userB))
4. One request inserts successfully
5. The other fails with PostgreSQL error: "duplicate key value violates unique constraint 'friendships_unique_pair'"
6. Error is not caught properly, returns 500 instead of 409 Conflict

**Database Constraints:**
```sql
-- From migration 0010_add_friends_system_enhancements.sql
ALTER TABLE friendships
  ADD CONSTRAINT friendships_canonical_order CHECK (user_id < friend_id);

ALTER TABLE friendships
  ADD CONSTRAINT friendships_unique_pair UNIQUE (user_id, friend_id);
```

**Recommendation:**
Catch unique constraint violations (PostgreSQL error code 23505) and return HTTP 409 Conflict with appropriate message.

---

### 3. MISSING CSRF PROTECTION IN GOOGLE OAUTH (HIGH SEVERITY)

**Location:** Google Calendar OAuth endpoints (lines 303-395)

**Issue:**
The OAuth 2.0 flow does not implement the `state` parameter to prevent Cross-Site Request Forgery (CSRF) attacks. This is a critical OAuth 2.0 security requirement per RFC 6749.

**Current Code:**
```typescript
const exchangeSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

app.post("/api/calendar/google/exchange-token", ... async (req, res) => {
  try {
    const { code, redirectUri } = exchangeSchema.parse(req.body);
    // No state parameter validation!
    const config = await getGoogleConfig();
    const tokenResp = await genericGrantRequest(config, 'authorization_code', {
      code,
      redirect_uri: redirectUri,
    });
```

**Attack Scenario:**
1. Attacker creates a malicious website
2. Victim is logged into the Photo Journal app
3. Attacker sends victim a link that makes a POST request to `/api/calendar/google/exchange-token`
4. Attacker provides their own authorization code
5. Victim's browser sends the request with victim's authentication cookies
6. Server exchanges attacker's code using victim's session
7. Attacker gains access to victim's Google Calendar

**Recommendation:**
Implement OAuth state parameter management:
1. Generate random state value before redirecting to Google OAuth
2. Pass state to Google in the authorization request
3. Google returns state in the callback
4. Validate returned state matches generated value
5. Use state with short TTL (10 minutes) and bind to user ID
6. Validate state before exchanging authorization code

---

### 4. PATH TRAVERSAL IN PHOTO ACCESS (MEDIUM SEVERITY)

**Location:** Photo access endpoints (lines 647-752)

**Issue:**
While the `/uploads/:userId` endpoint (lines 755-765) has proper userId validation, the photo API endpoints use `parsePhotoPath` which extracts userId from the storage path but doesn't validate for path traversal sequences.

**Current Code:**
```typescript
export function parsePhotoPath(storagePath: string): {
  userId: string;
  journalDate: string;
  fileName: string;
} | null {
  const pathParts = storagePath.split('/');

  if (pathParts.length !== 3) {
    return null;
  }

  const [userId, journalDate, fileName] = pathParts;

  // Validate date format (yyyy-mm-dd)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(journalDate)) {
    return null;
  }

  return {
    userId,
    journalDate,
    fileName
  };
}
```

**Attack Scenario:**
1. Attacker crafts a malicious storage path like `"../otheruser/2024-01-01/photo.jpg"`
2. `parsePhotoPath` splits by `/` and returns `{userId: "../otheruser", ...}`
3. The userId is used in permission checks
4. If the permission check doesn't handle this correctly, attacker might access other users' photos

**Mitigations:**
- The `/uploads/:userId` endpoint DOES have validation (lines 755-765)
- Photo access endpoints do validate ownership through `validatePhotoAccess`
- However, no explicit validation that userId doesn't contain path traversal sequences

**Recommendation:**
Add explicit validation that extracted userId does not contain `..`, `/`, or `\` characters.

---

### 5. INCONSISTENT ERROR RESPONSE FORMATS (LOW SEVERITY)

**Location:** Multiple routes throughout the file

**Issue:**
Different routes return different error response formats, making client-side error handling inconsistent and difficult.

**Examples Found:**

Format 1: `{ message: string }` (most common)
```typescript
return res.status(400).json({ message: "Invalid date format" });
return res.status(500).json({ message: "Failed to fetch journal entry" });
```

Format 2: `{ error: string, message: string }`
```typescript
return res.status(400).json({
  error: "INVALID_REQUEST",
  message: "Username parameter 'u' is required"
});
```

Format 3: `{ message: string, errors: object }`
```typescript
return res.status(400).json({ message: "Invalid data", errors: err.errors });
```

**Impact:**
- Client code must handle multiple formats
- Increases complexity and potential for bugs
- Inconsistent UX

**Recommendation:**
Standardize on `{ message: string }` format with optional `errors` array for validation errors:
```typescript
{
  message: string;  // Required, user-friendly error message
  errors?: Array<{ field: string; message: string }>;  // Optional, for form validation
}
```

---

### 6. MISSING CONTENT-TYPE VALIDATION (LOW SEVERITY)

**Location:** All POST/PUT/PATCH endpoints that expect JSON

**Issue:**
API endpoints do not validate the Content-Type header before parsing request bodies. This allows requests with incorrect or malformed Content-Type headers, potentially causing parsing errors or unexpected behavior.

**Examples:**
```typescript
app.post("/api/content-blocks", ... async (req, res) => {
  // No Content-Type validation
  const block = insertContentBlockSchema.parse(req.body);
```

**Attack Scenario:**
1. Attacker sends POST request with `Content-Type: text/plain` or `Content-Type: application/x-www-form-urlencoded`
2. `req.body` is parsed incorrectly or is empty
3. May cause unexpected behavior, errors, or information disclosure

**Recommendation:**
Add middleware to validate Content-Type for JSON endpoints:
```typescript
const validateJSONContentType = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({ message: 'Content-Type must be application/json' });
    }
  }
  next();
};
```

---

### 7. TIME-OF-CHECK-TIME-OF-USE (TOCTOU) IN USERNAME UPDATES (MEDIUM SEVERITY)

**Location:** Username check endpoint (line 1899) and username update endpoint (line 398)

**Issue:**
The username availability check and username update are separate operations. Between these operations, another request could take the username, creating a race condition.

**Current Code:**

Check endpoint:
```typescript
app.get("/api/user/check-username", ... async (req, res) => {
  const username = req.query.u as string;
  // ...
  const isAvailable = await storage.checkUsernameAvailability(username);
  if (!isAvailable) {
    return res.json({ available: false, error: "Username is already taken" });
  }
  return res.json({ available: true });
});
```

Update endpoint:
```typescript
app.patch("/api/auth/profile", ... async (req, res) => {
  // ...
  const updatedUser = await storage.updateUserWithJWTSync(userId, updates);
  // No handling if username is taken
});
```

**Attack Scenario:**
1. User A checks if "alice" is available → Server says YES (line 1899)
2. User A sends request to update username to "alice" (line 398)
3. Between step 1 and 2, User B also requests "alice"
4. Both requests reach the database update
5. One succeeds, the other fails with PostgreSQL unique constraint violation
6. User who fails gets a generic 500 error instead of proper 409 Conflict

**Database Constraint:**
```typescript
// From shared/schema/schema.ts
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  username: varchar("username", { length: 20 }).unique(),  // UNIQUE constraint
  // ...
});
```

**Recommendation:**
Catch unique constraint violations for username updates and return HTTP 409 Conflict with appropriate message.

---

### 8. MISSING TIMEOUT HANDLING IN OAUTH API CALLS (MEDIUM SEVERITY)

**Location:** Google OAuth token exchange and refresh (lines 318, 355)

**Issue:**
Google OAuth API calls do not have explicit timeout handling. Slow or hanging responses from Google's servers could cause the application to hang or accumulate many pending requests, leading to resource exhaustion.

**Current Code:**
```typescript
const tokenResp = await genericGrantRequest(config, 'authorization_code', {
  code,
  redirect_uri: redirectUri,
});
```

**Attack Scenario:**
1. Attacker sends many requests to `/api/calendar/google/exchange-token`
2. Google's servers are slow or unresponsive (either due to attack or genuine issues)
3. Each request waits indefinitely
4. Server accumulates many open connections
5. Node.js event loop is blocked
6. Server becomes unresponsive (DoS)

**Recommendation:**
Wrap API calls with Promise.race to add 30-second timeout:
```typescript
const tokenResp = await Promise.race([
  genericGrantRequest(config, 'authorization_code', { code, redirect_uri: redirectUri }),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("OAuth token request timeout")), 30000)
  )
]);
```

---

## Summary of Required Fixes

| # | Issue | Severity | Lines Affected | Fix Complexity |
|---|--------|----------|----------------|----------------|
| 1 | Missing magic number validation | HIGH | 482-533, 466-479 | Medium |
| 2 | Friend request race condition | MEDIUM | 1006-1050 | Low |
| 3 | Missing OAuth state parameter | HIGH | 303-395 | High |
| 4 | Photo path traversal | MEDIUM | 647-752 | Low |
| 5 | Inconsistent error formats | LOW | Throughout | Low |
| 6 | Missing Content-Type validation | LOW | Throughout | Low |
| 7 | Username TOCTOU | MEDIUM | 398-454, 1899-1932 | Low |
| 8 | Missing OAuth timeouts | MEDIUM | 318, 355 | Low |

## Testing Recommendations

1. **File Upload Testing:**
   - Upload file with .jpg extension but EXE content
   - Verify it's rejected with magic number error
   - Test with genuine image files to ensure they're accepted

2. **Friend Request Testing:**
   - Send simultaneous friend requests from User A to B and B to A
   - Verify one returns 201 Created and the other returns 409 Conflict
   - Test with curl or automation for timing

3. **OAuth CSRF Testing:**
   - Initiate OAuth flow
   - Try to exchange code with different/missing state parameter
   - Verify request is rejected

4. **Path Traversal Testing:**
   - Try to access photo with path like `"../otheruser/2024-01-01/photo.jpg"`
   - Verify request is rejected with 400 or 403

5. **Username Race Condition Testing:**
   - Simultaneously send two username update requests for the same username
   - Verify one succeeds, other returns 409 Conflict

6. **Error Format Testing:**
   - Trigger various errors from different endpoints
   - Verify all return `{ message: string }` format

---

## Priority Order for Implementation

1. **CRITICAL (Immediate):** #1 (Magic numbers), #3 (OAuth state)
2. **HIGH (This Sprint):** #2 (Friend race), #4 (Path traversal), #7 (Username TOCTOU)
3. **MEDIUM (Next Sprint):** #8 (OAuth timeouts), #6 (Content-Type validation)
4. **LOW (Tech Debt):** #5 (Error format standardization)

---

**Audited:** 2025-02-06
**Auditor:** Security Audit Agent
**File:** /home/engine/project/server/routes.ts
**Lines:** 2,075
**Vulnerabilities Found:** 8 (2 HIGH, 5 MEDIUM, 1 LOW)
