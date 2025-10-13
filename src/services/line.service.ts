// src/services/line.service.ts
import { Client, ClientConfig } from '@line/bot-sdk';

export class LineService {
  private client: Client;

  constructor() {
    const config: ClientConfig = {
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
      channelSecret: process.env.LINE_CHANNEL_SECRET!
    };

    this.client = new Client(config);
  }

  async sendMessage(userId: string, message: string) {
    try {
      await this.client.pushMessage(userId, {
        type: 'text',
        text: message
      });
      return true;
    } catch (error) {
      console.error('Failed to send LINE message:', error);
      throw error;
    }
  }

  async sendFlexMessage(userId: string, altText: string, flexMessage: any) {
    try {
      await this.client.pushMessage(userId, {
        type: 'flex',
        altText,
        contents: flexMessage
      });
      return true;
    } catch (error) {
      console.error('Failed to send LINE flex message:', error);
      throw error;
    }
  }

  async replyMessage(replyToken: string, message: string) {
    try {
      await this.client.replyMessage(replyToken, {
        type: 'text',
        text: message
      });
      return true;
    } catch (error) {
      console.error('Failed to reply LINE message:', error);
      throw error;
    }
  }
}
