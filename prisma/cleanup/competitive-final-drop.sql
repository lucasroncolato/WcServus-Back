-- FINAL COMPETITIVE LEGACY DROP PLAN (execute only after retention window approval)
-- Safety pre-checks:
-- 1) Ensure no active code imports legacy competitive models.
-- 2) Ensure no API route exposes points/ranking.
-- 3) Backup data before destructive phase.

BEGIN;

-- Optional archival example:
-- CREATE TABLE IF NOT EXISTS "_archive_servant_point_log" AS TABLE "ServantPointLog" WITH DATA;
-- CREATE TABLE IF NOT EXISTS "_archive_servant_ranking_snapshot" AS TABLE "ServantRankingSnapshot" WITH DATA;

DROP TABLE IF EXISTS "ServantRankingSnapshot";
DROP TABLE IF EXISTS "ServantAchievement";
DROP TABLE IF EXISTS "Achievement";
DROP TABLE IF EXISTS "ServantGamificationProfile";
DROP TABLE IF EXISTS "ServantPointLog";
DROP TABLE IF EXISTS "PointRule";

COMMIT;

-- Rollback plan (manual):
-- 1) Restore backup snapshot.
-- 2) Re-run previous Prisma migration baseline.
-- 3) Re-deploy backend revision that still references legacy tables (if required).
