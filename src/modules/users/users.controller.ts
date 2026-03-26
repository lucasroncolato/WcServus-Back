import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateUserDto } from './dto/create-user.dto';
import { LinkUserServantDto } from './dto/link-user-servant.dto';
import { ListEligibleUsersQueryDto } from './dto/list-eligible-users-query.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserScopeDto } from './dto/update-user-scope.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: ListUsersQueryDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.findAll(query, user);
  }

  @Get('eligible')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  findEligible(
    @Query() query: ListEligibleUsersQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.findEligible(query.servantId, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateStatus(id, dto, user.sub);
  }

  @Patch(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.resetPassword(id, dto, user.sub);
  }

  @Post(':id/reset-password')
  resetPasswordCompat(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.resetPassword(id, dto, user.sub);
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateRole(id, dto, user);
  }

  @Patch(':id/scope')
  updateScope(
    @Param('id') id: string,
    @Body() dto: UpdateUserScopeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.updateScope(id, dto, user);
  }

  @Patch(':id/servant-link')
  setServantLink(
    @Param('id') id: string,
    @Body() dto: LinkUserServantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.setServantLink(id, dto, user.sub);
  }

  @Patch(':id/link-servant')
  linkServant(
    @Param('id') id: string,
    @Body() dto: LinkUserServantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.setServantLink(id, dto, user.sub);
  }

  @Patch(':id/unlink-servant')
  unlinkServant(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.setServantLink(id, { servantId: null }, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.usersService.remove(id, user.sub);
  }
}
