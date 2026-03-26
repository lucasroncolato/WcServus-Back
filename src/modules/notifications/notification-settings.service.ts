import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const WHATSAPP_GLOBAL_SETTING_KEY = 'WHATSAPP_GLOBAL_ENABLED';
const WHATSAPP_OPERATIONAL_SETTING_KEY = 'WHATSAPP_OPERATIONAL_ENABLED';

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWhatsappGlobalSetting() {
    return this.getBooleanSetting(WHATSAPP_GLOBAL_SETTING_KEY);
  }

  async updateWhatsappGlobalSetting(enabled: boolean) {
    return this.updateBooleanSetting(WHATSAPP_GLOBAL_SETTING_KEY, enabled);
  }

  async getWhatsappOperationalSetting() {
    return this.getBooleanSetting(WHATSAPP_OPERATIONAL_SETTING_KEY);
  }

  async updateWhatsappOperationalSetting(enabled: boolean) {
    return this.updateBooleanSetting(WHATSAPP_OPERATIONAL_SETTING_KEY, enabled);
  }

  async isWhatsappGloballyEnabled() {
    const setting = await this.prisma.notificationSystemSetting.findUnique({
      where: { key: WHATSAPP_GLOBAL_SETTING_KEY },
      select: { value: true },
    });
    return this.extractEnabledValue(setting?.value);
  }

  async isWhatsappOperationallyEnabled() {
    const setting = await this.prisma.notificationSystemSetting.findUnique({
      where: { key: WHATSAPP_OPERATIONAL_SETTING_KEY },
      select: { value: true },
    });
    return this.extractEnabledValue(setting?.value);
  }

  private async getBooleanSetting(key: string) {
    const setting = await this.prisma.notificationSystemSetting.findUnique({
      where: { key },
    });

    return {
      key,
      enabled: this.extractEnabledValue(setting?.value),
      updatedAt: setting?.updatedAt ?? null,
    };
  }

  private async updateBooleanSetting(key: string, enabled: boolean) {
    const setting = await this.prisma.notificationSystemSetting.upsert({
      where: { key },
      create: {
        key,
        value: { enabled } as Prisma.InputJsonValue,
      },
      update: {
        value: { enabled } as Prisma.InputJsonValue,
      },
    });

    return {
      key,
      enabled: this.extractEnabledValue(setting.value),
      updatedAt: setting.updatedAt,
    };
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
