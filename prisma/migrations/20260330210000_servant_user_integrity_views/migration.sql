-- Detailed integrity diagnostics for User <-> Servant link consistency.
DROP VIEW IF EXISTS "servant_user_integrity_summary_view";
DROP VIEW IF EXISTS "servant_user_integrity_view";

CREATE VIEW "servant_user_integrity_view" AS
WITH active_users AS (
  SELECT
    u."id",
    u."churchId",
    u."role",
    u."servantId",
    u."email",
    u."deletedAt"
  FROM "User" u
  WHERE u."deletedAt" IS NULL
),
active_servants AS (
  SELECT
    s."id",
    s."churchId",
    s."name",
    s."deletedAt"
  FROM "Servant" s
  WHERE s."deletedAt" IS NULL
)
SELECT
  'SERVANT_WITHOUT_USER'::text AS issue_type,
  'manual_review'::text AS severity,
  s."churchId" AS church_id,
  NULL::text AS user_id,
  s."id" AS servant_id,
  format('Servant %s has no linked user account.', s."id") AS message
FROM active_servants s
LEFT JOIN active_users u ON u."servantId" = s."id"
WHERE u."id" IS NULL

UNION ALL

SELECT
  'SERVO_USER_WITHOUT_SERVANT'::text AS issue_type,
  'blocking'::text AS severity,
  u."churchId" AS church_id,
  u."id" AS user_id,
  NULL::text AS servant_id,
  format('User %s with role SERVO has null servantId.', u."id") AS message
FROM active_users u
WHERE u."role" = 'SERVO'::"Role"
  AND u."servantId" IS NULL

UNION ALL

SELECT
  'USER_SERVANT_POINTER_BROKEN'::text AS issue_type,
  'blocking'::text AS severity,
  u."churchId" AS church_id,
  u."id" AS user_id,
  u."servantId" AS servant_id,
  format('User %s points to non-existent servantId %s.', u."id", u."servantId") AS message
FROM active_users u
LEFT JOIN active_servants s ON s."id" = u."servantId"
WHERE u."servantId" IS NOT NULL
  AND s."id" IS NULL

UNION ALL

SELECT
  'CROSS_TENANT_USER_SERVANT_LINK'::text AS issue_type,
  'blocking'::text AS severity,
  u."churchId" AS church_id,
  u."id" AS user_id,
  s."id" AS servant_id,
  format(
    'Cross-tenant link detected: user churchId=%s, servant churchId=%s.',
    u."churchId",
    s."churchId"
  ) AS message
FROM active_users u
JOIN active_servants s ON s."id" = u."servantId"
WHERE u."servantId" IS NOT NULL
  AND u."churchId" <> s."churchId"

UNION ALL

SELECT
  'MULTIPLE_USERS_FOR_SAME_SERVANT'::text AS issue_type,
  'blocking'::text AS severity,
  MIN(u."churchId") AS church_id,
  NULL::text AS user_id,
  u."servantId" AS servant_id,
  format('Servant %s linked to %s users.', u."servantId", COUNT(*)::text) AS message
FROM active_users u
WHERE u."servantId" IS NOT NULL
GROUP BY u."servantId"
HAVING COUNT(*) > 1

UNION ALL

SELECT
  'ADMIN_ACCOUNT_LINKED_TO_SERVANT'::text AS issue_type,
  'manual_review'::text AS severity,
  u."churchId" AS church_id,
  u."id" AS user_id,
  u."servantId" AS servant_id,
  format('Administrative user %s (%s) is linked to a servant.', u."id", u."role"::text) AS message
FROM active_users u
WHERE u."servantId" IS NOT NULL
  AND u."role" IN ('SUPER_ADMIN'::"Role", 'ADMIN'::"Role");

CREATE VIEW "servant_user_integrity_summary_view" AS
SELECT
  issue_type,
  severity,
  church_id,
  COUNT(*)::bigint AS issue_count,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)::bigint AS affected_users,
  COUNT(*) FILTER (WHERE servant_id IS NOT NULL)::bigint AS affected_servants
FROM "servant_user_integrity_view"
GROUP BY issue_type, severity, church_id;
