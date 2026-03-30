import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ServantUserIntegrityQueryDto } from './dto/servant-user-integrity-query.dto';
import { ServantUserIntegrityService } from './servant-user-integrity.service';

@ApiTags('Admin Integrity')
@ApiBearerAuth()
@Controller('admin/integrity/servant-user')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@RequireCapabilities(capabilities.integrityReadChurch)
export class ServantUserIntegrityController {
  constructor(private readonly integrityService: ServantUserIntegrityService) {}

  @Get()
  async details(@CurrentUser() actor: JwtPayload, @Query() query: ServantUserIntegrityQueryDto) {
    const churchId = this.resolveChurchFilter(actor, query.churchId);
    const data = await this.integrityService.listDetails({
      churchId,
      severity: query.severity,
    });

    return {
      data,
      summary: {
        total: data.length,
      },
    };
  }

  @Get('summary')
  async summary(@CurrentUser() actor: JwtPayload, @Query() query: ServantUserIntegrityQueryDto) {
    const churchId = this.resolveChurchFilter(actor, query.churchId);
    const [summary, scan] = await Promise.all([
      this.integrityService.listSummary({
        churchId,
        severity: query.severity,
      }),
      this.integrityService.runScan({ churchId }),
    ]);

    return {
      data: {
        summary,
        scan,
      },
    };
  }

  private resolveChurchFilter(actor: JwtPayload, churchId?: string) {
    const actorChurchId = actor.churchId ?? null;
    if (actor.role !== Role.SUPER_ADMIN) {
      if (!actorChurchId) {
        throw new ForbiddenException('Missing church scope for administrative user');
      }
      if (churchId && churchId !== actorChurchId) {
        throw new ForbiddenException('Cannot query integrity data from another church');
      }
      return actorChurchId;
    }
    return churchId;
  }
}
