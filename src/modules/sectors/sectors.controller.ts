import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';
import { SectorsService } from './sectors.service';

@ApiTags('Sectors')
@ApiBearerAuth()
@Controller('sectors')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.LIDER)
export class SectorsController {
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
}
