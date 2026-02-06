#!/bin/bash
# Apply critical security fixes to routes.ts
# This script makes minimal, targeted changes to avoid breaking the file

set -e  # Exit on error

BACKUP_FILE="/home/engine/project/server/routes.ts.backup-$(date +%s)"
cp /home/engine/project/server/routes.ts "$BACKUP_FILE"
echo "Created backup: $BACKUP_FILE"

# FIX 1: Add validateFileUploadWithMagicNumber function after existing validateFileUpload
# We'll insert it after line 479 (the closing brace of validateFileUpload)

cat > /tmp/magic_number_func.txt << 'EOF'

  /* Enhanced file validation with magic number checking to prevent MIME type spoofing */
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
EOF

# Insert after line 479 (after validateFileUpload function)
sed -i '479 r /tmp/magic_number_func.txt' /home/engine/project/server/routes.ts
echo "✓ Added validateFileUploadWithMagicNumber function"

# FIX 1b: Update /api/upload endpoint to use magic number validation
# The line should now be around 537 (shifted by 30 lines)
sed -i 's/const validationError = validateFileUpload(req, req.file);/const validationError = await validateFileUploadWithMagicNumber(req, req.file);/' /home/engine/project/server/routes.ts
echo "✓ Updated /api/upload to use magic number validation"

# FIX 4: Add path traversal validation to photo access endpoint
# Find the line with "const pathInfo = parsePhotoPath(storagePath);" and add validation after it
LINE_NUM=$(grep -n "const pathInfo = parsePhotoPath(storagePath);" /home/engine/project/server/routes.ts | cut -d: -f1 | head -1)
if [ -n "$LINE_NUM" ]; then
    # Insert path traversal validation
    sed -i "${LINE_NUM}a\\        // Validate userId to prevent path traversal attacks\n        if (pathInfo.userId.includes(\"..\") || pathInfo.userId.includes(\"/\") || pathInfo.userId.includes(\"\\\\\\\\\")) {\n          return res.status(400).json({ message: \"Invalid storage path\" });\n        }" /home/engine/project/server/routes.ts
    echo "✓ Added path traversal validation"
fi

echo ""
echo "Critical security fixes applied successfully!"
echo "Backup saved at: $BACKUP_FILE"
echo ""
echo "Fixes applied:"
echo "  1. Magic number validation for file uploads"
echo "  2. Path traversal protection for photo access"
echo ""
echo "Remaining fixes to apply manually:"
echo "  - OAuth state parameter (requires client-side changes)"
echo "  - Friend request race condition handling"
echo "  - Username TOCTOU handling"
echo "  - OAuth timeout handling"
echo "  - Error format standardization"
echo "  - Content-Type validation"
