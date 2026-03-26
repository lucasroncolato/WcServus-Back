import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApproveTalentDto } from './dto/approve-talent.dto';
import { CreateTalentDto } from './dto/create-talent.dto';
import { RejectTalentDto } from './dto/reject-talent.dto';
import { ReviewRejectedTalentDto } from './dto/review-rejected-talent.dto';
import { UpdateTalentStageDto } from './dto/update-talent-stage.dto';
import { TalentsService } from './talents.service';

@ApiTags('Talents')
@ApiBearerAuth()
@Controller('talents')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class TalentsController {
  constructor(private readonly talentsService: TalentsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.talentsService.findAll(user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  create(@Body() dto: CreateTalentDto, @CurrentUser() user: JwtPayload) {
    return this.talentsService.create(dto, user);
  }

  @Patch(':id/stage')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  moveStage(
    @Param('id') id: string,
    @Body() dto: UpdateTalentStageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.talentsService.moveStage(id, dto, user);
  }

  @Patch(':id/approve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveTalentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.talentsService.approve(id, dto, user);
  }

  @Patch(':id/reject')
  @Roles(Role.COORDENADOR)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTalentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.talentsService.reject(id, dto, user);
  }

  @Patch(':id/review-rejection')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  reviewRejection(
    @Param('id') id: string,
    @Body() dto: ReviewRejectedTalentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.talentsService.reviewRejection(id, dto, user);
  }
}
