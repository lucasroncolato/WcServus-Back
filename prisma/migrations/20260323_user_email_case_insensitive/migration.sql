DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User" u1
    JOIN "User" u2
      ON LOWER(u1."email") = LOWER(u2."email")
     AND u1."id" <> u2."id"
  ) THEN
    RAISE EXCEPTION 'Cannot create unique lower(email) index because duplicate emails already exist';
  END IF;
END
$$;

CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email"));
CREATE INDEX "User_createdAt_idx" ON "User" ("createdAt");
