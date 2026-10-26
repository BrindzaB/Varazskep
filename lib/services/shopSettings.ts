// Admin-editable shop settings, backed by the ShopSetting key/value table.
//
// Mirrors lib/pricing/settings.ts: an empty table is a valid state and every getter falls
// back to SHOP_SETTINGS_DEFAULTS, so a corrupt or missing row never stops an order email.

import { prisma } from "@/lib/db";

export interface ShopSettings {
  // Where the shop is notified about every new order (webshop and order form).
  notificationEmail: string;
}

export const SHOP_SETTINGS_DEFAULTS: ShopSettings = {
  notificationEmail: "info.varazskep@gmail.com",
};

const KEYS: Record<keyof ShopSettings, string> = {
  notificationEmail: "notification_email",
};

export const SHOP_SETTING_KEYS = Object.values(KEYS);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

function isValidEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL.test(value);
}

export async function getShopSettings(): Promise<ShopSettings> {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.shopSetting.findMany({
      select: { key: true, value: true },
    });
  } catch (err) {
    // Never let a settings read block an order email — the default address still works.
    console.error("[shopSettings] getShopSettings failed, using defaults:", err);
    return { ...SHOP_SETTINGS_DEFAULTS };
  }

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const stored = byKey.get(KEYS.notificationEmail);
  if (stored !== undefined && !isValidEmail(stored)) {
    console.error(
      `[shopSettings] Invalid stored value for ${KEYS.notificationEmail}: ${JSON.stringify(stored)} — using default.`
    );
  }
  return {
    notificationEmail:
      stored !== undefined && isValidEmail(stored)
        ? stored
        : SHOP_SETTINGS_DEFAULTS.notificationEmail,
  };
}

/**
 * Validates a raw request body into a full ShopSettings.
 * Returns a user-facing (Hungarian) error on failure.
 */
export function validateShopSettings(
  raw: unknown
): { ok: true; value: ShopSettings } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const email =
    typeof b.notificationEmail === "string" ? b.notificationEmail.trim() : "";
  if (!isValidEmail(email)) {
    return { ok: false, error: "Adj meg egy érvényes e-mail címet." };
  }
  return { ok: true, value: { notificationEmail: email } };
}

export async function updateShopSettings(input: ShopSettings): Promise<void> {
  const key = KEYS.notificationEmail;
  const value = input.notificationEmail;
  await prisma.shopSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
