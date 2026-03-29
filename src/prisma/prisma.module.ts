import { Global, Module } from '@nestjs/common';
import { TenantIntegrityService } from 'src/common/tenant/tenant-integrity.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, TenantIntegrityService],
  exports: [PrismaService, TenantIntegrityService],
})
export class PrismaModule {}
