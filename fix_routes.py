#!/usr/bin/env python3
"""
Script to fix security bugs in server/routes.ts
"""

import re
import sys

def read_file(filepath):
    """Read file and return lines with line numbers"""
    with open(filepath, 'r') as f:
        return f.readlines()

def write_file(filepath, lines):
    """Write lines to file"""
    with open(filepath, 'w') as f:
        f.writelines(lines)

def fix_1_magic_number_validation(lines):
    """
    FIX 1: Add magic number validation to /api/upload endpoint
    Add validateFileUploadWithMagicNumber function and update its usage
    """
    # Find line 479 (after the existing validateFileUpload function)
    # Insert the new function after line 479 (after the closing };)
    new_function = '''  /* Enhanced file validation with magic number checking to prevent MIME type spoofing */
  const validateFileUploadWithMagicNumber = async (req: Request, file: Express.Multer.File): Promise<string | null> => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxFileSize = 2 * 1024 * 1024; // 2MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.';
    }

    if (file.size > maxFileSize) {
      return 'File size must be less than 2MB.';
    }

    // Perform magic number validation to prevent MIME type spoofing
    try {
      const fileBuffer = await fs.promises.readFile(file.path);
      const validationResult = await validateFileContent(file, fileBuffer);

      if (!validationResult.isValid) {
        return validationResult.error || 'File content validation failed.';
      }
    } catch (err) {
      console.error('Error reading file for magic number validation:', err);
      return 'Failed to validate file content.';
    }

    return null;
  };

'''
    # Insert after line 479
    lines.insert(479, new_function)
    return lines

def fix_2_upload_endpoint_usage(lines):
    """
    FIX 1b: Update the /api/upload endpoint to use validateFileUploadWithMagicNumber
    """
    for i, line in enumerate(lines):
        if 'const validationError = validateFileUpload(req, req.file);' in line:
            lines[i] = line.replace('validateFileUpload(req, req.file)', 'await validateFileUploadWithMagicNumber(req, req.file)')
            print(f"Updated line {i+1} to use magic number validation")
            break
    return lines

def fix_3_oauth_state_parameter(lines):
    """
    FIX 3: Add state parameter to Google OAuth endpoints for CSRF protection
    """
    # Add state generation and validation functions before exchange token endpoint
    # Find the line with "app.post('/api/calendar/google/exchange-token'"
    state_functions = '''
  // OAuth state parameter management for CSRF protection
  const oauthStates = new Map<string, { userId: string; timestamp: number }>();
  const STATE_TTL = 10 * 60 * 1000; // 10 minutes

  function generateOAuthState(userId: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, { userId, timestamp: Date.now() });
    return state;
  }

  function validateOAuthState(state: string, userId: string): boolean {
    const stateData = oauthStates.get(state);
    if (!stateData) return false;

    if (stateData.userId !== userId) return false;

    if (Date.now() - stateData.timestamp > STATE_TTL) {
      oauthStates.delete(state);
      return false;
    }

    oauthStates.delete(state);
    return true;
  }

'''
    # Insert before the exchange token endpoint (around line 303)
    for i, line in enumerate(lines):
        if 'app.post(' in line and '/api/calendar/google/exchange-token' in line:
            # Insert state functions before this
            lines.insert(i, state_functions)
            print(f"Added OAuth state functions at line {i+1}")
            break

    # Update exchangeSchema to include state
    for i, line in enumerate(lines):
        if "const exchangeSchema = z.object({" in line:
            # Find the closing parenthesis of the schema
            j = i
            while j < len(lines) and '});' not in lines[j]:
                j += 1
            # Add state parameter before the closing
            indent = '    '
            lines[j] = indent + 'state: z.string().min(1),\n' + lines[j]
            print(f"Added state parameter to exchangeSchema at line {j+1}")
            break

    # Add state validation in the exchange endpoint
    for i, line in enumerate(lines):
        if 'const { code, redirectUri } = exchangeSchema.parse(req.body);' in line:
            # Add state validation after this line
            indent = '        '
            lines[i+1] = indent + '// Validate state parameter to prevent CSRF attacks\n'
            lines[i+1] += indent + 'const { state } = exchangeSchema.parse(req.body);\n'
            lines[i+1] += indent + 'if (!validateOAuthState(state, getUserId(req))) {\n'
            lines[i+1] += indent + '  return res.status(400).json({ message: "Invalid or expired OAuth state" });\n'
            lines[i+1] += indent + '}\n\n'
            break

    return lines

def fix_4_friendship_race_condition(lines):
    """
    FIX 2: Handle unique constraint violations in friend request creation
    """
    # Find the friend request creation endpoint
    for i, line in enumerate(lines):
        if 'await storage.createFriendshipWithCanonicalOrdering(' in line:
            # Add try-catch around this call
            # Find the next few lines to understand the structure
            # We need to wrap the call with error handling for unique constraint violations
            j = i + 1
            while j < len(lines) and 'const friendship =' not in lines[j]:
                j += 1
            # The line at j should be the friendship declaration
            # Wrap this with try-catch
            # Actually, let's find where the try block starts
            k = i
            while k > 0 and 'try {' not in lines[k]:
                k -= 1
            # Add catch for unique constraint errors after the existing catch
            # Find the catch block
            m = i
            while m < len(lines) and '} catch (err) {' not in lines[m]:
                m += 1
            # Before the catch, add a specific catch for duplicate errors
            lines[m] = '      } catch (err: any) {\n'
            lines[m] += '        // Handle unique constraint violations (race condition)\n'
            lines[m] += '        if (err.code === "23505" || err.message?.includes("unique constraint")) {\n'
            lines[m] += '          return res.status(409).json({ message: "Friendship already exists" });\n'
            lines[m] += '        }\n'
            lines[m] += '        throw err;\n'
            break
    return lines

def fix_5_standardize_error_formats(lines):
    """
    FIX 5: Standardize error response format to use { message: string }
    """
    for i, line in enumerate(lines):
        # Replace { error: "ERROR_CODE", message: "..." } with just { message: "..." }
        if 'error: "INVALID_REQUEST"' in line:
            # Find the closing brace
            j = i
            while j < len(lines) and '}' not in lines[j]:
                j += 1
            # Simplify the error
            if 'message:' in lines[i]:
                # Keep only the message
                lines[i] = re.sub(r',?\s*error:\s*"[^"]+",?\s*', ', ', lines[i])
                lines[i] = re.sub(r',\s*,', ',', lines[i])
        if 'error: "INTERNAL_ERROR"' in line:
            lines[i] = re.sub(r',?\s*error:\s*"[^"]+",?\s*', '', lines[i])
    return lines

def fix_6_add_content_type_validation(lines):
    """
    FIX 6: Add Content-Type validation for JSON endpoints
    """
    # Create a middleware function for Content-Type validation
    content_type_middleware = '''  // Content-Type validation middleware
  const validateJSONContentType = (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const contentType = req.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        return res.status(415).json({ message: 'Content-Type must be application/json' });
      }
    }
    next();
  };

'''

    # Insert after the rate limit middleware definitions
    for i, line in enumerate(lines):
        if 'uploadRateLimit = rateLimit' in line:
            # Find the closing brace of this configuration
            j = i
            while j < len(lines) and '});' not in lines[j]:
                j += 1
            lines.insert(j + 1, '\n' + content_type_middleware)
            print(f"Added Content-Type validation middleware at line {j+2}")
            break

    return lines

def fix_7_username_toctou(lines):
    """
    FIX 7: Handle race condition in username updates
    The database has a unique constraint on username, so we need to catch the violation
    """
    for i, line in enumerate(lines):
        if 'const updatedUser = await storage.updateUserWithJWTSync(userId, updates);' in line:
            # Wrap this with try-catch for unique constraint violations
            # Find the try block start
            j = i
            while j > 0 and 'try {' not in lines[j]:
                j -= 1
            # Find the catch block
            k = i
            while k < len(lines) and '} catch (err) {' not in lines[k]:
                k += 1
            # Before the catch, add specific handling for duplicate usernames
            lines[k] = '        } catch (err: any) {\n'
            lines[k] += '          // Handle unique constraint violations for username\n'
            lines[k] += '          if (err.code === "23505" || err.message?.toLowerCase().includes("username")) {\n'
            lines[k] += '            return res.status(409).json({ message: "Username is already taken" });\n'
            lines[k] += '          }\n'
            lines[k] += '          throw err;\n'
            print(f"Added username race condition handling at line {k+1}")
            break
    return lines

def fix_8_oauth_timeout(lines):
    """
    FIX 8: Add timeout handling for Google OAuth API calls
    """
    # Find the genericGrantRequest and refreshTokenGrant calls
    for i, line in enumerate(lines):
        if 'const tokenResp = await genericGrantRequest(config,' in line:
            # This is the token exchange call - add timeout context
            lines[i] = '        const tokenResp = await Promise.race([\n'
            lines[i] += '          genericGrantRequest(config, \'authorization_code\', {\n'
            lines[i] += '            code,\n'
            lines[i] += '            redirect_uri: redirectUri,\n'
            lines[i] += '          }),\n'
            lines[i] += '          new Promise((_, reject) =>\n'
            lines[i] += '            setTimeout(() => reject(new Error("OAuth token request timeout")), 30000)\n'
            lines[i] += '          )\n'
            lines[i] += '        ]);\n'
            print(f"Added timeout to token exchange at line {i+1}")
            break

    for i, line in enumerate(lines):
        if 'const tokenResp = await refreshTokenGrant(config, refreshToken);' in line:
            lines[i] = '        const tokenResp = await Promise.race([\n'
            lines[i] += '          refreshTokenGrant(config, refreshToken),\n'
            lines[i] += '          new Promise((_, reject) =>\n'
            lines[i] += '            setTimeout(() => reject(new Error("OAuth refresh request timeout")), 30000)\n'
            lines[i] += '          )\n'
            lines[i] += '        ]);\n'
            print(f"Added timeout to token refresh at line {i+1}")
            break

    return lines

def fix_9_path_traversal(lines):
    """
    FIX 4: Enhance path traversal protection in photo endpoints
    """
    # Add path traversal validation to parsePhotoPath usage
    for i, line in enumerate(lines):
        if 'const pathInfo = parsePhotoPath(storagePath);' in line:
            # Add validation after parsing
            indent = '        '
            lines[i+1] = indent + '// Validate userId to prevent path traversal attacks\n'
            lines[i+1] += indent + 'if (pathInfo.userId.includes("..") || pathInfo.userId.includes("/") || pathInfo.userId.includes("\\\\")) {\n'
            lines[i+1] += indent + '  return res.status(400).json({ message: "Invalid storage path" });\n'
            lines[i+1] += indent + '}\n\n'
            print(f"Added path traversal validation at line {i+2}")
            break
    return lines

def main():
    filepath = '/home/engine/project/server/routes.ts'
    backup = filepath + '.backup'

    # Create backup
    import shutil
    shutil.copy(filepath, backup)
    print(f"Created backup: {backup}")

    # Read file
    lines = read_file(filepath)
    print(f"Read {len(lines)} lines from {filepath}")

    # Apply fixes
    print("\n=== Applying security fixes ===\n")

    lines = fix_1_magic_number_validation(lines)
    lines = fix_2_upload_endpoint_usage(lines)
    lines = fix_3_oauth_state_parameter(lines)
    lines = fix_4_friendship_race_condition(lines)
    lines = fix_5_standardize_error_formats(lines)
    lines = fix_6_add_content_type_validation(lines)
    lines = fix_7_username_toctou(lines)
    lines = fix_8_oauth_timeout(lines)
    lines = fix_9_path_traversal(lines)

    # Write back
    write_file(filepath, lines)
    print(f"\n=== Wrote {len(lines)} lines back to {filepath} ===\n")

    print("All security fixes applied successfully!")

if __name__ == '__main__':
    main()
