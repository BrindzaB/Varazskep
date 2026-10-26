-- Print fees moved from two tiers (A4 / larger) to three (10x10 cm / A4 / A3).
-- Carry the stored values over to the renamed keys: the old "small" fee was the
-- A4 tier and the old "large" fee is now the A3 tier. The new 10x10 tier has no
-- row and falls back to its default (lib/pricing/settings.ts).
UPDATE "PricingSetting" SET "key" = 'print_fee_a4_huf' WHERE "key" = 'print_fee_small_huf';
UPDATE "PricingSetting" SET "key" = 'print_fee_a3_huf' WHERE "key" = 'print_fee_large_huf';
