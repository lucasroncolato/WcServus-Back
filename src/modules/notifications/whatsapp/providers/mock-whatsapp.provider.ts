import { Injectable } from '@nestjs/common';
import { NotificationProvider } from '@prisma/client';
import {
  WhatsappProvider,
  WhatsappSendMessageInput,
  WhatsappSendMessageResult,
} from '../whatsapp-provider.interface';

@Injectable()
export class MockWhatsappProvider implements WhatsappProvider {
  readonly provider = NotificationProvider.MOCK;

  async sendMessage(input: WhatsappSendMessageInput): Promise<WhatsappSendMessageResult> {
    if (!input.to.trim() || !input.message.trim()) {
      return {
        success: false,
        error: 'Missing phone or message',
      };
    }

    return {
      success: true,
      providerMessageId: `mock-${Date.now()}`,
    };
  }
}
