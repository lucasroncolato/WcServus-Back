import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AttendancesService } from './attendances.service';
import { BatchAttendanceDto } from './dto/batch-attendance.dto';
import { CheckInDto } from './dto/check-in.dto';
import { ListAttendancesQueryDto } from './dto/list-attendances-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@ApiTags('Attendances')
@ApiBearerAuth()
@Controller('attendances')
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Get()
  findAll(@Query() query: ListAttendancesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.attendancesService.findAll(query, user);
  }

  @Post('check-in')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER, Role.SERVO)
  checkIn(@Body() dto: CheckInDto, @CurrentUser() user: JwtPayload) {
    return this.attendancesService.checkIn(dto, user);
  }

  @Post('batch')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER, Role.SERVO)
  batch(@Body() dto: BatchAttendanceDto, @CurrentUser() user: JwtPayload) {
    return this.attendancesService.batch(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.attendancesService.update(id, dto, user);
  }
}
