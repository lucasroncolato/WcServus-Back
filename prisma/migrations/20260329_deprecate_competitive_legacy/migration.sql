-- Phase 1 (safe): keep legacy structures for compatibility, but mark them as deprecated.
COMMENT ON TABLE "ServantReward" IS 'DEPRECATED: legacy points artifact. Do not expose in servant journey.';
COMMENT ON COLUMN "ServantReward"."points" IS 'DEPRECATED: competitive points value. Internal legacy only.';

COMMENT ON TABLE "PointRule" IS 'DEPRECATED: legacy gamification points rule.';
COMMENT ON TABLE "ServantPointLog" IS 'DEPRECATED: legacy points log. Journey logs are canonical for servant experience.';
COMMENT ON TABLE "ServantGamificationProfile" IS 'DEPRECATED: legacy competitive profile (points/ranking).';
COMMENT ON TABLE "Achievement" IS 'DEPRECATED: replaced by JourneyMilestone in servant experience.';
COMMENT ON TABLE "ServantAchievement" IS 'DEPRECATED: replaced by ServantMilestone in servant experience.';
COMMENT ON TABLE "ServantRankingSnapshot" IS 'DEPRECATED: legacy ranking snapshot.';

-- No DROP in this migration. Destructive cleanup should run only after a full retention window.
