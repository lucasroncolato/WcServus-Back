import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PeriodQueryDto } from './dto/period-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  attendance(@Query() query: PeriodQueryDto) {
    return this.reportsService.attendanceReport(query);
  }

  @Get('absences')
  absences(@Query() query: PeriodQueryDto) {
    return this.reportsService.absencesReport(query);
  }

  @Get('pastoral-visits')
  pastoralVisits(@Query() query: PeriodQueryDto) {
    return this.reportsService.pastoralVisitsReport(query);
  }

  @Get('talents')
  talents(@Query() query: PeriodQueryDto) {
    return this.reportsService.talentsReport(query);
  }
}