import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type Severity = 'blocking' | 'manual_review';

export type ServantUserIntegrityDetailRow = {
  issueType: string;
  severity: Severity;
  churchId: string | null;
  userId: string | null;
  servantId: string | null;
  message: string;
};

export type ServantUserIntegritySummaryRow = {
  issueType: string;
  severity: Severity;
  churchId: string | null;
  issueCount: number;
  affectedUsers: number;
  affectedServants: number;
};

export type ServantUserIntegrityScan = {
  status: 'healthy' | 'manual_review' | 'blocking';
  totals: {
    blocking: number;
    manualReview: number;
    total: number;
  };
  byIssueType: Array<{
    issueType: string;
    severity: Severity;
    issueCount: number;
  }>;
};

@Injectable()
export class ServantUserIntegrityService {
  constructor(private readonly prisma: PrismaService) {}

  async listDetails(params?: { churchId?: string; severity?: Severity }) {
    const clauses: string[] = [];
    const bind: Array<string> = [];

    if (params?.churchId) {
      clauses.push(`church_id = $${bind.length + 1}`);
      bind.push(params.churchId);
    }

    if (params?.severity) {
      clauses.push(`severity = $${bind.length + 1}`);
      bind.push(params.severity);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const query = `
      SELECT
        issue_type AS "issueType",
        severity AS "severity",
        church_id AS "churchId",
        user_id AS "userId",
        servant_id AS "servantId",
        message AS "message"
      FROM "servant_user_integrity_view"
      ${whereSql}
      ORDER BY
        CASE severity WHEN 'blocking' THEN 0 ELSE 1 END,
        issue_type,
        church_id NULLS LAST,
        user_id NULLS LAST,
        servant_id NULLS LAST
    `;

    return this.prisma.$queryRawUnsafe<ServantUserIntegrityDetailRow[]>(query, ...bind);
  }

  async listSummary(params?: { churchId?: string; severity?: Severity }) {
    const clauses: string[] = [];
    const bind: Array<string> = [];

    if (params?.churchId) {
      clauses.push(`church_id = $${bind.length + 1}`);
      bind.push(params.churchId);
    }

    if (params?.severity) {
      clauses.push(`severity = $${bind.length + 1}`);
      bind.push(params.severity);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const query = `
      SELECT
        issue_type AS "issueType",
        severity AS "severity",
        church_id AS "churchId",
        issue_count::int AS "issueCount",
        affected_users::int AS "affectedUsers",
        affected_servants::int AS "affectedServants"
      FROM "servant_user_integrity_summary_view"
      ${whereSql}
      ORDER BY
        CASE severity WHEN 'blocking' THEN 0 ELSE 1 END,
        issue_type,
        church_id NULLS LAST
    `;

    return this.prisma.$queryRawUnsafe<ServantUserIntegritySummaryRow[]>(query, ...bind);
  }

  async runScan(params?: { churchId?: string }): Promise<ServantUserIntegrityScan> {
    const summary = await this.listSummary(params);

    const totals = summary.reduce(
      (acc, row) => {
        acc.total += row.issueCount;
        if (row.severity === 'blocking') {
          acc.blocking += row.issueCount;
        } else {
          acc.manualReview += row.issueCount;
        }
        return acc;
      },
      { blocking: 0, manualReview: 0, total: 0 },
    );

    const status: ServantUserIntegrityScan['status'] =
      totals.blocking > 0 ? 'blocking' : totals.manualReview > 0 ? 'manual_review' : 'healthy';

    const byIssueTypeMap = new Map<string, { issueType: string; severity: Severity; issueCount: number }>();

    for (const row of summary) {
      const key = `${row.issueType}:${row.severity}`;
      const current = byIssueTypeMap.get(key) ?? {
        issueType: row.issueType,
        severity: row.severity,
        issueCount: 0,
      };
      current.issueCount += row.issueCount;
      byIssueTypeMap.set(key, current);
    }

    return {
      status,
      totals,
      byIssueType: [...byIssueTypeMap.values()].sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'blocking' ? -1 : 1;
        }
        if (a.issueCount !== b.issueCount) {
          return b.issueCount - a.issueCount;
        }
        return a.issueType.localeCompare(b.issueType);
      }),
    };
  }
}
