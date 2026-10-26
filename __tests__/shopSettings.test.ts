import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { shopSetting: { findMany: mockFindMany, upsert: vi.fn() } },
}));

import {
  getShopSettings,
  validateShopSettings,
  SHOP_SETTINGS_DEFAULTS,
} from "@/lib/services/shopSettings";

describe("getShopSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("falls back to the default address on an empty table", async () => {
    mockFindMany.mockResolvedValue([]);
    expect(await getShopSettings()).toEqual(SHOP_SETTINGS_DEFAULTS);
  });

  it("returns the stored address", async () => {
    mockFindMany.mockResolvedValue([
      { key: "notification_email", value: "bolt@example.com" },
    ]);
    expect((await getShopSettings()).notificationEmail).toBe("bolt@example.com");
  });

  it("ignores a corrupt stored address", async () => {
    mockFindMany.mockResolvedValue([
      { key: "notification_email", value: "not-an-email" },
    ]);
    expect((await getShopSettings()).notificationEmail).toBe(
      SHOP_SETTINGS_DEFAULTS.notificationEmail
    );
  });

  it("falls back to the defaults when the database is unreachable", async () => {
    mockFindMany.mockRejectedValue(new Error("timeout"));
    expect(await getShopSettings()).toEqual(SHOP_SETTINGS_DEFAULTS);
  });
});

describe("validateShopSettings", () => {
  it("trims and accepts a valid address", () => {
    expect(
      validateShopSettings({ notificationEmail: "  bolt@example.com " })
    ).toEqual({ ok: true, value: { notificationEmail: "bolt@example.com" } });
  });

  it.each([undefined, "", "bolt", "bolt@example", "a b@example.com", 42])(
    "rejects %s",
    (notificationEmail) => {
      expect(validateShopSettings({ notificationEmail }).ok).toBe(false);
    }
  );

  it("rejects a missing body", () => {
    expect(validateShopSettings(null).ok).toBe(false);
  });
});
