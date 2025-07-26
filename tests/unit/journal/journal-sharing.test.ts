import { describe, it, expect } from "vitest";
import { resolveEffectivePermission } from "../../../server/utils/permission-resolver";

describe("Journal Sharing - Permission Resolver", () => {
  const userId = "user-123";
  const ownerId = "owner-456";
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
    });

    it("should resolve viewer role for friendship", () => {
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

      expect(result.effectiveRole).toBe("viewer");
    });

    it("should resolve contributor role for friendship", () => {
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
    });

    it("should resolve editor role for friendship", () => {
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

      expect(result.effectiveRole).toBe("editor");
    });
  });
});