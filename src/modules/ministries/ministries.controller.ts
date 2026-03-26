import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateMinistryResponsibilityDto } from '../sectors/dto/create-ministry-responsibility.dto';
import { CreateSectorDto } from '../sectors/dto/create-sector.dto';
import { UpdateMinistryResponsibilityDto } from '../sectors/dto/update-ministry-responsibility.dto';
import { UpdateSectorDto } from '../sectors/dto/update-sector.dto';
import { SectorsService } from '../sectors/sectors.service';

@ApiTags('Ministries')
@ApiBearerAuth()
@Controller('ministries')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class MinistriesController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.sectorsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sectorsService.findOne(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateSectorDto, @CurrentUser() user: JwtPayload) {
    return this.sectorsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSectorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sectorsService.update(id, dto, user);
  }

  @Get(':id/servants')
  listServants(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sectorsService.listServants(id, user);
  }

  @Get(':id/responsibilities')
  listResponsibilities(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.sectorsService.listResponsibilities(id, user);
  }

  @Post(':id/responsibilities')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  createResponsibility(
    @Param('id') id: string,
    @Body() dto: CreateMinistryResponsibilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sectorsService.createResponsibility(id, dto, user);
  }

  @Patch('responsibilities/:responsibilityId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  updateResponsibility(
    @Param('responsibilityId') responsibilityId: string,
    @Body() dto: UpdateMinistryResponsibilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sectorsService.updateResponsibility(responsibilityId, dto, user);
  }
}
