# 🤖 Duulair Multi-Agent System

> AI-powered healthcare monitoring system for elderly care using Claude AI and multi-agent architecture

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

---

## 🌟 Features

- 🎯 **Intent Classification** - Automatically categorize user messages
- 💊 **Health Monitoring** - Track medications, vitals, water intake, and activities
- 📊 **Smart Reporting** - Generate daily and weekly health summaries
- 🚨 **Alert System** - Real-time emergency detection and caregiver notifications
- 💬 **Natural Dialog** - Conversational AI for elderly-friendly interactions
- 🔄 **Multi-Agent Orchestration** - Coordinated agent collaboration
- 📱 **LINE Integration** - Seamless LINE Messaging API support
- 🔗 **N8N Automation** - Workflow automation and external service integration

---

## 🏗️ Architecture

```
┌─────────────────┐
│   LINE Users    │
└────────┬────────┘
         │
    ┌────▼────┐
    │Webhook  │
    └────┬────┘
         │
┌────────▼────────────┐
│  Orchestrator Agent │ ◄─── Coordinates all agents
└─────────┬───────────┘
          │
    ┌─────┼─────┬─────┬─────┐
    │     │     │     │     │
┌───▼─┐ ┌─▼──┐ ┌▼───┐ ┌▼──┐ ┌▼────┐
│Intent│ │Health│ │Report│ │Alert│ │Dialog│
└──────┘ └────┘ └────┘ └───┘ └─────┘
    │
    ▼
┌───────────────┐
│   Supabase    │ ◄─── Data persistence
└───────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Anthropic Claude API key
- LINE Developer account (optional)

### Installation

```bash
# Clone repository
git clone git@github.com:sarunhaha/duulair-hybrid.git
cd duulair-hybrid

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Run development server
npm run dev
```

**See full setup guide:** [docs/SETUP.md](docs/SETUP.md)

---

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete installation instructions
- **[N8N Integration](docs/N8N_INTEGRATION.md)** - Workflow automation & external services
- **[Database Schema](docs/database-schema.sql)** - Supabase migration script
- **[API References](docs/REFERENCES.md)** - External documentation links
- **[Claude Specifications](docs/CLAUDE.md)** - Agent behavior and prompts

---

## 🧪 Testing

```bash
# Test greeting
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
  -d '{"message": "วัดความดัน 120/80"}'
```

---

## 📁 Project Structure

```
duulair-hybrid/
├── src/
│   ├── agents/
│   │   ├── core/              # Base agent classes
│   │   │   ├── BaseAgent.ts
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
│   └── index.ts
├── docs/                      # Documentation
├── specs/                     # Agent specifications
└── package.json
```

---

## 🛠️ Tech Stack

- **Runtime:** Node.js, TypeScript
- **AI:** Anthropic Claude (Haiku, Sonnet)
- **Database:** Supabase (PostgreSQL)
- **Messaging:** LINE Messaging API
- **Validation:** Zod
- **Framework:** Express.js

---

## 🔐 Environment Variables

Create `.env` file with:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Anthropic Claude
ANTHROPIC_API_KEY=your_api_key

# LINE Messaging API (optional)
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret

# Server
PORT=3000
```

**⚠️ Never commit `.env` to version control!**

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Sarun** - *Initial work* - [@sarunhaha](https://github.com/sarunhaha)

---

## 🙏 Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code)
- Powered by [Anthropic Claude AI](https://www.anthropic.com/)
- Database by [Supabase](https://supabase.com/)
- Messaging via [LINE](https://developers.line.biz/)

---

## 📞 Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/sarunhaha/duulair-hybrid/issues)
- Email: your.email@example.com

---

**Made with ❤️ for elderly healthcare**
