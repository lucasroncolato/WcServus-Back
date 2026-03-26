import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateWorshipServiceDto } from './dto/create-worship-service.dto';
import { ListWorshipServicesQueryDto } from './dto/list-worship-services-query.dto';
import { UpdateWorshipServiceDto } from './dto/update-worship-service.dto';
import { WorshipServicesService } from './worship-services.service';

@ApiTags('Worship Services')
@ApiBearerAuth()
@Controller('worship-services')
export class WorshipServicesController {
  constructor(private readonly worshipServicesService: WorshipServicesService) {}

  @Get()
  findAll(@Query() query: ListWorshipServicesQueryDto, @CurrentUser() user: JwtPayload) {
    return this.worshipServicesService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.worshipServicesService.findOne(id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  create(@Body() dto: CreateWorshipServiceDto, @CurrentUser() user: JwtPayload) {
    return this.worshipServicesService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorshipServiceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.worshipServicesService.update(id, dto, user.sub);
  }
}
