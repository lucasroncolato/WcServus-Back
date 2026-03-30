import { Module } from '@nestjs/common';
import { ServantUserIntegrityController } from './servant-user-integrity.controller';
import { ServantUserIntegrityScheduler } from './servant-user-integrity.scheduler';
import { ServantUserIntegrityService } from './servant-user-integrity.service';

@Module({
  controllers: [ServantUserIntegrityController],
  providers: [ServantUserIntegrityService, ServantUserIntegrityScheduler],
  exports: [ServantUserIntegrityService],
})
export class IntegrityModule {}
