import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationProvider } from '@prisma/client';
import {
  WhatsappProvider,
  WhatsappSendMessageInput,
  WhatsappSendMessageResult,
} from '../whatsapp-provider.interface';

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class MetaCloudWhatsappProvider implements WhatsappProvider {
  readonly provider = NotificationProvider.META_CLOUD;

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(input: WhatsappSendMessageInput): Promise<WhatsappSendMessageResult> {
    const token = this.configService.get<string>('WHATSAPP_META_TOKEN');
    const phoneNumberId = this.configService.get<string>('WHATSAPP_META_PHONE_NUMBER_ID');

    if (!token || !phoneNumberId) {
      return {
        success: false,
        error: 'Meta Cloud provider is not configured',
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to,
          type: 'text',
          text: {
            body: input.message,
          },
        }),
      });

      const payload = (await response.json()) as MetaSendResponse;

      if (!response.ok) {
        return {
          success: false,
          error: payload.error?.message ?? `Meta API error ${response.status}`,
        };
      }

      return {
        success: true,
        providerMessageId: payload.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown provider error',
      };
    }
  }
}
