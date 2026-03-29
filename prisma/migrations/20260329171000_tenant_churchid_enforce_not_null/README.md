# Tenant churchId hardening plan

## Phase A (backfill)
- Infer `churchId` from nearest parent relation (servant/ministry/service/user).
- Fallback to earliest church when inference is impossible.
- Non-destructive: no row deletions.

## Phase B (enforce)
- Set `churchId` as `NOT NULL` in tenant-critical tables.
- Reinforce FK `ON DELETE RESTRICT`.
- Add tenant composite indexes for hot queries.

## Rollback
1. Stop writes.
2. Restore database from pre-migration backup.
3. Mark failing migration as rolled back in migration table only after restore.
4. Re-run app with previous release tag.
