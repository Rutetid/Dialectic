/**
 * Rollback Tool : Reverts failed upgrades using Git or backup files
 */

import { execa } from "execa";
import { readdir, copyFile, access } from "fs/promises";
import { join } from "path";
import type { RollbackResult } from "../types/index.js";
import { detectPackageManager } from "./auditor.js";

async function rollbackViaGit(projectPath: string): Promise<{ success: boolean; message: string }> {
  console.error("🔄 Attempting Git rollback...");
  
  try {
    await execa("git", ["status"], { cwd: projectPath });
    
    await execa("git", ["checkout", "HEAD", "package.json"], { cwd: projectPath });
    
    try {
      await execa("git", ["checkout", "HEAD", "package-lock.json"], { cwd: projectPath, reject: false });
      await execa("git", ["checkout", "HEAD", "pnpm-lock.yaml"], { cwd: projectPath, reject: false });
      await execa("git", ["checkout", "HEAD", "yarn.lock"], { cwd: projectPath, reject: false });
    } catch {
      // Ignore if lock files don't exist
    }
    
    console.error("✅ Git rollback successful");
    
    return {
      success: true,
      message: "Rolled back using Git",
    };
  } catch (error: any) {
    console.error("❌ Git rollback failed:", error.message);
    return {
      success: false,
      message: `Git rollback failed: ${error.message}`,
    };
  }
}

async function rollbackViaBackup(projectPath: string): Promise<{ success: boolean; message: string }> {
  console.error("🔄 Attempting backup file rollback...");
  
  const backupDir = join(projectPath, ".dialectic-backup");
  
  try {
    await access(backupDir);
    
    const files = await readdir(backupDir);
    const backupFiles = files.filter((f: string) => f.startsWith("package.json.") && f.endsWith(".bak"));
    
    if (backupFiles.length === 0) {
      return {
        success: false,
        message: "No backup files found",
      };
    }
    
    backupFiles.sort().reverse();
    const latestBackup = backupFiles[0];

    const backupPath = join(backupDir, latestBackup);
    const packageJsonPath = join(projectPath, "package.json");
    
    await copyFile(backupPath, packageJsonPath);
    
    console.error(`✅ Restored from backup: ${latestBackup}`);
    
    const packageManager = await detectPackageManager(projectPath);
    console.error(`📦 Reinstalling dependencies with ${packageManager}...`);
    
    await execa(packageManager, ["install"], {
      cwd: projectPath,
      timeout: 300000,
    });
    
    console.error("✅ Backup rollback successful");
    
    return {
      success: true,
      message: `Rolled back using backup file: ${latestBackup}`,
    };
  } catch (error: any) {
    console.error("❌ Backup rollback failed:", error.message);
    return {
      success: false,
      message: `Backup rollback failed: ${error.message}`,
    };
  }
}

export async function rollbackChanges(input: {
  projectPath: string;
  upgradeId: string;
  method?: "git" | "backup" | "auto";
}): Promise<RollbackResult> {
  const { projectPath, upgradeId, method = "auto" } = input;
  
  console.error(`↩️  Rolling back upgrade ${upgradeId}...`);
  
  let result: { success: boolean; message: string };
  let usedMethod: "git" | "backup" | "manual";
  
  if (method === "auto") {
    result = await rollbackViaGit(projectPath);
    usedMethod = "git";
    
    if (!result.success) {
      result = await rollbackViaBackup(projectPath);
      usedMethod = "backup";
    }
  } else if (method === "git") {
    result = await rollbackViaGit(projectPath);
    usedMethod = "git";
  } else {
    result = await rollbackViaBackup(projectPath);
    usedMethod = "backup";
  }
  
  if (result.success) {
    console.error(`✅ Rollback successful via ${usedMethod}`);
  } else {
    console.error(`❌ Rollback failed: ${result.message}`);
  }
  
  return {
    success: result.success,
    upgradeId,
    package: "unknown", // Would need to track this in state
    restoredVersion: "previous",
    method: usedMethod,
    message: result.message,
    rolledBackAt: new Date().toISOString(),
  };
}
