import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LogService } from 'src/common/log/log.service';
import { GamificationService } from './gamification.service';

@Injectable()
export class GamificationScheduler implements OnModuleInit, OnModuleDestroy {
  private recomputeTimer: NodeJS.Timeout | null = null;
  private monthlyTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly gamificationService: GamificationService,
    private readonly logService: LogService,
  ) {}

  onModuleInit() {
    if (process.env.GAMIFICATION_SCHEDULER_ENABLED === 'false') return;

    void this.gamificationService
      .syncDefaultAchievementsCatalog(undefined, null)
      .then((result) => this.logService.log('Gamification achievements catalog synchronized', GamificationScheduler.name, result))
      .catch((error) => this.logService.error('Gamification achievements catalog sync failed', String(error), GamificationScheduler.name));

    this.recomputeTimer = setInterval(async () => {
      try {
        const result = await this.gamificationService.recomputeAllProfiles();
        this.logService.log('Gamification recompute-all executed', GamificationScheduler.name, result);
      } catch (error) {
        this.logService.error('Gamification recompute-all failed', String(error), GamificationScheduler.name);
      }
    }, 60 * 60 * 1000);

    this.monthlyTimer = setInterval(async () => {
      try {
        const result = await this.gamificationService.buildMonthlyStats(new Date());
        this.logService.log('Gamification monthly stats executed', GamificationScheduler.name, result);
      } catch (error) {
        this.logService.error('Gamification monthly stats failed', String(error), GamificationScheduler.name);
      }
    }, 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.recomputeTimer) clearInterval(this.recomputeTimer);
    if (this.monthlyTimer) clearInterval(this.monthlyTimer);
  }
}
