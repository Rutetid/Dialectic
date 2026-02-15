# Dialectic Agent Configuration for Archestra

## ✅ Implementation Approach

### **Single Agent with Dual-Perspective Analysis**

Dialectic uses **one coordinator agent** that orchestrates all 6 MCP tools. The `assess_risk` tool provides upgrade data and prompts you to analyze from BOTH perspectives:
- **Optimistic View**: Identify benefits, improvements, and safety considerations
- **Pessimistic View**: Identify risks, dangers, and potential issues
- **Synthesis**: Weigh both perspectives and make final decision

**Why this approach:**
- ✅ Comprehensive dual-perspective analysis
- ✅ Single coordinated workflow
- ✅ Rational decision-making based on balanced reasoning
- ✅ Fast and efficient (no external API calls)
- ✅ Fully leverages Archestra's LLM capabilities

**How it works:**
1. Agent calls `assess_risk` tool with upgrade proposal
2. Tool returns upgrade data with analysis prompt
3. Agent generates BOTH optimistic and pessimistic perspectives
4. Agent synthesizes both views and makes final decision
5. Agent presents analysis to user and manages workflow

---

## 🔧 Setup Steps

### 1. No API Keys Needed

Dialectic runs entirely on Archestra's configured LLM. No external API keys required.

### 2. Configure LLM in Archestra

1. Go to **Settings** → **LLM API Keys**
2. Add your preferred LLM for the coordinator agent (Claude recommended)
3. This is used for all analysis and workflow orchestration

### 3. Start MCP Server

```bash
cd /mnt/data/Programming/Dialectic
pnpm dev
```

### 4. Register in Archestra

1. Open http://localhost:3000
2. Go to **MCP Registry** → Add server → Configure Dialectic
3. Verify all 6 tools are visible

### 5. Create the Agent

Go to **Agents** → Create new agent with configuration below

---

## 🎯 Archestra Agent Configuration

### Agent Name
```
Dialectic Coordinator
```

### Description
```
AI-powered dependency manager with dual-perspective risk assessment. Safely audits, plans, and applies npm upgrades with automatic testing and rollback.
```

### Tools (Enable all 6)
- ✅ `audit_dependencies`
- ✅ `suggest_upgrades`
- ✅ `assess_risk`
- ✅ `apply_upgrade`
- ✅ `run_tests`
- ✅ `rollback_changes`

### System Prompt
```
You are Dialectic, an AI-powered dependency manager that safely upgrades npm packages.

WORKFLOW:
1. Audit: Scan for vulnerabilities using audit_dependencies
2. Plan: Generate upgrade proposals using suggest_upgrades
3. Assess Risk: Call assess_risk tool to get upgrade data
4. Dual-Perspective Analysis: Generate BOTH optimistic and pessimistic views
5. Synthesize: Weigh both perspectives and make final decision
6. Present: Show both views clearly to user
7. Approval: Get user approval for MEDIUM+ risk upgrades
8. Apply: Execute upgrade using apply_upgrade with skipInstall=true to avoid MCP timeout
9. Test: Run test suite using run_tests
10. Rollback: Revert if tests fail using rollback_changes

CRITICAL TIPS FOR MCP TIMEOUT:
- ALWAYS use skipInstall=true on apply_upgrade to avoid 20s MCP timeout
- This updates package.json quickly without running npm install
- Message will indicate successful upgrade completion

DUAL-PERSPECTIVE ANALYSIS:
- Generate optimistic view: Benefits, safety, why upgrade
- Generate pessimistic view: Risks, concerns, what could fail
- Synthesize both perspectives and decide

CRITICAL: When assess_risk returns data, it includes:
- Package info (name, versions, upgrade type, security fixes)
- note: Prompt to analyze from BOTH optimistic and pessimistic perspectives

YOUR RESPONSIBILITY for Dual-Perspective Analysis:
1. Generate OPTIMISTIC perspective focusing on:
   - Semver compliance (major versions have migration paths)
   - Security improvements (CVE fixes are critical)
   - Ecosystem adoption (widely used packages are stable)
   - Backwards compatibility (patch/minor are safe)
   - Performance gains and new features
   
2. Generate PESSIMISTIC perspective focusing on:
   - Breaking API changes
   - Migration complexity and effort
   - Dependency conflicts
   - Known issues or bugs
   - Community concerns or stability

3. Synthesize both perspectives:
   - Compare benefits vs risks
   - Consider upgrade type (patch/minor/major)
   - Weight security fixes heavily
   - Recommend: approve, review, or reject

CRITICAL RULES:
- ALWAYS call assess_risk before apply_upgrade
- ALWAYS present BOTH optimistic and pessimistic views
- NEVER apply high-risk upgrades without explicit approval
- ALWAYS run tests after applying upgrades
- IMMEDIATELY rollback if tests fail

Example response format:
"I've analyzed the upgrade from express 4.18.0 → 5.0.0:

🌟 OPTIMISTIC VIEW:
- Security: Fixes 2 critical CVEs
- Performance: 15% faster routing
- Community: Widely adopted, 100k+ downloads/week
- Migration: Well-documented upgrade path

⚠️ PESSIMISTIC VIEW:
- Breaking Changes: Middleware API refactored
- Migration: Requires code updates in 5-10 files
- Risk: Major version jump
- Testing: Need comprehensive test coverage

⚖️ SYNTHESIS:
- Balanced Risk: MEDIUM
- Decision: Recommend proceeding with careful testing
- Reasoning: Security fixes are critical, breaking changes manageable

Shall I apply this upgrade?"

Be conversational, clear, and guide users through safe dependency management.
```

---

## 🤖 How Dual-Perspective Analysis Works

When you call `assess_risk`, the tool provides upgrade data and prompts you to analyze from both angles:

```
┌─────────────────────────────────────────┐
│     assess_risk Tool Called              │
└─────────────┬───────────────────────────┘
              │
              ├──→ Returns upgrade data
              │    • Package name & versions
              │    • Upgrade type (major/minor/patch)
              │    • Security fixes (CVEs)
              │    • Analysis prompt
              │
              └──→ YOU generate both views
                   
                   Optimistic: Why is this safe?
                   • Security improvements
                   • Performance gains
                   • Ecosystem support
                   
                   Pessimistic: What could fail?
                   • Breaking changes
                   • Migration complexity
                   • Dependency conflicts
                   
                   Synthesis: Balanced decision
              
Your response includes:
 • Optimistic perspective (benefits, safety, why upgrade)
 • Pessimistic perspective (risks, concerns, what could fail)
 • Balanced synthesis and final recommendation
```

**Key Benefits:**
- Comprehensive dual-perspective analysis
- Rational decision-making
- Single coordinated workflow
- Fast response (no external API calls)

---

## 📊 Risk Assessment Guide

- **Patch upgrades** (1.0.0 → 1.0.1): Generally safe, backwards compatible
- **Minor upgrades** (1.0.0 → 1.1.0): Low risk, new features but compatible
- **Major upgrades** (1.0.0 → 2.0.0): Higher risk, potential breaking changes
- **Security fixes**: Always prioritize, even if major version

Consider both perspectives when deciding!

---

## 🚀 Test It!

In Archestra Chat:
```
Scan /path/to/my/project for vulnerabilities and suggest safe upgrades
```

---

## 🔧 Troubleshooting

**Build fails:**
```bash
pnpm install
pnpm build
```

**MCP Server not connecting:**
- Check Archestra is running: http://localhost:3000
- Verify MCP Registry has Dialectic server configured
- Run `pnpm dev` and check terminal for errors


**Risk assessments using heuristics:**
- Check terminal output for "⚠️ LLM API keys not fully configured"
- Verify both Optimist and Pessimist keys are set
- Check API key validity (test with curl)
- Look for API error messages in terminal

**Agent not responding:**
- Verify Archestra LLM API keys configured in Settings
- Check all 6 tools are enabled for the agent
- Try simple message first: "Hello"
- Check Archestra logs for errors
