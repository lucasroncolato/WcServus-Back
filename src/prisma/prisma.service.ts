import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not defined. Create a .env file in the backend root based on .env.example.',
      );
    }

    await this.$connect();
  }
}
