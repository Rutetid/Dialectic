/**
 * Upgrade Planner Tool : Analyzes audit results and generates intelligent upgrade proposals
 */

import * as semver from "semver";
import type { AuditResult, UpgradePlan, UpgradeProposal } from "../types/index.js";

type UpgradeStrategy = "conservative" | "balanced" | "aggressive";

function shouldIncludeUpgrade(
  currentVersion: string,
  latestVersion: string,
  strategy: UpgradeStrategy
): boolean {
  const diff = semver.diff(currentVersion, latestVersion);
  
  switch (strategy) {
    case "conservative":
      return diff === "patch";
    case "balanced":
      return diff === "patch" || diff === "minor";
    case "aggressive":
      return true;
    default:
      return false;
  }
}

export async function suggestUpgrades(input: {
  auditResult: string;
  strategy?: UpgradeStrategy;
}): Promise<UpgradePlan> {
  const { auditResult: auditResultJson, strategy = "balanced" } = input;
  
  console.error("📋 Generating upgrade plan with strategy:", strategy);
  
  const auditResult: AuditResult = JSON.parse(auditResultJson);
  const proposals: UpgradeProposal[] = [];
  
  for (const vuln of auditResult.vulnerabilities) {
    const packageName = vuln.package;
    const currentVersion = vuln.currentVersion;
    const patchedVersion = vuln.patchedVersions;
    
    const targetVersion = extractTargetVersion(patchedVersion, currentVersion);
    
    if (targetVersion && targetVersion !== currentVersion) {
      proposals.push({
        id: `upgrade-${packageName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        package: packageName,
        from: currentVersion,
        to: targetVersion,
        type: getUpgradeType(currentVersion, targetVersion),
        fixes: [vuln.id],
        dependents: [], 
        changelogUrl: `https://github.com/${packageName}/blob/main/CHANGELOG.md`,
        releaseNotesUrl: `https://github.com/${packageName}/releases/tag/v${targetVersion}`,
      });
    }
  }
  
  for (const outdated of auditResult.outdated) {
    if (proposals.some((p) => p.package === outdated.name)) {
      continue;
    }
    
    if (!shouldIncludeUpgrade(outdated.current, outdated.latest, strategy)) {
      continue;
    }
    
    proposals.push({
      id: `upgrade-${outdated.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      package: outdated.name,
      from: outdated.current,
      to: strategy === "conservative" ? outdated.wanted : outdated.latest,
      type: getUpgradeType(outdated.current, outdated.latest),
      fixes: [],
      dependents: [],
      changelogUrl: `https://github.com/${outdated.name}/blob/main/CHANGELOG.md`,
      releaseNotesUrl: `https://github.com/${outdated.name}/releases`,
    });
  }
  
  proposals.sort((a, b) => {
    if (a.fixes.length > 0 && b.fixes.length === 0) return -1;
    if (a.fixes.length === 0 && b.fixes.length > 0) return 1;
    return 0;
  });
  
  console.error(`✅ Generated ${proposals.length} upgrade proposals`);
  
  return {
    proposals,
    totalUpgrades: proposals.length,
    estimatedDuration: estimateDuration(proposals.length),
    createdAt: new Date().toISOString(),
  };
}

function extractTargetVersion(patchedVersions: string, currentVersion: string): string | null {
  // Common patterns in patched versions:
  // ">=4.17.21" -> "4.17.21"
  // "4.17.21" -> "4.17.21"
  // "^4.17.21" -> "4.17.21"
  
  const versionMatch = patchedVersions.match(/(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    return versionMatch[1];
  }
  
  // If we can't parse, try to increment patch version
  try {
    const parsed = semver.parse(currentVersion);
    if (parsed) {
      return semver.inc(currentVersion, "patch");
    }
  } catch {
    // Ignore
  }
  
  return null;
}

function getUpgradeType(from: string, to: string): "major" | "minor" | "patch" {
  try {
    const diff = semver.diff(from, to);
    if (diff === "major" || diff === "premajor") return "major";
    if (diff === "minor" || diff === "preminor") return "minor";
    return "patch";
  } catch {
    return "patch";
  }
}

function estimateDuration(upgradeCount: number): string {
  const minutes = Math.ceil(upgradeCount * 2.5); // ~2.5 minutes per upgrade
  if (minutes < 60) {
    return `~${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `~${hours}h ${remainingMinutes}m`;
}
