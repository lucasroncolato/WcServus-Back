import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { capabilities } from 'src/common/auth/capabilities';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RequireCapabilities } from 'src/common/decorators/require-capabilities.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateServantWithUserDto } from './dto/create-servant-with-user.dto';
import { CreateServantDto } from './dto/create-servant.dto';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { CreateServantAccessDto } from './dto/create-servant-access.dto';
import { LinkServantUserDto } from './dto/link-servant-user.dto';
import { ListEligibleServantsQueryDto } from './dto/list-eligible-servants-query.dto';
import { ListServantsQueryDto } from './dto/list-servants-query.dto';
import { UpdateServantStatusDto } from './dto/update-servant-status.dto';
import { UpdateServantDto } from './dto/update-servant.dto';
import { UpdateServantApprovalDto } from './dto/update-servant-approval.dto';
import { ServantsService } from './servants.service';

@ApiTags('Servants')
@ApiBearerAuth()
@Controller('servants')
export class ServantsController {
  constructor(private readonly servantsService: ServantsService) {}

  @Get()
  findAll(@Query() query: ListServantsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.servantsService.findAll(query, user);
  }

  @Get('eligible')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findEligible(@Query() query: ListEligibleServantsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.servantsService.findEligible(query.userId, user);
  }

  @Get('new-form')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  getCreateFormMetadata(@CurrentUser() user: JwtPayload) {
    return this.servantsService.getCreateFormMetadata(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.servantsService.findOne(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  create(@Body() dto: CreateServantDto, @CurrentUser() user: JwtPayload) {
    return this.servantsService.create(dto, user);
  }

  @Post('with-user')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  @RequireCapabilities(capabilities.servantsCreateWithUser)
  createWithUser(@Body() dto: CreateServantWithUserDto, @CurrentUser() user: JwtPayload) {
    return this.servantsService.createWithUser(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateServantStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.updateStatus(id, dto, user);
  }

  @Patch(':id/link-user')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  linkUser(
    @Param('id') id: string,
    @Body() dto: LinkServantUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.linkUser(id, dto, user);
  }

  @Post(':id/create-user-access')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  createUserAccess(
    @Param('id') id: string,
    @Body() dto: CreateServantAccessDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.createUserAccess(id, dto, user);
  }

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.servantsService.history(id, user);
  }

  @Patch(':id/training/complete')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  completeTraining(
    @Param('id') id: string,
    @Body() dto: CompleteTrainingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.completeTraining(id, dto, user);
  }

  @Patch(':id/approval')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateApproval(
    @Param('id') id: string,
    @Body() dto: UpdateServantApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.updateApproval(id, dto, user);
  }
}
