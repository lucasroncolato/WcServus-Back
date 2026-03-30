import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { AssignScheduleSlotDto } from './dto/assign-schedule-slot.dto';
import { ContextualSwapScheduleSlotDto } from './dto/contextual-swap-schedule-slot.dto';
import { DeclineScheduleSlotDto } from './dto/decline-schedule-slot.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('Schedule Slots')
@ApiBearerAuth()
@Controller('schedule-slots')
export class ScheduleSlotsController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Patch(':id/assign')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  assign(@Param('id') id: string, @Body() dto: AssignScheduleSlotDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.assignServantToSlot(id, dto, user);
  }

  @Patch(':id/swap')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  swap(
    @Param('id') id: string,
    @Body() dto: ContextualSwapScheduleSlotDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.schedulesService.swapServant(
      id,
      {
        substituteServantId: dto.substituteServantId,
        reason: dto.reason,
        context: dto.context,
      },
      user,
    );
  }

  @Patch(':id/confirm')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.SERVO)
  confirm(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.confirmSchedule(id, user);
  }

  @Patch(':id/decline')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.SERVO)
  decline(@Param('id') id: string, @Body() dto: DeclineScheduleSlotDto, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.declineSchedule(id, user, dto.reason);
  }

  @Get(':id/eligible-servants')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  eligibleServants(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedulesService.listEligibleServantsForSlot(id, user);
  }
}
