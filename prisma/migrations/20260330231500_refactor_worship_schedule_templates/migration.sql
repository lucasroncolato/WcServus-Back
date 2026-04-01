-- This migration became redundant after schema consolidation into
-- 20260330032237_init. Keeping it as an explicit no-op prevents
-- duplicate CREATE TYPE / CREATE TABLE errors during migrate reset.
SELECT 1;
