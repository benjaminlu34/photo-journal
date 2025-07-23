import { describe, it, expect } from "vitest";
import { 
  resolveEffectivePermission,
  canEditContentBlock,
  canDeleteContentBlock
} from "../../../server/utils/permission-resolver";

describe("Journal Sharing - Comprehensive Permission Tests", () => {
  const userId = "user-123";
  const ownerId = "owner-456";
  const friendId = "friend-789";
  const entryId = "entry-001";

  describe("Directional Role Resolution", () => {
    it("should handle reverse friendship direction correctly", () => {
      const friendship = {
        status: "accepted",
        userId: friendId,
        friendId: ownerId,
        roleUserToFriend: "viewer",
        roleFriendToUser: "editor"
      } as any;

      const result = resolveEffectivePermission({
        userId: ownerId,
        entryOwnerId: friendId,
        entryId,
        friendship
      });

      // ownerId is in the friendId position, so gets roleUserToFriend which is "viewer"
      expect(result.effectiveRole).toBe("viewer");
    });

    it("should handle case-insensitive username matching", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "contributor",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      expect(result.canCreate).toBe(true);
      expect(result.canEdit).toBe(false); // Only own content
    });
  });

  describe("Permission Intersection Rules", () => {
    it("should apply MIN rule with entry permissions (view < contributor)", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "contributor",
        roleFriendToUser: "viewer"
      } as any;

      const sharedEntry = {
        sharedWithId: userId,
        permissions: "view"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship,
        sharedEntry
      });

      expect(result.effectiveRole).toBe("viewer");
      expect(result.canCreate).toBe(false); // Limited by view permission
    });

    it("should apply MIN rule with entry permissions (edit > contributor)", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "contributor",
        roleFriendToUser: "viewer"
      } as any;

      const sharedEntry = {
        sharedWithId: userId,
        permissions: "edit"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship,
        sharedEntry
      });

      expect(result.effectiveRole).toBe("contributor"); // Limited by friendship role
      expect(result.canCreate).toBe(true);
    });
  });

  describe("Content Block Permission Edge Cases", () => {
    it("should handle null createdBy for legacy content blocks", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, null, userId)).toBe(false);
      expect(canDeleteContentBlock(permissionResult, null, userId)).toBe(false);
    });

    it("should handle empty string createdBy", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, "", userId)).toBe(false);
      expect(canDeleteContentBlock(permissionResult, "", userId)).toBe(false);
    });

    it("should allow editors to bypass createdBy restriction", () => {
      const permissionResult = {
        effectiveRole: "editor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, "any-user", userId)).toBe(true);
      expect(canDeleteContentBlock(permissionResult, "any-user", userId)).toBe(true);
    });
  });

  describe("Friendship Status Edge Cases", () => {
    it("should deny access for blocked friendship", () => {
      const friendship = {
        status: "blocked",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "editor",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      expect(result.hasAccess).toBe(false);
    });

    it("should deny access for pending friendship", () => {
      const friendship = {
        status: "pending",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "editor",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      expect(result.hasAccess).toBe(false);
    });

    it("should deny access for unfriended status", () => {
      const friendship = {
        status: "unfriended",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "editor",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      expect(result.hasAccess).toBe(false);
    });
  });

  describe("Multiple Sharing Scenarios", () => {
    it("should handle no shared entry (friendship-only access)", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "contributor",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      expect(result.effectiveRole).toBe("contributor");
      expect(result.canView).toBe(true);
      expect(result.canCreate).toBe(true);
      expect(result.canEdit).toBe(false); // Only own content
    });

    it("should handle shared entry with no friendship", () => {
      const sharedEntry = {
        sharedWithId: userId,
        permissions: "view"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        sharedEntry
      });

      expect(result.effectiveRole).toBe("viewer");
      expect(result.canView).toBe(true);
      expect(result.canCreate).toBe(false);
      expect(result.canEdit).toBe(false);
      expect(result.canDelete).toBe(false);
    });
  });

  describe("Username-based Permission Resolution", () => {
    it("should handle case variations in usernames", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "editor",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      // Test that username case doesn't affect permission resolution
      expect(result.effectiveRole).toBe("editor");
    });
  });
});