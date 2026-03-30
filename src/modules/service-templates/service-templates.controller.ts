import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateServiceTemplateDto } from './dto/create-service-template.dto';
import { GenerateTemplateOccurrencesDto } from './dto/generate-template-occurrences.dto';
import { ListServiceTemplatesQueryDto } from './dto/list-service-templates-query.dto';
import { ServiceTemplatesService } from './service-templates.service';

@ApiTags('Service Templates')
@ApiBearerAuth()
@Controller('service-templates')
export class ServiceTemplatesController {
  constructor(private readonly serviceTemplatesService: ServiceTemplatesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  create(@Body() dto: CreateServiceTemplateDto, @CurrentUser() actor: JwtPayload) {
    return this.serviceTemplatesService.create(dto, actor);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  findAll(@Query() query: ListServiceTemplatesQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.serviceTemplatesService.findAll(query, actor);
  }

  @Post(':id/generate-occurrences')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.COORDENADOR)
  generateOccurrences(
    @Param('id') templateId: string,
    @Body() dto: GenerateTemplateOccurrencesDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.serviceTemplatesService.generateOccurrencesFromTemplate(templateId, dto, actor);
  }
}
