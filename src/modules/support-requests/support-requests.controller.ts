import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { ListSupportRequestsQueryDto } from './dto/list-support-requests-query.dto';
import { UpdateSupportRequestStatusDto } from './dto/update-support-request-status.dto';
import { SupportRequestsService } from './support-requests.service';

@ApiTags('Support Requests')
@ApiBearerAuth()
@Controller('support-requests')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
export class SupportRequestsController {
  constructor(private readonly supportRequestsService: SupportRequestsService) {}

  @Get()
  findAll(@Query() query: ListSupportRequestsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.supportRequestsService.findAll(query, user);
  }

  @Post()
  @Roles(Role.PASTOR, Role.COORDENADOR)
  create(@Body() dto: CreateSupportRequestDto, @CurrentUser() user: JwtPayload) {
    return this.supportRequestsService.create(dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportRequestStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.supportRequestsService.updateStatus(id, dto, user);
  }
}
