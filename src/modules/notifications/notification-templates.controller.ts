import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { ListNotificationTemplatesQueryDto } from './dto/list-notification-templates-query.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationTemplatesService } from './notification-templates.service';

@ApiTags('Notification Templates')
@ApiBearerAuth()
@Controller('notifications/templates')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class NotificationTemplatesController {
  constructor(private readonly templatesService: NotificationTemplatesService) {}

  @Get()
  findAll(@Query() query: ListNotificationTemplatesQueryDto) {
    return this.templatesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateNotificationTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateNotificationTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  activate(@Param('id') id: string) {
    return this.templatesService.activate(id, true);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.templatesService.activate(id, false);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}
