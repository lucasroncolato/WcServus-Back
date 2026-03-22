import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreatePastoralVisitDto } from './dto/create-pastoral-visit.dto';
import { ListPastoralVisitsQueryDto } from './dto/list-pastoral-visits-query.dto';
import { ResolvePastoralVisitDto } from './dto/resolve-pastoral-visit.dto';
import { PastoralVisitsService } from './pastoral-visits.service';

@ApiTags('Pastoral Visits')
@ApiBearerAuth()
@Controller('pastoral-visits')
export class PastoralVisitsController {
  constructor(private readonly pastoralVisitsService: PastoralVisitsService) {}

  @Get()
  findAll(@Query() query: ListPastoralVisitsQueryDto) {
    return this.pastoralVisitsService.findAll(query);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  create(@Body() dto: CreatePastoralVisitDto, @CurrentUser() user: JwtPayload) {
    return this.pastoralVisitsService.create(dto, user.sub);
  }

  @Patch(':id/resolve')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR)
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolvePastoralVisitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.pastoralVisitsService.resolve(id, dto, user.sub);
  }

  @Get('servant/:servantId/history')
  historyByServant(@Param('servantId') servantId: string) {
    return this.pastoralVisitsService.historyByServant(servantId);
  }
}