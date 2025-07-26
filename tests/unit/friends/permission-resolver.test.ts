import { describe, it, expect } from "vitest";
import { 
  resolveEffectivePermission, 
  canEditContentBlock, 
  canDeleteContentBlock,
  shouldRevokePrivileges,
  ROLE_RANKS 
} from "../../../server/utils/permission-resolver";
import { storage } from "../../../server/storage";

describe("Permission Resolver Unit Tests", () => {
  const userId = "user-123";
  const ownerId = "owner-456";
  const friendId = "friend-789";
  const entryId = "entry-001";

  describe("resolveEffectivePermission", () => {
    it("should give owner full permissions", () => {
      const result = resolveEffectivePermission({
        userId: ownerId,
        entryOwnerId: ownerId,
        entryId
      });

      expect(result.hasAccess).toBe(true);
      expect(result.effectiveRole).toBe("editor");
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.canCreate).toBe(true);
      expect(result.canDelete).toBe(true);
    });

    it("should deny access without friendship", () => {
      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId
      });

      expect(result.hasAccess).toBe(false);
      expect(result.effectiveRole).toBe(null);
      expect(result.reason).toBe("No friendship or entry not shared");
    });

    it("should resolve viewer role for accepted friendship", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "viewer",
        roleFriendToUser: "viewer"
      } as any;

      const result = resolveEffectivePermission({
        userId,
        entryOwnerId: ownerId,
        entryId,
        friendship
      });

      expect(result.hasAccess).toBe(true);
      expect(result.effectiveRole).toBe("viewer");
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false);
      expect(result.canCreate).toBe(false);
      expect(result.canDelete).toBe(false);
    });

    it("should resolve contributor role for accepted friendship", () => {
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

      expect(result.hasAccess).toBe(true);
      expect(result.effectiveRole).toBe("contributor");
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false); // Only own content
      expect(result.canCreate).toBe(true);
      expect(result.canDelete).toBe(false); // Only own content
    });

    it("should resolve editor role for accepted friendship", () => {
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

      expect(result.hasAccess).toBe(true);
      expect(result.effectiveRole).toBe("editor");
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(true);
      expect(result.canCreate).toBe(true);
      expect(result.canDelete).toBe(true);
    });

    it("should apply intersection rule with entry permissions", () => {
      const friendship = {
        status: "accepted",
        userId: ownerId,
        friendId: userId,
        roleUserToFriend: "editor",
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

      expect(result.effectiveRole).toBe("viewer"); // MIN(editor, view)
      expect(result.canView).toBe(true);
      expect(result.canEdit).toBe(false); // Limited by view permission
    });

    it("should deny access for non-accepted friendships", () => {
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
      expect(result.reason).toBe("No friendship or entry not shared");
    });
  });

  describe("canEditContentBlock", () => {
    it("should allow editors to edit any block", () => {
      const permissionResult = {
        effectiveRole: "editor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, "some-other-user", userId)).toBe(true);
    });

    it("should allow contributors to edit their own blocks", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, userId, userId)).toBe(true);
    });

    it("should deny contributors from editing others' blocks", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, "other-user", userId)).toBe(false);
    });

    it("should deny viewers from editing any blocks", () => {
      const permissionResult = {
        effectiveRole: "viewer",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, userId, userId)).toBe(false);
    });

    it("should handle null createdBy for contributors", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canEditContentBlock(permissionResult, null, userId)).toBe(false);
    });
  });

  describe("canDeleteContentBlock", () => {
    it("should allow editors to delete any block", () => {
      const permissionResult = {
        effectiveRole: "editor",
        hasAccess: true
      } as any;

      expect(canDeleteContentBlock(permissionResult, "some-other-user", userId)).toBe(true);
    });

    it("should allow contributors to delete their own blocks", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canDeleteContentBlock(permissionResult, userId, userId)).toBe(true);
    });

    it("should deny contributors from deleting others' blocks", () => {
      const permissionResult = {
        effectiveRole: "contributor",
        hasAccess: true
      } as any;

      expect(canDeleteContentBlock(permissionResult, "other-user", userId)).toBe(false);
    });

    it("should deny viewers from deleting any blocks", () => {
      const permissionResult = {
        effectiveRole: "viewer",
        hasAccess: true
      } as any;

      expect(canDeleteContentBlock(permissionResult, userId, userId)).toBe(false);
    });
  });

  describe("shouldRevokePrivileges", () => {
    it("should return true when role is downgraded", () => {
      expect(shouldRevokePrivileges("editor", "contributor")).toBe(true);
      expect(shouldRevokePrivileges("contributor", "viewer")).toBe(true);
      expect(shouldRevokePrivileges("editor", "viewer")).toBe(true);
    });

    it("should return false when role stays the same or is upgraded", () => {
      expect(shouldRevokePrivileges("editor", "editor")).toBe(false);
      expect(shouldRevokePrivileges("contributor", "editor")).toBe(false);
      expect(shouldRevokePrivileges("viewer", "contributor")).toBe(false);
    });
  });

  describe("ROLE_RANKS", () => {
    it("should have correct role rankings", () => {
      expect(ROLE_RANKS.viewer).toBe(1);
      expect(ROLE_RANKS.contributor).toBe(2);
      expect(ROLE_RANKS.editor).toBe(3);
    });
  });
});