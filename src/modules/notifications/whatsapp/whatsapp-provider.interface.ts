import { NotificationProvider } from '@prisma/client';

export type WhatsappSendMessageInput = {
  to: string;
  message: string;
};

export type WhatsappSendMessageResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};

export interface WhatsappProvider {
  readonly provider: NotificationProvider;
  sendMessage(input: WhatsappSendMessageInput): Promise<WhatsappSendMessageResult>;
}
