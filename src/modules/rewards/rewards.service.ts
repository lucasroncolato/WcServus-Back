import { Injectable } from '@nestjs/common';
import { Prisma, RewardSource } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

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
}
