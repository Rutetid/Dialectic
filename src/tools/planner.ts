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
  console.error("📋 Audit result length:", auditResultJson?.length || 0);
  
  let auditResult: AuditResult;
  try {
    auditResult = JSON.parse(auditResultJson);
  } catch (error) {
    console.error("❌ Failed to parse audit result JSON:", error);
    console.error("📋 Audit result preview:", auditResultJson?.substring(0, 500));
    throw new Error(`Invalid audit result JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  const proposals: UpgradeProposal[] = [];
  
  for (const vuln of auditResult.vulnerabilities) {
    const packageName = vuln.package;
    const currentVersion = vuln.currentVersion;
    const patchedVersion = vuln.patchedVersions;
    
    const targetVersion = extractTargetVersion(patchedVersion, currentVersion);
    
    if (targetVersion && targetVersion !== currentVersion) {
      const upgradeType = getUpgradeType(currentVersion, targetVersion);
      
     
      const violatesStrategy = 
        (strategy === "conservative" && upgradeType !== "patch") ||
        (strategy === "balanced" && upgradeType === "major");
      
      if (violatesStrategy) {
        console.error(`⚠️  Security fix for ${packageName} requires ${upgradeType} upgrade (${currentVersion} → ${targetVersion}), but strategy is ${strategy}`);
      }
      
      proposals.push({
        id: `upgrade-${packageName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        package: packageName,
        from: currentVersion,
        to: targetVersion,
        type: upgradeType,
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
  // Handle array input (sometimes npm audit returns arrays)
  if (Array.isArray(patchedVersions)) {
    patchedVersions = patchedVersions.join(' || ');
  }
  

  if (!patchedVersions || typeof patchedVersions !== 'string') {
    console.error(`⚠️  Invalid patchedVersions: ${JSON.stringify(patchedVersions)}`);
    return null;
  }
  
  // Extract ALL version numbers from the patched versions string
  const versionMatches = patchedVersions.match(/\d+\.\d+\.\d+/g);
  
  if (!versionMatches || versionMatches.length === 0) {
    // No valid versions found, try incrementing current
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
  
  // Find the HIGHEST version from the matches
  let bestVersion = versionMatches[0];
  for (const version of versionMatches) {
    try {
      if (semver.gt(version, bestVersion)) {
        bestVersion = version;
      }
    } catch {
      // Skip invalid versions
    }
  }
  
 
  try {
    if (semver.lte(bestVersion, currentVersion)) {
      console.error(`⚠️  Best patched version ${bestVersion} is not newer than current ${currentVersion}, incrementing patch`);
      return semver.inc(currentVersion, "patch");
    }
  } catch {
    // If comparison fails, just return the best version we found
  }
  
  return bestVersion;
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
