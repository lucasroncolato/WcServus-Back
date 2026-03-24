import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationProvider } from '@prisma/client';
import { MetaCloudWhatsappProvider } from './providers/meta-cloud-whatsapp.provider';
import { MockWhatsappProvider } from './providers/mock-whatsapp.provider';
import { WhatsappProvider } from './whatsapp-provider.interface';

@Injectable()
export class WhatsappProviderService {
  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockWhatsappProvider,
    private readonly metaCloudProvider: MetaCloudWhatsappProvider,
  ) {}

  getProvider(): WhatsappProvider {
    const rawProvider = this.configService.get<string>('WHATSAPP_PROVIDER', 'MOCK').toUpperCase();
    return this.getProviderByName(rawProvider as NotificationProvider);
  }

  getProviderByName(provider: NotificationProvider | string): WhatsappProvider {
    if (provider === NotificationProvider.META_CLOUD) {
      return this.metaCloudProvider;
    }

    return this.mockProvider;
  }
}
