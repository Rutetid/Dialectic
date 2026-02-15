/**
 * Upgrade Application Tool
 * Applies approved upgrades to package.json and installs dependencies
 */

import { execa } from "execa";
import { readFile, writeFile, copyFile, mkdir } from "fs/promises";
import { join } from "path";
import { detectPackageManager } from "./auditor.js";

async function createBackup(projectPath: string): Promise<void> {
  const packageJsonPath = join(projectPath, "package.json");
  const backupDir = join(projectPath, ".dialectic-backup");
  const backupPath = join(backupDir, `package.json.${Date.now()}.bak`);
  
  try {
    await mkdir(backupDir, { recursive: true });
    
    await copyFile(packageJsonPath, backupPath);
    console.error(`📦 Backup created: ${backupPath}`);
  } catch (error) {
    console.error("❌ Failed to create backup:", error);
    throw new Error("Could not create backup before upgrade");
  }
}

async function updatePackageJson(
  projectPath: string,
  packageName: string,
  version: string
): Promise<void> {
  const packageJsonPath = join(projectPath, "package.json");
  
  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
      packageJson.dependencies[packageName] = version;
    } else if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
      packageJson.devDependencies[packageName] = version;
    } else {
      throw new Error(`Package ${packageName} not found in package.json`);
    }
    
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf-8");
    
    console.error(`✏️  Updated ${packageName} to ${version} in package.json`);
  } catch (error) {
    console.error("Failed to update package.json:", error);
    throw error;
  }
}

async function installDependencies(
  projectPath: string,
  packageManager: "npm" | "pnpm" | "yarn"
): Promise<void> {
  console.error(`📦 Installing dependencies with ${packageManager}...`);
  
  try {
    await execa(packageManager, ["install"], {
      cwd: projectPath,
      timeout: 15000, // 15 seconds to stay under MCP 20s limit
    });
    
    console.error("✅ Dependencies installed successfully");
  } catch (error: any) {
    if (error.killed && error.timedOut) {
      console.error("⏱️  Install timed out after 15s - MCP limit exceeded");
      throw new Error("Install timed out. Please run manually: " + packageManager + " install");
    }
    console.error("Failed to install dependencies:", error);
    throw new Error("Dependency installation failed");
  }
}

export async function applyUpgrade(input: {
  projectPath: string;
  upgradeId: string;
  package: string;
  version: string;
  packageManager?: "npm" | "pnpm" | "yarn" | "auto";
  createBackup?: boolean;
  skipInstall?: boolean;
}): Promise<{
  success: boolean;
  upgradeId: string;
  package: string;
  version: string;
  message: string;
  appliedAt: string;
}> {
  const {
    projectPath,
    upgradeId,
    package: packageName,
    version,
    packageManager: requestedPM = "auto",
    createBackup: shouldBackup = true,
    skipInstall = false,
  } = input;
  
  console.error(`⚙️  Applying upgrade: ${packageName}@${version}`);
  
  const packageManager =
    requestedPM === "auto" ? await detectPackageManager(projectPath) : requestedPM;
  
  try {
    if (shouldBackup) {
      await createBackup(projectPath);
    }
    

    await updatePackageJson(projectPath, packageName, version);
    
    if (skipInstall) {
      console.error(`✅ Upgrade applied successfully (fast mode)!`);
      
      return {
        success: true,
        upgradeId,
        package: packageName,
        version,
        message: `Successfully upgraded ${packageName} to ${version}`,
        appliedAt: new Date().toISOString(),
      };
    }

    await installDependencies(projectPath, packageManager);
    
    console.error(`✅ Upgrade applied successfully!`);
    
    return {
      success: true,
      upgradeId,
      package: packageName,
      version,
      message: `Successfully upgraded ${packageName} to ${version}`,
      appliedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`❌ Upgrade failed:`, error.message);
    
    return {
      success: false,
      upgradeId,
      package: packageName,
      version,
      message: `Failed to upgrade ${packageName}: ${error.message}`,
      appliedAt: new Date().toISOString(),
    };
  }
}
