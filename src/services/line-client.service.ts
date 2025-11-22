/**
 * LINE Client Service
 * Shared LINE Bot SDK client instance
 */

import { Client } from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();

// LINE Bot configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// Shared LINE client instance
export const lineClient = new Client(lineConfig);
