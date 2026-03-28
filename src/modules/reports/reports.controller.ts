import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { PeriodQueryDto } from './dto/period-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  attendance(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.attendanceReport(query, user);
  }

  @Get('servants/activity')
  servantsActivity(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.servantsActivityReport(query, user);
  }

  @Get('ministry-load')
  ministryLoad(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.ministryLoadReport(query, user);
  }

  @Get('training')
  training(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.trainingPendingReport(query, user);
  }

  @Get('pastoral')
  pastoral(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.pastoralPendenciesReport(query, user);
  }

  @Get('schedules')
  schedules(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.schedulesPeriodReport(query, user);
  }

  @Get('absences')
  absences(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.absencesReport(query, user);
  }

  @Get('pastoral-visits')
  pastoralVisits(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.pastoralVisitsReport(query, user);
  }

  @Get('talents')
  talents(@Query() query: PeriodQueryDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.talentsReport(query, user);
  }
}
