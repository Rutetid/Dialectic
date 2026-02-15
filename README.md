# � Dialectic

**AI-Powered Dependency Manager with Dual-LLM Risk Assessment**

Built for the **2Fast2MCP** hackathon by Archestra AI.

## 🎯 The Problem

Your `package.json` has 347 dependencies. 89 have security vulnerabilities. 23 are deprecated. Updating one breaks 5 others.

## 💡 The Solution

Dialectic uses an AI agent with dual-perspective analysis to safely manage your dependencies:

- **🔍 Audit**: Scans for vulnerabilities, deprecated packages, and outdated dependencies
- **📋 Plan**: Proposes safe upgrade paths with CVE fixes
- **🤖 Dual-LLM Risk Assessment**:
  - **Optimist LLM**: Your choice (Claude/GPT-4/Gemini) argues for upgrade safety
  - **Pessimist LLM**: Zhipu AI identifies risks and breaking changes
  - Synthesizes balanced risk scores from genuinely different perspectives
- **🧪 Test**: Automatically runs tests after upgrades
- **↩️ Rollback**: Auto-reverts on test failures
- **✅ Human Approval**: You approve risky upgrades via Archestra UI

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Archestra Platform                      │
│  (Agent Orchestration + Observability + Approvals)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ MCP Protocol
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Dialectic MCP Server                       │
│                                                             │
│  Tools:                                                     │
│  • audit_dependencies    • suggest_upgrades                 │
│  • assess_risk          • run_tests                         │
│  • apply_upgrade        • rollback_changes                  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Docker (for Archestra)
- npm or pnpm

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Archestra Platform

```bash
docker pull archestra/platform:latest
docker run -p 9000:9000 -p 3000:3000 \
   -e ARCHESTRA_QUICKSTART=true \
   -v /var/run/docker.sock:/var/run/docker.sock \
   -v archestra-postgres-data:/var/lib/postgresql/data \
   -v archestra-app-data:/app/data \
   archestra/platform
```

### 3. Configure API Keys

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add:
# - ZHIPU_API_KEY (required for Pessimist)
# - ANTHROPIC_API_KEY or OPENAI_API_KEY or GOOGLE_API_KEY (for Optimist)
nano .env
```

**Get API Keys:**
- Zhipu AI: https://open.bigmodel.cn/ (free tier available)
- Choose one: Anthropic, OpenAI, or Google for Optimist

### 4. Run Dialectic MCP Server

```bash
pnpm dev
```

### 5. Configure in Archestra

1. Open http://localhost:3000
2. Add your LLM API key in **Settings → LLM API Keys** (Claude, GPT-4, etc.)
3. Go to **MCP Registry** → Add new server → Configure Dialectic
4. Go to **Agents** → Create "Dialectic Coordinator" agent
5. Enable all 6 tools:
   - `audit_dependencies`
   - `suggest_upgrades`
   - `assess_risk`
   - `apply_upgrade`
   - `run_tests`
   - `rollback_changes`
6. Set the system prompt (see ARCHESTRA_SETUP.md)

## 📖 Usage

In Archestra Chat, talk to the **Dialectic Coordinator**:

```
Scan my project at /path/to/myproject for vulnerabilities and suggest safe upgrades
```

The automated workflow:
1. Audits dependencies for vulnerabilities
2. Generates upgrade proposals  
3. **Dual-LLM Risk Assessment**:
   - Optimist LLM (your configured provider) argues for safety
   - Pessimist LLM (Zhipu AI) identifies risks
   - Tool synthesizes both into balanced risk score
4. Presents assessment and asks for approval
5. Applies approved upgrades
6. Runs tests automatically
7. Auto-rollback on test failures

## 🎬 Demo

See `demo/vulnerable-app/` for a demo project with:
- lodash 4.17.19 (CVE-2021-23337) → upgrades cleanly
- React 17 → 18 → breaks tests → auto-rollback

## 🛠️ Development

```bash
# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Test specific tools
pnpm test:tools
```

## 📚 Documentation

- [Archestra Platform](https://archestra.ai/docs)
- [MCP Specification](https://modelcontextprotocol.io)
- [Architecture Deep Dive](./docs/ARCHITECTURE.md) (coming soon)

## 🏆 Built For

**2Fast2MCP Hackathon** by Archestra AI

## 📄 License

MIT
