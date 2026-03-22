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
export class SectorsController {
  constructor(private readonly sectorsService: SectorsService) {}

  @Get()
  findAll() {
    return this.sectorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sectorsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  create(@Body() dto: CreateSectorDto, @CurrentUser() user: JwtPayload) {
    return this.sectorsService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSectorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sectorsService.update(id, dto, user.sub);
  }

  @Get(':id/servants')
  listServants(@Param('id') id: string) {
    return this.sectorsService.listServants(id);
  }
}