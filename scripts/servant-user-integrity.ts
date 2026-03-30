import { AuditAction, PrismaClient, Role, UserScope, UserStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

type Mode = 'diagnose' | 'repair';
type Classification = 'auto_repairable' | 'manual_review' | 'blocking';

type ParsedArgs = {
  mode: Mode;
  dryRun: boolean;
  exampleLimit: number;
  writeReportPath: string | null;
  defaultPassword: string;
  provisionMissingUser: boolean;
  provisionEmailDomain: string;
};

type ServantRow = {
  id: string;
  churchId: string;
  name: string;
  phone: string | null;
  status: string;
  trainingStatus: string;
  approvalStatus: string;
  createdAt: Date;
  deletedAt: Date | null;
  linkedUser: {
    id: string;
    role: Role;
    churchId: string;
    email: string;
    status: UserStatus;
  } | null;
};

type UserRow = {
  id: string;
  churchId: string;
  name: string;
  email: string;
  role: Role;
  scope: UserScope;
  status: UserStatus;
  phone: string | null;
  servantId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

type IssueEntry = {
  id: string;
  churchId?: string;
  severity: Classification;
  reason: string;
  suggestedAction: string;
  details?: Record<string, unknown>;
};

type IssueBucket = {
  key: string;
  title: string;
  severity: Classification;
  total: number;
  examples: IssueEntry[];
};

type RepairAction = {
  action: string;
  severity: Classification;
  churchId: string;
  userId?: string;
  servantId?: string;
  dryRun: boolean;
  applied: boolean;
  reason: string;
  details?: Record<string, unknown>;
};

type DiagnoseResult = {
  generatedAt: string;
  mode: Mode;
  dryRun: boolean;
  summary: {
    totalUsers: number;
    totalServants: number;
    totalIssues: number;
    autoRepairable: number;
    manualReview: number;
    blocking: number;
  };
  buckets: IssueBucket[];
  repair: {
    eligible: number;
    applied: number;
    skipped: number;
    errors: number;
    actions: RepairAction[];
    failures: Array<{ action: RepairAction; error: string }>;
  };
};

const prisma = new PrismaClient();

function parseArgs(argv: string[]): ParsedArgs {
  const raw = new Map<string, string>();
  for (const token of argv) {
    if (!token.startsWith('--')) {
      continue;
    }
    const [k, ...rest] = token.slice(2).split('=');
    raw.set(k, rest.length ? rest.join('=') : 'true');
  }

  const modeRaw = (raw.get('mode') ?? 'diagnose').toLowerCase();
  if (modeRaw !== 'diagnose' && modeRaw !== 'repair') {
    throw new Error("--mode must be 'diagnose' or 'repair'.");
  }

  const dryRunRaw = (raw.get('dry-run') ?? (modeRaw === 'repair' ? 'true' : 'true')).toLowerCase();
  if (!['true', 'false'].includes(dryRunRaw)) {
    throw new Error("--dry-run must be true or false.");
  }

  const exampleLimitRaw = Number.parseInt(raw.get('example-limit') ?? '20', 10);
  if (Number.isNaN(exampleLimitRaw) || exampleLimitRaw < 1 || exampleLimitRaw > 500) {
    throw new Error('--example-limit must be an integer between 1 and 500.');
  }

  const provisionMissingUserRaw = (raw.get('provision-missing-user') ?? 'false').toLowerCase();
  if (!['true', 'false'].includes(provisionMissingUserRaw)) {
    throw new Error('--provision-missing-user must be true or false.');
  }

  return {
    mode: modeRaw,
    dryRun: dryRunRaw === 'true',
    exampleLimit: exampleLimitRaw,
    writeReportPath: raw.get('write-report') ?? null,
    defaultPassword: raw.get('default-password') ?? process.env.ONBOARDING_DEFAULT_PASSWORD ?? 'Servus@123',
    provisionMissingUser: provisionMissingUserRaw === 'true',
    provisionEmailDomain: raw.get('provision-email-domain') ?? 'repair.servos.local',
  };
}

function normalizePhone(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.replace(/\D/g, '');
}

function normalizeName(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.trim().toLowerCase();
}

function servantIdentityKey(servant: Pick<ServantRow, 'name' | 'phone' | 'churchId'>): string {
  return `${servant.churchId}|${normalizeName(servant.name)}|${normalizePhone(servant.phone)}`;
}

function userIdentityKey(user: Pick<UserRow, 'name' | 'phone' | 'churchId'>): string {
  return `${user.churchId}|${normalizeName(user.name)}|${normalizePhone(user.phone)}`;
}

function createBucket(
  key: string,
  title: string,
  severity: Classification,
  entries: IssueEntry[],
  limit: number,
): IssueBucket {
  return {
    key,
    title,
    severity,
    total: entries.length,
    examples: entries.slice(0, limit),
  };
}

function isValidAccessEmail(email: string): boolean {
  const trimmed = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function buildProvisionEmail(servant: Pick<ServantRow, 'id' | 'name'>, domain: string): string {
  const nameChunk = normalizeName(servant.name).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  const base = nameChunk || 'servant';
  return `${base}.${servant.id.slice(-8)}@${domain}`;
}

async function collectData() {
  const [servantsRaw, usersRaw] = await Promise.all([
    prisma.servant.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        churchId: true,
        name: true,
        phone: true,
        status: true,
        trainingStatus: true,
        approvalStatus: true,
        createdAt: true,
        deletedAt: true,
        userAccount: {
          select: {
            id: true,
            role: true,
            churchId: true,
            email: true,
            status: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        churchId: true,
        name: true,
        email: true,
        role: true,
        scope: true,
        status: true,
        phone: true,
        servantId: true,
        createdAt: true,
        deletedAt: true,
      },
    }),
  ]);

  const servants: ServantRow[] = servantsRaw.map((servant) => ({
    id: servant.id,
    churchId: servant.churchId,
    name: servant.name,
    phone: servant.phone,
    status: String(servant.status),
    trainingStatus: String(servant.trainingStatus),
    approvalStatus: String(servant.approvalStatus),
    createdAt: servant.createdAt,
    deletedAt: servant.deletedAt,
    linkedUser: servant.userAccount
      ? {
          id: servant.userAccount.id,
          role: servant.userAccount.role,
          churchId: servant.userAccount.churchId,
          email: servant.userAccount.email,
          status: servant.userAccount.status,
        }
      : null,
  }));

  const users: UserRow[] = usersRaw.map((user) => ({
    id: user.id,
    churchId: user.churchId,
    name: user.name,
    email: user.email,
    role: user.role,
    scope: user.scope,
    status: user.status,
    phone: user.phone,
    servantId: user.servantId,
    createdAt: user.createdAt,
    deletedAt: user.deletedAt,
  }));

  return { servants, users };
}

async function diagnoseAndRepair(args: ParsedArgs): Promise<DiagnoseResult> {
  const { servants, users } = await collectData();

  const servantsById = new Map(servants.map((servant) => [servant.id, servant]));
  const usersById = new Map(users.map((user) => [user.id, user]));

  const unlinkedServants = servants.filter((servant) => !servant.linkedUser);
  const servoUsersWithoutServant = users.filter((user) => user.role === Role.SERVO && !user.servantId);

  const crossTenantLinks: IssueEntry[] = [];
  const adminLinkedToServant: IssueEntry[] = [];

  for (const user of users) {
    if (!user.servantId) {
      continue;
    }
    const servant = servantsById.get(user.servantId);

    if (!servant) {
      crossTenantLinks.push({
        id: user.id,
        churchId: user.churchId,
        severity: 'blocking',
        reason: 'User points to non-existent Servant.',
        suggestedAction: 'Manual review required; recreate or relink servant safely.',
        details: { userId: user.id, servantId: user.servantId, userRole: user.role },
      });
      continue;
    }

    if (servant.churchId !== user.churchId) {
      crossTenantLinks.push({
        id: user.id,
        churchId: user.churchId,
        severity: 'blocking',
        reason: 'Cross-tenant link detected between User and Servant.',
        suggestedAction: 'Manual review required; break and relink within same churchId.',
        details: { userId: user.id, servantId: servant.id, userChurchId: user.churchId, servantChurchId: servant.churchId },
      });
    }

    if ((user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) && user.servantId) {
      adminLinkedToServant.push({
        id: user.id,
        churchId: user.churchId,
        severity: 'manual_review',
        reason: 'Administrative account is linked to a servant.',
        suggestedAction: 'Validate identity intent; usually should be unlinked.',
        details: { userId: user.id, role: user.role, servantId: user.servantId },
      });
    }
  }

  const duplicateEmailsRaw = await prisma.$queryRaw<Array<{ email_norm: string; count: bigint }>>`
    SELECT LOWER("email") AS email_norm, COUNT(*)::bigint AS count
    FROM "User"
    WHERE "deletedAt" IS NULL
    GROUP BY LOWER("email")
    HAVING COUNT(*) > 1
  `;

  const duplicateEmails: IssueEntry[] = duplicateEmailsRaw.map((row) => ({
    id: row.email_norm,
    severity: 'blocking',
    reason: 'Duplicate login/email detected among active users.',
    suggestedAction: 'Manual dedup required before rollout.',
    details: { normalizedEmail: row.email_norm, count: Number(row.count) },
  }));

  const duplicateServantLinkRaw = await prisma.$queryRaw<Array<{ servant_id: string; count: bigint }>>`
    SELECT "servantId" AS servant_id, COUNT(*)::bigint AS count
    FROM "User"
    WHERE "deletedAt" IS NULL AND "servantId" IS NOT NULL
    GROUP BY "servantId"
    HAVING COUNT(*) > 1
  `;

  const duplicateServantLinks: IssueEntry[] = duplicateServantLinkRaw.map((row) => ({
    id: row.servant_id,
    severity: 'blocking',
    reason: 'Multiple users linked to the same servant (1:N violation).',
    suggestedAction: 'Manual dedup and link normalization required before rollout.',
    details: { servantId: row.servant_id, linkedUsers: Number(row.count) },
  }));

  const servantsMissingAccessData: IssueEntry[] = [];
  for (const servant of unlinkedServants) {
    const phoneDigits = normalizePhone(servant.phone);
    const nameNorm = normalizeName(servant.name);
    if (!nameNorm || nameNorm.length < 3 || phoneDigits.length < 10 || phoneDigits.length > 11) {
      servantsMissingAccessData.push({
        id: servant.id,
        churchId: servant.churchId,
        severity: 'manual_review',
        reason: 'Servant missing minimal data to provision access safely.',
        suggestedAction: 'Fix name/phone first, then create linked user via canonical endpoint.',
        details: {
          servantId: servant.id,
          name: servant.name,
          phone: servant.phone,
        },
      });
    }
  }

  const userCandidatesByIdentity = new Map<string, UserRow[]>();
  for (const user of users) {
    if (user.role !== Role.SERVO || user.servantId) {
      continue;
    }
    const key = userIdentityKey(user);
    if (!userCandidatesByIdentity.has(key)) {
      userCandidatesByIdentity.set(key, []);
    }
    userCandidatesByIdentity.get(key)?.push(user);
  }

  const servantCandidatesByIdentity = new Map<string, ServantRow[]>();
  for (const servant of servants) {
    if (servant.linkedUser) {
      continue;
    }
    const key = servantIdentityKey(servant);
    if (!servantCandidatesByIdentity.has(key)) {
      servantCandidatesByIdentity.set(key, []);
    }
    servantCandidatesByIdentity.get(key)?.push(servant);
  }

  const autoRepairActions: RepairAction[] = [];
  const manualServoUsersWithoutServant: IssueEntry[] = [];
  for (const user of servoUsersWithoutServant) {
    const candidates = servantCandidatesByIdentity.get(userIdentityKey(user)) ?? [];

    if (candidates.length === 1) {
      const servant = candidates[0];
      autoRepairActions.push({
        action: 'LINK_SERVO_USER_TO_SERVANT',
        severity: 'auto_repairable',
        churchId: user.churchId,
        userId: user.id,
        servantId: servant.id,
        dryRun: args.dryRun,
        applied: false,
        reason: 'Unique identity match by churchId + normalized name + phone.',
        details: {
          userEmail: user.email,
          userName: user.name,
          servantName: servant.name,
        },
      });
      continue;
    }

    manualServoUsersWithoutServant.push({
      id: user.id,
      churchId: user.churchId,
      severity: candidates.length > 1 ? 'blocking' : 'manual_review',
      reason:
        candidates.length > 1
          ? 'Multiple servant candidates found for SERVO user without servantId.'
          : 'No safe servant candidate found for SERVO user without servantId.',
      suggestedAction:
        candidates.length > 1
          ? 'Manual identity resolution required; ambiguous candidates.'
          : 'Manual linking required or create servant record if missing.',
      details: {
        userId: user.id,
        email: user.email,
        candidateServantIds: candidates.map((candidate) => candidate.id),
      },
    });
  }

  const manualServantsWithoutUser: IssueEntry[] = [];
  for (const servant of unlinkedServants) {
    const candidates = userCandidatesByIdentity.get(servantIdentityKey(servant)) ?? [];

    if (candidates.length === 1) {
      const user = candidates[0];
      autoRepairActions.push({
        action: 'LINK_ORPHAN_SERVANT_TO_SERVO_USER',
        severity: 'auto_repairable',
        churchId: servant.churchId,
        userId: user.id,
        servantId: servant.id,
        dryRun: args.dryRun,
        applied: false,
        reason: 'Unique identity match by churchId + normalized name + phone.',
        details: {
          userEmail: user.email,
          userName: user.name,
          servantName: servant.name,
        },
      });
      continue;
    }

    if (args.provisionMissingUser) {
      const generatedEmail = buildProvisionEmail(servant, args.provisionEmailDomain);
      if (isValidAccessEmail(generatedEmail) && !users.some((u) => normalizeEmail(u.email) === generatedEmail)) {
        autoRepairActions.push({
          action: 'CREATE_PROVISIONAL_USER_FOR_SERVANT',
          severity: 'auto_repairable',
          churchId: servant.churchId,
          servantId: servant.id,
          dryRun: args.dryRun,
          applied: false,
          reason: 'Provisioning enabled and generated deterministic non-conflicting email.',
          details: {
            servantName: servant.name,
            generatedEmail,
          },
        });
        continue;
      }
    }

    manualServantsWithoutUser.push({
      id: servant.id,
      churchId: servant.churchId,
      severity: candidates.length > 1 ? 'blocking' : 'manual_review',
      reason:
        candidates.length > 1
          ? 'Multiple SERVO users could be linked to this servant.'
          : 'Servant has no linked user and no safe unique user match.',
      suggestedAction:
        candidates.length > 1
          ? 'Manual identity resolution required before linking.'
          : args.provisionMissingUser
            ? 'Manual review; provisioning blocked due conflicting generated email.'
            : 'Create access manually through canonical flow using validated identity data.',
      details: {
        servantId: servant.id,
        servantName: servant.name,
        candidateUserIds: candidates.map((candidate) => candidate.id),
      },
    });
  }

  const buckets: IssueBucket[] = [
    createBucket(
      'servants_without_user',
      'Servant sem User vinculado',
      'manual_review',
      manualServantsWithoutUser,
      args.exampleLimit,
    ),
    createBucket(
      'servo_users_without_servant',
      'User role SERVO sem servantId',
      'manual_review',
      manualServoUsersWithoutServant,
      args.exampleLimit,
    ),
    createBucket(
      'cross_tenant_links',
      'Vinculos User-Servant com churchId divergente ou quebrado',
      'blocking',
      crossTenantLinks,
      args.exampleLimit,
    ),
    createBucket(
      'duplicate_emails',
      'Duplicidade de email/login em usuarios ativos',
      'blocking',
      duplicateEmails,
      args.exampleLimit,
    ),
    createBucket(
      'duplicate_servant_links',
      'Vinculos 1:N indevidos entre User e Servant',
      'blocking',
      duplicateServantLinks,
      args.exampleLimit,
    ),
    createBucket(
      'admin_accounts_linked_to_servants',
      'Contas administrativas vinculadas a servos',
      'manual_review',
      adminLinkedToServant,
      args.exampleLimit,
    ),
    createBucket(
      'servants_missing_min_access_data',
      'Servos sem dados minimos para provisionar acesso',
      'manual_review',
      servantsMissingAccessData,
      args.exampleLimit,
    ),
  ];

  const failures: Array<{ action: RepairAction; error: string }> = [];
  let applied = 0;
  let skipped = 0;

  if (args.mode === 'repair') {
    for (const action of autoRepairActions) {
      if (args.dryRun) {
        action.applied = false;
        skipped += 1;
        continue;
      }

      try {
        if (action.action === 'LINK_SERVO_USER_TO_SERVANT' || action.action === 'LINK_ORPHAN_SERVANT_TO_SERVO_USER') {
          if (!action.userId || !action.servantId) {
            throw new Error('Action missing userId or servantId.');
          }

          await prisma.$transaction(async (tx) => {
            const [user, servant] = await Promise.all([
              tx.user.findUnique({
                where: { id: action.userId! },
                select: { id: true, churchId: true, role: true, servantId: true },
              }),
              tx.servant.findUnique({
                where: { id: action.servantId! },
                select: { id: true, churchId: true },
              }),
            ]);

            if (!user || !servant) {
              throw new Error('User or servant no longer exists.');
            }
            if (user.churchId !== servant.churchId) {
              throw new Error('Cross-tenant link blocked by repair safety rules.');
            }
            if (user.role !== Role.SERVO) {
              throw new Error('Auto-link blocked: user role is not SERVO.');
            }
            if (user.servantId && user.servantId !== servant.id) {
              throw new Error('Auto-link blocked: user already linked to another servant.');
            }

            const existingServantLink = await tx.user.findFirst({
              where: {
                servantId: servant.id,
                NOT: { id: user.id },
              },
              select: { id: true },
            });
            if (existingServantLink) {
              throw new Error('Auto-link blocked: servant already linked to another user.');
            }

            await tx.user.update({
              where: { id: user.id },
              data: {
                servantId: servant.id,
                scope: UserScope.SELF,
              },
            });

            await tx.auditLog.create({
              data: {
                action: AuditAction.UPDATE,
                churchId: user.churchId,
                entity: 'UserServantRepair',
                entityId: user.id,
                userId: null,
                metadata: {
                  repairAction: action.action,
                  userId: user.id,
                  servantId: servant.id,
                  source: 'scripts/servant-user-integrity.ts',
                },
              },
            });
          });

          action.applied = true;
          applied += 1;
          continue;
        }

        if (action.action === 'CREATE_PROVISIONAL_USER_FOR_SERVANT') {
          if (!action.servantId) {
            throw new Error('Action missing servantId.');
          }

          await prisma.$transaction(async (tx) => {
            const servant = await tx.servant.findUnique({
              where: { id: action.servantId! },
              select: {
                id: true,
                churchId: true,
                name: true,
                phone: true,
                userAccount: { select: { id: true } },
              },
            });

            if (!servant) {
              throw new Error('Servant no longer exists.');
            }
            if (servant.userAccount?.id) {
              throw new Error('Servant already linked to a user.');
            }

            const generatedEmail = buildProvisionEmail(
              { id: servant.id, name: servant.name },
              args.provisionEmailDomain,
            );

            const duplicated = await tx.user.findFirst({
              where: { email: generatedEmail },
              select: { id: true },
            });
            if (duplicated) {
              throw new Error('Generated provisioning email already exists.');
            }

            const provisionPasswordHash = await bcrypt.hash(args.defaultPassword, 10);

            await tx.user.create({
              data: {
                name: servant.name,
                email: generatedEmail,
                passwordHash: provisionPasswordHash,
                role: Role.SERVO,
                scope: UserScope.SELF,
                status: UserStatus.INACTIVE,
                churchId: servant.churchId,
                servantId: servant.id,
                phone: servant.phone,
                mustChangePassword: true,
              },
            });

            await tx.auditLog.create({
              data: {
                action: AuditAction.CREATE,
                churchId: servant.churchId,
                entity: 'ProvisionedServantUser',
                entityId: servant.id,
                userId: null,
                metadata: {
                  repairAction: action.action,
                  servantId: servant.id,
                  generatedEmail,
                  source: 'scripts/servant-user-integrity.ts',
                },
              },
            });
          });

          action.applied = true;
          applied += 1;
          continue;
        }

        throw new Error(`Unknown action type: ${action.action}`);
      } catch (error) {
        failures.push({
          action,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const issueTotals = buckets.reduce(
    (acc, bucket) => {
      acc.total += bucket.total;
      acc[bucket.severity] += bucket.total;
      return acc;
    },
    { total: 0, auto_repairable: 0, manual_review: 0, blocking: 0 },
  );

  const result: DiagnoseResult = {
    generatedAt: new Date().toISOString(),
    mode: args.mode,
    dryRun: args.dryRun,
    summary: {
      totalUsers: users.length,
      totalServants: servants.length,
      totalIssues: issueTotals.total,
      autoRepairable: autoRepairActions.length,
      manualReview: issueTotals.manual_review,
      blocking: issueTotals.blocking,
    },
    buckets,
    repair: {
      eligible: autoRepairActions.length,
      applied,
      skipped,
      errors: failures.length,
      actions: autoRepairActions,
      failures,
    },
  };

  return result;
}

function printHumanSummary(result: DiagnoseResult) {
  console.log('');
  console.log('=== Servant/User Legacy Integrity Report ===');
  console.log(`generatedAt : ${result.generatedAt}`);
  console.log(`mode        : ${result.mode}`);
  console.log(`dryRun      : ${result.dryRun}`);
  console.log(`users       : ${result.summary.totalUsers}`);
  console.log(`servants    : ${result.summary.totalServants}`);
  console.log(`issues      : ${result.summary.totalIssues}`);
  console.log(`autoFixable : ${result.summary.autoRepairable}`);
  console.log(`manual      : ${result.summary.manualReview}`);
  console.log(`blocking    : ${result.summary.blocking}`);
  console.log('');

  for (const bucket of result.buckets) {
    console.log(`- ${bucket.title}: ${bucket.total} (${bucket.severity})`);
  }

  console.log('');
  console.log('Repair stats:');
  console.log(`eligible : ${result.repair.eligible}`);
  console.log(`applied  : ${result.repair.applied}`);
  console.log(`skipped  : ${result.repair.skipped}`);
  console.log(`errors   : ${result.repair.errors}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'repair' && args.dryRun) {
    console.log('Running in REPAIR mode with dry-run=true. No data will be changed.');
  }

  const result = await diagnoseAndRepair(args);
  printHumanSummary(result);

  if (args.writeReportPath) {
    const target = path.resolve(process.cwd(), args.writeReportPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Report written to ${target}`);
  }

  const blockingBucket = result.buckets.find((bucket) => bucket.key === 'cross_tenant_links');
  if (args.mode === 'repair' && !args.dryRun && (blockingBucket?.total ?? 0) > 0) {
    console.warn('Blocking cross-tenant links still exist. Production rollout should be blocked.');
  }
}

main()
  .catch((error) => {
    console.error('Integrity script failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
