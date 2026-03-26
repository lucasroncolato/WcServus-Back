import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateTeamDto } from './dto/create-team.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';
import { UpdateTeamLeaderDto } from './dto/update-team-leader.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.LIDER)
  findAll(@Query() query: ListTeamsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.teamsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.LIDER)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.findOne(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: JwtPayload) {
    return this.teamsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto, @CurrentUser() user: JwtPayload) {
    return this.teamsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.remove(id, user);
  }

  @Get(':id/members')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.LIDER)
  members(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.members(id, user);
  }

  @Post(':id/members/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  addMember(
    @Param('id') id: string,
    @Param('servantId') servantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.addMember(id, servantId, user);
  }

  @Delete(':id/members/:servantId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  removeMember(
    @Param('id') id: string,
    @Param('servantId') servantId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.removeMember(id, servantId, user);
  }

  @Patch(':id/leader')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  updateLeader(
    @Param('id') id: string,
    @Body() dto: UpdateTeamLeaderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.updateLeader(id, dto, user);
  }
}
