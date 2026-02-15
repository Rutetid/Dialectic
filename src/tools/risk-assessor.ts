/**
 * Risk Assessor: Provides pessimist analysis from Zhipu AI
 * 
 * The tool returns raw upgrade data + pessimist view.
 * Archestra's LLM then:
 * 1. Generates its own optimistic perspective
 * 2. Weighs both views
 * 3. Makes final upgrade decision
 */

import type { UpgradeProposal, RiskAssessment } from "../types/index.js";

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || "";

export async function assessRisk(input: {
  upgradeProposal: string;
  projectPath: string;
}): Promise<RiskAssessment> {
  const { upgradeProposal: proposalJson } = input;
  
  const proposal: UpgradeProposal = JSON.parse(proposalJson);
  
  console.error(`\n🔍 Assessing risk for ${proposal.package}: ${proposal.from} → ${proposal.to}`);
  console.error(`🔑 ZHIPU_API_KEY loaded: ${ZHIPU_API_KEY ? 'YES (length: ' + ZHIPU_API_KEY.length + ')' : 'NO'}`);

  const hasZhipuKey = ZHIPU_API_KEY.length > 0;
  
  let pessimistView = undefined;
  
  if (hasZhipuKey) {
    try {
      pessimistView = await callPessimistLLM(proposal);
      console.error(`✅ Pessimist analysis complete: ${pessimistView.overallScore}/100 risk score`);
    } catch (error) {
      console.error(`❌ Pessimist LLM failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`❌ Full error details:`, error);
    }
  } else {
    console.error("⚠️  No ZHIPU_API_KEY - pessimist analysis unavailable");
  }
  
  return {
    upgradeId: proposal.id,
    package: proposal.package,
    fromVersion: proposal.from,
    toVersion: proposal.to,
    upgradeType: proposal.type,
    securityFixes: proposal.fixes,
    pessimistView,
    note: pessimistView 
      ? "Pessimist view from Zhipu AI. Generate optimistic perspective and make final decision."
      : "No pessimist analysis available. Evaluate upgrade based on version type and security fixes.",
    assessedAt: new Date().toISOString(),
  };
}

async function callPessimistLLM(proposal: UpgradeProposal) {
  console.error("  ⚠️  Calling Pessimist LLM (Zhipu AI)...");
  
  const prompt = `Analyze this npm package upgrade from a RISK-FOCUSED perspective:

Package: ${proposal.package}
Current Version: ${proposal.from}
Target Version: ${proposal.to}
Upgrade Type: ${proposal.type}
Security Fixes: ${proposal.fixes.length > 0 ? proposal.fixes.join(", ") : "None"}

Identify potential DANGERS:
- Breaking API changes
- Migration complexity
- Dependency conflicts
- Ecosystem instability
- Known bugs or issues

Return ONLY valid JSON: {"overallScore": number (0-100, where 100 is riskiest), "confidence": number (0-1), "factors": [{"factor": string, "score": number, "reasoning": string}], "summary": string, "recommendation": "approve"|"review"|"reject", "reasoning": string}`;
  
  const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ZHIPU_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "glm-4.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a critical risk analyst. Focus on DANGERS and risks. Return ONLY valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  console.error(`  📡 API Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`  ❌ API Error body: ${errorText}`);
    throw new Error(`Zhipu AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.error(`  📦 API Response received, has choices: ${!!data.choices}`);
  
  const content = data.choices[0].message.content;
  
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  
  const parsed = JSON.parse(cleaned.trim());
  
  return {
    agent: "pessimist" as const,
    provider: "llm" as const,
    overallScore: parsed.overallScore || 50,
    confidence: parsed.confidence || 0.7,
    factors: parsed.factors || [],
    summary: parsed.summary || "Risk analysis completed",
    recommendation: parsed.recommendation || "review",
    reasoning: parsed.reasoning || "Standard risk assessment",
  };
}

