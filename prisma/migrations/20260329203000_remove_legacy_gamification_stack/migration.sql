-- Remove legacy competitive gamification stack replaced by Journey.

DROP TABLE IF EXISTS "ServantReward";
DROP TABLE IF EXISTS "ServantRankingSnapshot";
DROP TABLE IF EXISTS "ServantAchievement";
DROP TABLE IF EXISTS "Achievement";
DROP TABLE IF EXISTS "ServantGamificationProfile";
DROP TABLE IF EXISTS "ServantPointLog";
DROP TABLE IF EXISTS "PointRule";
DROP TABLE IF EXISTS "ServantLevelDefinition";

DROP TYPE IF EXISTS "RewardSource";
DROP TYPE IF EXISTS "GamificationActionType";
DROP TYPE IF EXISTS "AchievementType";
