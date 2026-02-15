#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  AuditDependenciesInputSchema,
  SuggestUpgradesInputSchema,
  AssessRiskInputSchema,
  RunTestsInputSchema,
  ApplyUpgradeInputSchema,
  RollbackChangesInputSchema,
} from "./types/index.js";
import { auditDependencies } from "./tools/auditor.js";
import { suggestUpgrades } from "./tools/planner.js";
import { assessRisk } from "./tools/risk-assessor.js";
import { runTests } from "./tools/test-runner.js";
import { applyUpgrade } from "./tools/upgrader.js";
import { rollbackChanges } from "./tools/rollback.js";


const SERVER_NAME = "dialectic";
const SERVER_VERSION = "0.1.0";

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// ============================================================================
//  Tools
// ============================================================================

server.registerTool(
  "audit_dependencies",
  {
    description:
      "Scans a project for vulnerable, deprecated, and outdated dependencies. " +
      "Returns a comprehensive security audit including CVEs, severity levels, and upgrade recommendations. " +
      "This is typically the first step in the Dialectic workflow.",
    inputSchema: AuditDependenciesInputSchema,
  },
  async (args) => {
    const result = await auditDependencies(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "suggest_upgrades",
  {
    description:
      "Analyzes audit results and generates intelligent upgrade proposals. " +
      "Considers CVE fixes, semver compatibility, dependency chains, and breaking changes. " +
      "Groups related upgrades and prioritizes by security impact. " +
      "Call this after audit_dependencies.",
    inputSchema: SuggestUpgradesInputSchema,
  },
  async (args) => {
    const result = await suggestUpgrades(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "assess_risk",
  {
    description:
      "Calls Zhipu AI to get pessimist (risk-focused) analysis of an upgrade proposal. " +
      "Returns raw upgrade data + pessimist view with risk scores and concerns. " +
      "The agent should then generate its own optimistic perspective and make the final decision. " +
      "This implements dual-LLM reasoning: Zhipu AI (pessimist) + Archestra LLM (optimist + judge).",
    inputSchema: AssessRiskInputSchema,
  },
  async (args) => {
    const result = await assessRisk(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "run_tests",
  {
    description:
      "Executes project test suite and returns detailed results. " +
      "Detects test framework automatically (Jest, Vitest, Mocha, etc.). " +
      "Captures exit codes, stdout/stderr, and individual test failures. " +
      "Default timeout: 15s (MCP requests timeout around 20s). " +
      "For longer test suites, increase timeout parameter or run tests separately. " +
      "Use this after applying upgrades to validate changes.",
    inputSchema: RunTestsInputSchema,
  },
  async (args) => {
    const result = await runTests(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "apply_upgrade",
  {
    description:
      "⚠️ DANGEROUS ACTION - Applies an approved upgrade to the project. " +
      "Modifies package.json and installs the new version. " +
      "Creates automatic backup before changes. Requires approval in Archestra. " +
      "Always run assess_risk before calling this.",
    inputSchema: ApplyUpgradeInputSchema,
  },
  async (args) => {
    const result = await applyUpgrade(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.registerTool(
  "rollback_changes",
  {
    description:
      "Reverts a failed upgrade to the previous state. " +
      "Uses Git, backup files, or package manager to restore. " +
      "Call this when tests fail after an upgrade.",
    inputSchema: RollbackChangesInputSchema,
  },
  async (args) => {
    const result = await rollbackChanges(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("� Dialectic MCP Server started");
  console.error(`📦 Version: ${SERVER_VERSION}`);
  console.error("🔧 Tools available: 6");
  console.error("🚀 Ready to manage dependencies with AI agents!");
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
