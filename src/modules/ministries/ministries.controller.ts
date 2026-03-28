import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateMinistryResponsibilityDto } from './dto/create-ministry-responsibility.dto';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryResponsibilityDto } from './dto/update-ministry-responsibility.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { MinistriesService } from './ministries.service';

@ApiTags('Ministries')
@ApiBearerAuth()
@Controller('ministries')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class MinistriesController {
  constructor(private readonly ministriesService: MinistriesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.ministriesService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ministriesService.findOne(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateMinistryDto, @CurrentUser() user: JwtPayload) {
    return this.ministriesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMinistryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministriesService.update(id, dto, user);
  }

  @Get(':id/servants')
  listServants(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ministriesService.listServants(id, user);
  }

  @Get(':id/responsibilities')
  listResponsibilities(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ministriesService.listResponsibilities(id, user);
  }

  @Post(':id/responsibilities')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  createResponsibility(
    @Param('id') id: string,
    @Body() dto: CreateMinistryResponsibilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministriesService.createResponsibility(id, dto, user);
  }

  @Patch('responsibilities/:responsibilityId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  updateResponsibility(
    @Param('responsibilityId') responsibilityId: string,
    @Body() dto: UpdateMinistryResponsibilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ministriesService.updateResponsibility(responsibilityId, dto, user);
  }
}

