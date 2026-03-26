import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { MeService } from './me.service';
import { MySchedulesQueryDto } from './dto/my-schedules-query.dto';
import { PutMyAvailabilityDto } from './dto/put-my-availability.dto';
import { RespondMyScheduleDto } from './dto/respond-my-schedule.dto';
import { UpdateMyServantDto } from './dto/update-my-servant.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { ListNotificationsQueryDto } from '../notifications/dto/list-notifications-query.dto';

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.meService.getProfile(user);
  }

  @Patch()
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.meService.updateProfile(user, dto);
  }

  @Patch('password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.meService.changePassword(user, dto);
  }

  @Get('servant')
  getMyServant(@CurrentUser() user: JwtPayload) {
    return this.meService.getMyServant(user);
  }

  @Patch('servant')
  updateMyServant(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMyServantDto) {
    return this.meService.updateMyServant(user, dto);
  }

  @Get('schedules')
  listMySchedules(@CurrentUser() user: JwtPayload, @Query() query: MySchedulesQueryDto) {
    return this.meService.listMySchedules(user, query);
  }

  @Get('attendance')
  listMyAttendance(@CurrentUser() user: JwtPayload, @Query() query: MySchedulesQueryDto) {
    return this.meService.listMyAttendance(user, query);
  }

  @Get('notifications')
  listMyNotifications(@CurrentUser() user: JwtPayload, @Query() query: ListNotificationsQueryDto) {
    return this.meService.listMyNotifications(user, query);
  }

  @Patch('notifications/:id/read')
  readMyNotification(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.meService.readMyNotification(user, id);
  }

  @Get('availability')
  @Roles(Role.SERVO)
  getMyAvailability(@CurrentUser() user: JwtPayload) {
    return this.meService.getMyAvailability(user);
  }

  @Put('availability')
  @Roles(Role.SERVO)
  putMyAvailability(@CurrentUser() user: JwtPayload, @Body() dto: PutMyAvailabilityDto) {
    return this.meService.putMyAvailability(user, dto);
  }

  @Patch('schedule-assignments/:id/respond')
  @Roles(Role.SERVO)
  respondMySchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RespondMyScheduleDto,
  ) {
    return this.meService.respondMySchedule(user, id, dto);
  }
}
