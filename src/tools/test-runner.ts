/**
 * Test Runner Tool : Executes project test suites and captures results
 */

import { execa } from "execa";
import { readFile } from "fs/promises";
import { join } from "path";
import type { TestResult } from "../types/index.js";
import { detectPackageManager } from "./auditor.js";

async function detectTestCommand(projectPath: string): Promise<string | null> {
  try {
    const packageJsonPath = join(projectPath, "package.json");
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);
    
    // Check if test script exists
    if (packageJson.scripts && packageJson.scripts.test) {
      return packageJson.scripts.test;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to detect test command:", error);
    return null;
  }
}

export async function runTests(input: {
  projectPath: string;
  testCommand?: string;
  timeout?: number;
}): Promise<TestResult> {
  const { projectPath, testCommand: customCommand, timeout = 15000 } = input; // 15 seconds to stay under MCP timeout
  
  console.error("🧪 Running test suite...");
  console.error(`⏱️  Timeout: ${timeout / 1000}s (MCP requests timeout around 20s)`);
  
  let testCommand = customCommand;
  if (!testCommand) {
    const detectedCommand = await detectTestCommand(projectPath);
    if (!detectedCommand) {
      return {
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0,
        exitCode: -1,
        stderr: "No test command found. Add 'test' script to package.json or specify testCommand parameter.",
      };
    }
    testCommand = detectedCommand;
  }
  
  console.error(`🚀 Running: ${testCommand}`);
  
  const packageManager = await detectPackageManager(projectPath);

  let command: string;
  let args: string[];
  
  if (testCommand === "jest" || testCommand === "vitest" || testCommand === "mocha") {
    command = "npx";
    args = [testCommand];
  } else {
    command = packageManager;
    args = ["test"];
  }
  
  const startTime = Date.now();
  
  try {
    const result = await execa(command, args, {
      cwd: projectPath,
      timeout,
      reject: false,
      all: true, 
    });
    
    const duration = Date.now() - startTime;
    
    const parsedResults = parseTestOutput(result.all || "");
    
    console.error(`✅ Tests completed in ${duration}ms: ${parsedResults.passed} passed, ${parsedResults.failed} failed`);
    
    return {
      ...parsedResults,
      duration,
      exitCode: result.exitCode || 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    if (error.message?.includes('timed out') || error.timedOut) {
      console.error(`⏱️ Tests timed out after ${duration}ms`);
      return {
        passed: 0,
        failed: 0,
        total: 0,
        duration,
        exitCode: -1,
        stderr: `Test execution timed out after ${timeout / 1000}s. Tests may be too slow or hanging. Try:\n` +
                `1. Increase timeout parameter\n` +
                `2. Run tests directly: cd ${projectPath} && npm test\n` +
                `3. Check for hanging async operations or infinite loops`,
      };
    }
    
    console.error("❌ Test execution failed:", error.message);
    
    return {
      passed: 0,
      failed: 0,
      total: 0,
      duration,
      exitCode: error.exitCode || 1,
      stderr: error.message,
    };
  }
}

function parseTestOutput(
  output: string
): Pick<TestResult, "passed" | "failed" | "skipped" | "total" | "failedTests"> {
  const jestMatch = output.match(/Tests:\s+(\d+)\s+failed[,\s]+(\d+)\s+passed[,\s]+(\d+)\s+total/i);
  if (jestMatch) {
    const failed = parseInt(jestMatch[1]);
    const passed = parseInt(jestMatch[2]);
    const total = parseInt(jestMatch[3]);
    
    return {
      passed,
      failed,
      total,
      skipped: total - passed - failed,
    };
  }
  
  const mochaMatch = output.match(/(\d+)\s+passing/i);
  const mochaFailMatch = output.match(/(\d+)\s+failing/i);
  if (mochaMatch) {
    const passed = parseInt(mochaMatch[1]);
    const failed = mochaFailMatch ? parseInt(mochaFailMatch[1]) : 0;
    
    return {
      passed,
      failed,
      total: passed + failed,
    };
  }
  
  const passedMatch = output.match(/(\d+)\s+passed/i);
  const failedMatch = output.match(/(\d+)\s+failed/i);
  
  if (passedMatch || failedMatch) {
    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    
    return {
      passed,
      failed,
      total: passed + failed,
    };
  }
  
  return {
    passed: 0,
    failed: 0,
    total: 0,
  };
}
