# 📚 Documentation References

## Official Documentation

### Supabase
- **Main Documentation**: https://supabase.com/docs
- **JavaScript Client**: https://supabase.com/docs/reference/javascript/introduction
- **Database Guide**: https://supabase.com/docs/guides/database
- **Auth**: https://supabase.com/docs/guides/auth
- **Realtime**: https://supabase.com/docs/guides/realtime
- **Storage**: https://supabase.com/docs/guides/storage

### LINE Messaging API
- **Main Documentation**: https://developers.line.biz/en/docs/
- **Messaging API**: https://developers.line.biz/en/docs/messaging-api/
- **LINE Bot SDK for Node.js**: https://github.com/line/line-bot-sdk-nodejs
- **Flex Messages**: https://developers.line.biz/en/docs/messaging-api/using-flex-messages/
- **Quick Reply**: https://developers.line.biz/en/docs/messaging-api/using-quick-reply/
- **Webhook Events**: https://developers.line.biz/en/docs/messaging-api/receiving-messages/

### Anthropic Claude
- **Main Documentation**: https://docs.anthropic.com/
- **API Reference**: https://docs.anthropic.com/en/api/getting-started
- **Prompt Engineering**: https://docs.anthropic.com/en/docs/prompt-engineering
- **SDK for Node.js**: https://www.npmjs.com/package/@anthropic-ai/sdk

## Quick Start Guides

### Setting up Supabase
1. Create project at https://app.supabase.com
2. Copy `Project URL` and `Service Role Key` from Settings → API
3. Set up database schema (see `/docs/database-schema.sql`)
4. Configure Row Level Security policies

### Setting up LINE Bot
1. Create LINE Channel at https://developers.line.biz/console/
2. Get `Channel Access Token` and `Channel Secret`
3. Set webhook URL: `https://your-domain.com/webhook`
4. Enable webhooks in LINE Console

### Setting up Claude API
1. Get API key from https://console.anthropic.com/
2. Set up billing (if not using free tier)
3. Choose appropriate model:
   - `claude-3-haiku-20240307` - Fast, cheap
   - `claude-3-sonnet-20240229` - Balanced
   - `claude-3-5-sonnet-20241022` - Most capable

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_CHANNEL_SECRET=xxxxx

# Server
PORT=3000
```

## Additional Resources

### TypeScript
- **Official Docs**: https://www.typescriptlang.org/docs/

### Node.js
- **Official Docs**: https://nodejs.org/docs/

### Express
- **Official Docs**: https://expressjs.com/

### Zod (Validation)
- **Official Docs**: https://zod.dev/

## Community & Support

- **Supabase Discord**: https://discord.supabase.com/
- **LINE Developers Community**: https://www.line-community.me/
- **Anthropic Discord**: https://discord.gg/anthropic
