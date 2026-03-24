import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const WHATSAPP_GLOBAL_SETTING_KEY = 'WHATSAPP_GLOBAL_ENABLED';

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWhatsappGlobalSetting() {
    const setting = await this.prisma.notificationSystemSetting.findUnique({
      where: { key: WHATSAPP_GLOBAL_SETTING_KEY },
    });

    const enabled = this.extractEnabledValue(setting?.value);
    return {
      key: WHATSAPP_GLOBAL_SETTING_KEY,
      enabled,
      updatedAt: setting?.updatedAt ?? null,
    };
  }

  async updateWhatsappGlobalSetting(enabled: boolean) {
    const setting = await this.prisma.notificationSystemSetting.upsert({
      where: { key: WHATSAPP_GLOBAL_SETTING_KEY },
      create: {
        key: WHATSAPP_GLOBAL_SETTING_KEY,
        value: { enabled } as Prisma.InputJsonValue,
      },
      update: {
        value: { enabled } as Prisma.InputJsonValue,
      },
    });

    return {
      key: WHATSAPP_GLOBAL_SETTING_KEY,
      enabled: this.extractEnabledValue(setting.value),
      updatedAt: setting.updatedAt,
    };
  }

  async isWhatsappGloballyEnabled() {
    const setting = await this.prisma.notificationSystemSetting.findUnique({
      where: { key: WHATSAPP_GLOBAL_SETTING_KEY },
      select: { value: true },
    });
    return this.extractEnabledValue(setting?.value);
  }

  private extractEnabledValue(value: Prisma.JsonValue | null | undefined) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const enabled = (value as Record<string, unknown>).enabled;
      if (typeof enabled === 'boolean') {
        return enabled;
      }
    }
    return true;
  }
}
