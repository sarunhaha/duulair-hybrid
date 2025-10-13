# 🚀 Duulair Setup Guide

## Prerequisites

- Node.js 18+ installed
- Supabase account (https://app.supabase.com)
- Anthropic Claude API key (https://console.anthropic.com)
- LINE Developer account (https://developers.line.biz) [Optional for production]

---

## 1. Clone & Install Dependencies

```bash
git clone <your-repo>
cd duulair-hybrid
npm install
```

---

## 2. Setup Supabase Database

### Step 1: Create Supabase Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in project name and password
4. Wait for project to finish setting up

### Step 2: Get API Credentials
1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL`: https://xxxxx.supabase.co
   - `service_role secret`: eyJhbGc... (⚠️ Keep this secret!)

### Step 3: Run Database Migration
1. In Supabase Dashboard, go to **SQL Editor**
2. Create a new query
3. Copy contents from `/docs/database-schema.sql`
4. Paste and click **Run**
5. Wait for "Success" message

✅ Your database is now ready!

---

## 3. Setup Environment Variables

Create `.env` file in project root:

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc... # Service role key from Step 2.2

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-... # Get from https://console.anthropic.com

# LINE Messaging API (Optional - only needed for production)
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret

# LINE Login (Optional)
LINE_LOGIN_CHANNEL_ID=your_login_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_login_channel_secret

# LINE LIFF (Optional)
LIFF_ID=your_liff_id

# Server
PORT=3000
NODE_ENV=development
```

---

## 4. Get Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up / Login
3. Go to **API Keys**
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-...`)
6. Paste into `.env` file

---

## 5. Setup LINE Bot (Optional - for production)

### Create LINE Channel
1. Go to https://developers.line.biz/console/
2. Create new **Provider**
3. Create new **Messaging API Channel**

### Get Credentials
1. Go to **Basic Settings** → copy `Channel Secret`
2. Go to **Messaging API** → copy `Channel Access Token`
3. Paste both into `.env` file

### Setup Webhook
1. In Messaging API tab
2. Set Webhook URL: `https://your-domain.com/webhook`
3. Enable **Use webhook**
4. Disable **Auto-reply messages**

---

## 6. Run Development Server

```bash
npm run dev
```

You should see:
```
🚀 Starting Duulair Multi-Agent System...
✅ All agents ready!
📡 Server running on port 3000
```

---

## 7. Test the API

Test with curl:

```bash
# Test general greeting
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"message": "สวัสดีค่ะ"}'

# Test medication log
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"message": "กินยาแล้วค่ะ"}'

# Test vitals
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"message": "วัดความดันได้ 120/80"}'
```

Expected response:
```json
{
  "success": true,
  "data": { ... },
  "agentName": "orchestrator",
  "processingTime": 3000
}
```

---

## 8. Verify Database (Optional)

Check that data is being saved:

1. Go to Supabase Dashboard → **Table Editor**
2. Open `activity_logs` table
3. You should see test messages logged

---

## Common Issues

### Issue: Port 3000 already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Issue: Supabase connection failed
- Check `SUPABASE_URL` is correct
- Check `SUPABASE_SERVICE_KEY` is the **service_role** key, not anon key
- Verify database tables exist (run migration again)

### Issue: Claude API error
- Verify `ANTHROPIC_API_KEY` is correct
- Check you have credits in Anthropic account
- Test key at https://console.anthropic.com

### Issue: TypeScript compilation errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Development Commands

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run tests
npm test

# Run tests with coverage
npm run test:agents

# Lint code
npm run lint

# Format code
npm run format
```

---

## Project Structure

```
duulair-hybrid/
├── src/
│   ├── agents/
│   │   ├── core/              # Base agent classes
│   │   │   ├── BaseAgent.ts   # Abstract base class
│   │   │   └── OrchestratorAgent.ts
│   │   └── specialized/       # Specialized agents
│   │       ├── IntentAgent.ts
│   │       ├── HealthAgent.ts
│   │       ├── ReportAgent.ts
│   │       ├── AlertAgent.ts
│   │       └── DialogAgent.ts
│   ├── services/
│   │   ├── supabase.service.ts
│   │   └── line.service.ts
│   └── index.ts               # Entry point
├── docs/
│   ├── SETUP.md               # This file
│   ├── REFERENCES.md          # External docs
│   ├── CLAUDE.md              # Agent specifications
│   └── database-schema.sql    # DB migration
├── .env                       # Environment variables
├── tsconfig.json              # TypeScript config
└── package.json               # Dependencies
```

---

## Next Steps

1. ✅ Complete this setup guide
2. 📊 Add test patients in Supabase
3. 🤖 Test all agent intents
4. 📱 Connect LINE Bot webhook
5. 🚀 Deploy to production

---

## Production Deployment

### Option 1: Railway / Render
1. Connect GitHub repo
2. Set environment variables
3. Deploy automatically

### Option 2: Docker
```bash
# Build image
docker build -t duulair-hybrid .

# Run container
docker run -p 3000:3000 --env-file .env duulair-hybrid
```

### Option 3: VPS (Ubuntu)
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <repo>
cd duulair-hybrid
npm install
npm run build

# Run with PM2
npm install -g pm2
pm2 start dist/index.js --name duulair
pm2 save
pm2 startup
```

---

## Support

- Documentation: `/docs/REFERENCES.md`
- Issues: GitHub Issues
- Discord: [Your Discord link]

---

**Happy coding! 🚀**
