import { Injectable } from '@nestjs/common';
import { Prisma, RewardSource } from '@prisma/client';
import { assertServantAccess, getServantAccessWhere } from 'src/common/auth/access-scope';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ListServantRewardsQueryDto } from './dto/list-servant-rewards-query.dto';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async grantReward(input: {
    servantId: string;
    source: RewardSource;
    points: number;
    title: string;
    description?: string;
    referenceId?: string;
    grantedByUserId?: string;
  }) {
    try {
      return await this.prisma.servantReward.create({
        data: {
          servantId: input.servantId,
          source: input.source,
          points: input.points,
          title: input.title,
          description: input.description,
          referenceId: input.referenceId,
          grantedByUserId: input.grantedByUserId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  async list(query: ListServantRewardsQueryDto, actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);

    const where: Prisma.ServantRewardWhereInput = servantScope
      ? {
          AND: [
            { servantId: query.servantId },
            {
              servant: servantScope,
            },
          ],
        }
      : { servantId: query.servantId };

    const data = await this.prisma.servantReward.findMany({
      where,
      include: {
        servant: {
          select: { id: true, name: true },
        },
        grantedBy: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: [{ rewardedAt: 'desc' }],
      take: 500,
    });

    const totals = data.reduce(
      (acc, item) => {
        acc.points += item.points;
        acc.count += 1;
        return acc;
      },
      { points: 0, count: 0 },
    );

    return {
      totals,
      data,
    };
  }

  async leaderboard(actor: JwtPayload) {
    const servantScope = await getServantAccessWhere(this.prisma, actor);
    const where: Prisma.ServantRewardWhereInput = servantScope
      ? { servant: servantScope }
      : {};

    const grouped = await this.prisma.servantReward.groupBy({
      by: ['servantId'],
      where,
      _sum: { points: true },
      _count: { id: true },
      orderBy: { _sum: { points: 'desc' } },
      take: 100,
    });

    const servantIds = grouped.map((item) => item.servantId);
    const servants = await this.prisma.servant.findMany({
      where: { id: { in: servantIds } },
      select: { id: true, name: true },
    });
    const servantMap = new Map(servants.map((item) => [item.id, item.name]));

    return grouped.map((item) => ({
      servantId: item.servantId,
      servantName: servantMap.get(item.servantId) ?? null,
      points: item._sum.points ?? 0,
      entries: item._count.id,
    }));
  }

  async assertCanAccessServant(actor: JwtPayload, servantId: string) {
    await assertServantAccess(this.prisma, actor, servantId);
  }
}
