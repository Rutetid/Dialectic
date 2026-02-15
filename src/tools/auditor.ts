/**
 * Dependency Auditor Tool : Scans projects for vulnerabilities, deprecated packages, and outdated dependencies
 */

import { execa } from "execa";
import { readFile, access } from "fs/promises";
import { join } from "path";
import type {
  AuditResult,
  Vulnerability,
  DeprecatedPackage,
  OutdatedPackage,
  PackageManager,
} from "../types/index.js";

export async function detectPackageManager(projectPath: string): Promise<PackageManager> {
  const lockFiles = {
    "pnpm-lock.yaml": "pnpm" as const,
    "package-lock.json": "npm" as const,
    "yarn.lock": "yarn" as const,
  };

  for (const [lockFile, manager] of Object.entries(lockFiles)) {
    try {
      await access(join(projectPath, lockFile));
      return manager;
    } catch {
      // File doesn't exist, continue
    }
  }
  return "npm";
}

async function runNpmAudit(projectPath: string): Promise<{
  vulnerabilities: Vulnerability[];
  totalPackages: number;
}> {
  try {
    const { stdout } = await execa("npm", ["audit", "--json"], {
      cwd: projectPath,
      reject: false, 
    });

    const auditData = JSON.parse(stdout);
    const vulnerabilities: Vulnerability[] = [];

    if (auditData.vulnerabilities) {
      for (const [pkgName, vuln] of Object.entries<any>(auditData.vulnerabilities)) {
        if (vuln.via && Array.isArray(vuln.via)) {
          for (const via of vuln.via) {
            if (typeof via === "object" && via.source) {
              vulnerabilities.push({
                id: via.source.toString(),
                severity: vuln.severity || "medium",
                title: via.title || `Vulnerability in ${pkgName}`,
                description: via.url || "",
                package: pkgName,
                currentVersion: vuln.range || "unknown",
                patchedVersions: vuln.fixAvailable?.version || "unknown",
                vulnerableVersions: vuln.range || "unknown",
                url: via.url,
              });
            }
          }
        }
      }
    }

    return {
      vulnerabilities,
      totalPackages: auditData.metadata?.dependencies || 0,
    };
  } catch (error) {
    console.error("npm audit failed:", error);
    return { vulnerabilities: [], totalPackages: 0 };
  }
}

async function runPnpmAudit(projectPath: string): Promise<{
  vulnerabilities: Vulnerability[];
  totalPackages: number;
}> {
  try {
    const { stdout } = await execa("pnpm", ["audit", "--json"], {
      cwd: projectPath,
      reject: false,
    });

    const auditData = JSON.parse(stdout);
    const vulnerabilities: Vulnerability[] = [];

    if (auditData.advisories) {
      for (const [id, advisory] of Object.entries<any>(auditData.advisories)) {
        vulnerabilities.push({
          id: id.toString(),
          severity: advisory.severity || "medium",
          title: advisory.title || "Vulnerability",
          description: advisory.overview || "",
          package: advisory.module_name || "unknown",
          currentVersion: advisory.vulnerable_versions || "unknown",
          patchedVersions: advisory.patched_versions || "unknown",
          vulnerableVersions: advisory.vulnerable_versions || "unknown",
          url: advisory.url,
        });
      }
    }

    return {
      vulnerabilities,
      totalPackages: auditData.metadata?.totalDependencies || 0,
    };
  } catch (error) {
    console.error("pnpm audit failed:", error);
    return { vulnerabilities: [], totalPackages: 0 };
  }
}

async function findDeprecatedPackages(projectPath: string): Promise<DeprecatedPackage[]> {
  const deprecated: DeprecatedPackage[] = [];

  try {
    const packageJsonPath = join(projectPath, "package.json");
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [name, version] of Object.entries<string>(allDeps)) {
      try {
        const { stdout } = await execa("npm", ["view", name, "--json"], {
          cwd: projectPath,
          timeout: 5000,
        });

        const pkgInfo = JSON.parse(stdout);
        
        if (pkgInfo.deprecated) {
          deprecated.push({
            name,
            version: version.replace(/^[\^~]/, ""),
            reason: pkgInfo.deprecated,
            replacement: extractReplacement(pkgInfo.deprecated),
          });
        }
      } catch {
        // Ignore errors for individual packages
      }
    }
  } catch (error) {
    console.error("Failed to check for deprecated packages:", error);
  }

  return deprecated;
}

function extractReplacement(deprecationMessage: string): string | undefined {
  const patterns = [
    /use (.+?) instead/i,
    /replaced by (.+?)[\.,]/i,
    /migrate to (.+?)[\.,]/i,
    /superseded by (.+?)[\.,]/i,
  ];

  for (const pattern of patterns) {
    const match = deprecationMessage.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

async function findOutdatedPackages(
  projectPath: string,
  packageManager: PackageManager
): Promise<OutdatedPackage[]> {
  const outdated: OutdatedPackage[] = [];

  try {
    const command = packageManager === "pnpm" ? "pnpm" : "npm";
    const { stdout } = await execa(command, ["outdated", "--json"], {
      cwd: projectPath,
      reject: false,
    });

    if (!stdout) return outdated;

    const outdatedData = JSON.parse(stdout);

    for (const [name, info] of Object.entries<any>(outdatedData)) {
      outdated.push({
        name,
        current: info.current || "unknown",
        wanted: info.wanted || info.current || "unknown",
        latest: info.latest || "unknown",
        type: info.type || "dependencies",
      });
    }
  } catch (error) {
    console.error("Failed to check outdated packages:", error);
  }

  return outdated;
}

export async function auditDependencies(input: {
  projectPath: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "auto";
  includeDevDependencies?: boolean;
}): Promise<AuditResult> {
  const { projectPath, packageManager: requestedPM = "auto" } = input;

  const packageManager = requestedPM === "auto" ? await detectPackageManager(projectPath) : requestedPM;

  console.error(`🔍 Auditing dependencies in ${projectPath} using ${packageManager}...`);

  const [auditResult, deprecated, outdated] = await Promise.all([
    packageManager === "pnpm" ? runPnpmAudit(projectPath) : runNpmAudit(projectPath),
    findDeprecatedPackages(projectPath),
    findOutdatedPackages(projectPath, packageManager),
  ]);

  const { vulnerabilities, totalPackages } = auditResult;

  const summary = generateSummary(vulnerabilities, deprecated, outdated, totalPackages);

  return {
    vulnerabilities,
    deprecated,
    outdated,
    totalPackages,
    summary,
    scannedAt: new Date().toISOString(),
  };
}

function generateSummary(
  vulnerabilities: Vulnerability[],
  deprecated: DeprecatedPackage[],
  outdated: OutdatedPackage[],
  totalPackages: number
): string {
  const vulnCount = vulnerabilities.length;
  const deprecatedCount = deprecated.length;
  const outdatedCount = outdated.length;

  const severityCounts = {
    critical: vulnerabilities.filter((v) => v.severity === "critical").length,
    high: vulnerabilities.filter((v) => v.severity === "high").length,
    medium: vulnerabilities.filter((v) => v.severity === "medium").length,
    low: vulnerabilities.filter((v) => v.severity === "low").length,
  };

  let summary = `Scanned ${totalPackages} packages.\n\n`;

  if (vulnCount === 0 && deprecatedCount === 0 && outdatedCount === 0) {
    summary += "✅ No issues found! All dependencies are secure and up-to-date.";
    return summary;
  }

  if (vulnCount > 0) {
    summary += `⚠️  Found ${vulnCount} vulnerabilities:\n`;
    if (severityCounts.critical > 0) summary += `   - ${severityCounts.critical} critical\n`;
    if (severityCounts.high > 0) summary += `   - ${severityCounts.high} high\n`;
    if (severityCounts.medium > 0) summary += `   - ${severityCounts.medium} medium\n`;
    if (severityCounts.low > 0) summary += `   - ${severityCounts.low} low\n`;
    summary += "\n";
  }

  if (deprecatedCount > 0) {
    summary += `🗑️  ${deprecatedCount} deprecated packages found.\n\n`;
  }

  if (outdatedCount > 0) {
    summary += `📦 ${outdatedCount} packages are outdated.\n\n`;
  }

  summary += "💡 Run suggest_upgrades to get an intelligent upgrade plan.";

  return summary;
}
