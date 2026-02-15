import { z } from "zod";

export const VulnerabilitySchema = z.object({
  id: z.string().describe("CVE ID or advisory ID"),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  title: z.string(),
  description: z.string(),
  package: z.string(),
  currentVersion: z.string(),
  patchedVersions: z.string(),
  vulnerableVersions: z.string(),
  url: z.string().optional(),
});

export type Vulnerability = z.infer<typeof VulnerabilitySchema>;

export const DeprecatedPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  reason: z.string().optional(),
  replacement: z.string().optional(),
});

export type DeprecatedPackage = z.infer<typeof DeprecatedPackageSchema>;

export const OutdatedPackageSchema = z.object({
  name: z.string(),
  current: z.string(),
  wanted: z.string(),
  latest: z.string(),
  type: z.enum(["dependencies", "devDependencies", "peerDependencies"]),
});

export type OutdatedPackage = z.infer<typeof OutdatedPackageSchema>;

export const AuditResultSchema = z.object({
  vulnerabilities: z.array(VulnerabilitySchema),
  deprecated: z.array(DeprecatedPackageSchema),
  outdated: z.array(OutdatedPackageSchema),
  totalPackages: z.number(),
  summary: z.string(),
  scannedAt: z.string(),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

export const UpgradeProposalSchema = z.object({
  id: z.string().describe("Unique identifier for this upgrade"),
  package: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(["major", "minor", "patch"]),
  fixes: z.array(z.string()).describe("CVE IDs or issue numbers fixed"),
  dependents: z.array(z.string()).describe("Packages that depend on this"),
  changelogUrl: z.string().optional(),
  releaseNotesUrl: z.string().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  riskCategory: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export type UpgradeProposal = z.infer<typeof UpgradeProposalSchema>;

export const UpgradePlanSchema = z.object({
  proposals: z.array(UpgradeProposalSchema),
  totalUpgrades: z.number(),
  estimatedDuration: z.string().optional(),
  createdAt: z.string(),
});

export type UpgradePlan = z.infer<typeof UpgradePlanSchema>;

export const RiskFactorSchema = z.object({
  factor: z.string(),
  score: z.number().min(0).max(100),
  reasoning: z.string(),
});

export type RiskFactor = z.infer<typeof RiskFactorSchema>;

export const AgentAssessmentSchema = z.object({
  agent: z.enum(["optimist", "pessimist"]),
  provider: z.enum(["heuristic", "llm"]),
  overallScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  factors: z.array(RiskFactorSchema),
  summary: z.string(),
  recommendation: z.enum(["approve", "review", "reject"]),
  reasoning: z.string(),
});

export type AgentAssessment = z.infer<typeof AgentAssessmentSchema>;

export const RiskAssessmentSchema = z.object({
  upgradeId: z.string(),
  package: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  upgradeType: z.enum(["major", "minor", "patch"]),
  securityFixes: z.array(z.string()),
  pessimistView: AgentAssessmentSchema.optional(),
  note: z.string(),
  assessedAt: z.string(),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const TestResultSchema = z.object({
  passed: z.number(),
  failed: z.number(),
  skipped: z.number().optional(),
  total: z.number(),
  duration: z.number().describe("Duration in milliseconds"),
  exitCode: z.number(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  failedTests: z
    .array(
      z.object({
        name: z.string(),
        error: z.string().optional(),
      })
    )
    .optional(),
});

export type TestResult = z.infer<typeof TestResultSchema>;

export const RollbackResultSchema = z.object({
  success: z.boolean(),
  upgradeId: z.string(),
  package: z.string(),
  restoredVersion: z.string(),
  method: z.enum(["git", "backup", "manual"]),
  message: z.string(),
  rolledBackAt: z.string(),
});

export type RollbackResult = z.infer<typeof RollbackResultSchema>;

export const ApprovalStatusSchema = z.enum(["pending", "approved", "rejected", "expired"]);

export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  upgradeId: z.string(),
  package: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  riskScore: z.number(),
  riskCategory: z.enum(["low", "medium", "high", "critical"]),
  status: ApprovalStatusSchema,
  requestedAt: z.string(),
  requestedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  rejectedBy: z.string().optional(),
  rejectedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export type PackageManager = "npm" | "pnpm" | "yarn";

export interface PackageManagerDetection {
  manager: PackageManager;
  lockFile: string;
  version: string;
}

export const AuditDependenciesInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project directory"),
  packageManager: z
    .enum(["npm", "pnpm", "yarn", "auto"])
    .default("auto")
    .describe("Package manager to use (auto-detect if not specified)"),
  includeDevDependencies: z.boolean().default(true),
});

export const SuggestUpgradesInputSchema = z.object({
  auditResult: z.string().describe("JSON string of AuditResult from previous audit"),
  strategy: z
    .enum(["conservative", "balanced", "aggressive"])
    .default("balanced")
    .describe("Upgrade strategy: conservative (patch only), balanced (minor+patch), aggressive (all)"),
});

export const AssessRiskInputSchema = z.object({
  upgradeProposal: z.string().describe("JSON string of UpgradeProposal to assess"),
  projectPath: z.string().describe("Project path for analyzing changelog and dependencies"),
});

export const RunTestsInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project directory"),
  testCommand: z.string().optional().describe("Override test command (defaults to npm test)"),
  timeout: z.number().default(300000).describe("Timeout in milliseconds (default: 5 minutes)"),
});

export const ApplyUpgradeInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project directory"),
  upgradeId: z.string().describe("ID of the upgrade to apply"),
  package: z.string(),
  version: z.string(),
  packageManager: z.enum(["npm", "pnpm", "yarn", "auto"]).default("auto"),
  createBackup: z.boolean().default(true),
});

export const RollbackChangesInputSchema = z.object({
  projectPath: z.string().describe("Absolute path to the project directory"),
  upgradeId: z.string().describe("ID of the upgrade to rollback"),
  method: z.enum(["git", "backup", "auto"]).default("auto"),
});
