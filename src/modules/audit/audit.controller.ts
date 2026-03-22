import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Number(limit) || 50, 200);
    return this.auditService.list(parsedLimit);
  }
}