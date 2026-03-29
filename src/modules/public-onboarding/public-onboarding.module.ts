import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PublicOnboardingController } from './public-onboarding.controller';
import { PublicOnboardingService } from './public-onboarding.service';

@Module({
  imports: [AuditModule],
  controllers: [PublicOnboardingController],
  providers: [PublicOnboardingService],
  exports: [PublicOnboardingService],
})
export class PublicOnboardingModule {}
