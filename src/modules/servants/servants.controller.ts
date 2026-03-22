import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateServantDto } from './dto/create-servant.dto';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { ListServantsQueryDto } from './dto/list-servants-query.dto';
import { UpdateServantStatusDto } from './dto/update-servant-status.dto';
import { UpdateServantDto } from './dto/update-servant.dto';
import { ServantsService } from './servants.service';

@ApiTags('Servants')
@ApiBearerAuth()
@Controller('servants')
export class ServantsController {
  constructor(private readonly servantsService: ServantsService) {}

  @Get()
  findAll(@Query() query: ListServantsQueryDto) {
    return this.servantsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servantsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  create(@Body() dto: CreateServantDto, @CurrentUser() user: JwtPayload) {
    return this.servantsService.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServantDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateServantStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.updateStatus(id, dto, user.sub);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.servantsService.history(id);
  }

  @Patch(':id/training/complete')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR, Role.LIDER)
  completeTraining(
    @Param('id') id: string,
    @Body() dto: CompleteTrainingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.servantsService.completeTraining(id, dto, user.sub);
  }
}
