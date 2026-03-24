import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ListWhatsappLogsQueryDto } from './dto/list-whatsapp-logs-query.dto';
import { ProcessWhatsappQueueDto } from './dto/process-whatsapp-queue.dto';
import { SendWhatsappTestDto } from './dto/send-whatsapp-test.dto';
import { WhatsappService } from './whatsapp/whatsapp.service';

@ApiTags('Notifications WhatsApp')
@ApiBearerAuth()
@Controller('notifications/whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('test-send')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.LIDER)
  sendTest(@Body() dto: SendWhatsappTestDto) {
    return this.whatsappService.sendTest(dto);
  }

  @Post('queue/process')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR)
  processQueue(@Body() dto: ProcessWhatsappQueueDto) {
    return this.whatsappService.processQueue(dto.limit ?? 20);
  }

  @Get('logs')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.PASTOR, Role.COORDENADOR, Role.LIDER)
  listLogs(@Query() query: ListWhatsappLogsQueryDto) {
    return this.whatsappService.listLogs(query);
  }
}
