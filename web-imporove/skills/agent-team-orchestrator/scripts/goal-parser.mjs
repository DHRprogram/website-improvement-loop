/**
 * goal-parser.mjs — Parses natural language goals into structured task specifications.
 *
 * Usage:
 *   node goal-parser.mjs "Redesign the dashboard with dark mode support"
 *   echo "Fix login form validation errors" | node goal-parser.mjs --stdin
 */

import { readFileSync } from "fs";

/**
 * Extract intent keywords from natural language goal text.
 * Matches against a dictionary of common development action patterns.
 * @param {string} text - Natural language goal description
 * @returns {{ primaryVerb: string, target: string, modifiers: string[] }}
 */
export function extractIntent(text) {
  const lower = text.toLowerCase().trim();
  const verbMap = {
    redesign: ["redesign", "revamp", "rebuild", "overhaul"],
    fix: ["fix", "repair", "patch", "resolve", "correct"],
    add: ["add", "implement", "create", "build", "introduce", "develop"],
    remove: ["remove", "delete", "drop", "eliminate", "deprecate"],
    improve: ["improve", "enhance", "optimize", "refactor", "polish"],
    migrate: ["migrate", "upgrade", "convert", "port"],
    deploy: ["deploy", "ship", "release", "publish"],
    test: ["test", "verify", "validate", "confirm"],
  };

  let primaryVerb = "modify";
  for (const [verb, synonyms] of Object.entries(verbMap)) {
    if (synonyms.some((s) => lower.includes(s))) {
      primaryVerb = verb;
      break;
    }
  }

  // Extract the target noun phrase (what is being acted upon)
  const targetPatterns = [
    /(?:the\s+)?(\w+(?:\s+\w+)*\s+(?:page|screen|view|component|module|service|endpoint|api|route|form|dialog|modal|navbar|footer|sidebar|header|panel|tab|card|list|grid|chart|graph|dashboard|login|signup|checkout|profile|settings|admin))/gi,
    /(with\s+|to\s+|for\s+|in\s+)(\w[\w\s]*?)(?:\s+(?:and|but|that|which|when|while|before|after)\s|$)/gi,
  ];

  let target = "application";
  for (const pattern of targetPatterns) {
    const match = lower.match(pattern);
    if (match) {
      target = match[2] || match[1];
      break;
    }
  }

  // Extract modifier keywords (features, tech specs, constraints mentioned)
  const modifierKeywords = [
    "dark mode", "light mode", "responsive", "mobile-first",
    "accessibility", "a11y", "wcag", "performance", "fast",
    "secure", "encrypted", "oauth", "jwt", "rate limit",
    "cache", "redis", "database", "migration", "api",
    "testing", "unit test", "integration test", "e2e",
    "docker", "kubernetes", "ci/cd", "deployment",
    "themed", "customizable", "configurable", "dynamic",
    "static", "server-side", "client-side", "ssr", "csr",
  ];

  const modifiers = [];
  for (const kw of modifierKeywords) {
    if (lower.includes(kw)) {
      modifiers.push(kw);
    }
  }

  return { primaryVerb, target, modifiers };
}

/**
 * Convert extracted intent into a structured goal object.
 * @param {string} rawText - Original goal text
 * @returns {Object} Structured Goal matching Pydantic schema
 */
export function parseGoal(rawText) {
  const intent = extractIntent(rawText);

  const priorityMap = {
    redesign: "high",
    fix: "high",
    add: "normal",
    remove: "normal",
    improve: "normal",
    migrate: "high",
    deploy: "normal",
    test: "low",
  };

  const goal = {
    title: `${intent.primaryVerb.charAt(0).toUpperCase() + intent.primaryVerb.slice(1)}: ${intent.target}`,
    description: rawText.trim(),
    target: intent.target,
    priority: priorityMap[intent.primaryVerb] || "normal",
    identified_modifiers: intent.modifiers,
    parsed_at: new Date().toISOString(),
    raw_text: rawText.trim(),
  };

  return goal;
}

/**
 * Expand a structured goal into suggested deliverables and acceptance criteria.
 * @param {Object} goal - Parsed goal object
 * @returns {Object} Expanded goal with deliverables and criteria
 */
export function expandGoal(goal) {
  const baseCriteria = [
    `The ${goal.target} reflects the requested ${goal.primaryVerb} changes`,
    `No existing functionality on the ${goal.target} is broken by the change`,
    `Changes adhere to project code style and naming conventions`,
    `All new or modified API endpoints have documented request/response schemas`,
    `Test coverage for changed modules meets minimum 80% line coverage`,
  ];

  const deliverables = [];
  const targetLower = goal.target.toLowerCase();

  if (targetLower.includes("page") || targetLower.includes("screen") || targetLower.includes("dashboard")) {
    deliverables.push({
      type: "frontend",
      description: `Updated UI component for ${goal.target}`,
      assignee: "frontend",
    });
    deliverables.push({
      type: "qa",
      description: `Test suite covering ${goal.target} interaction flows`,
      assignee: "qa",
    });
    if (goal.identified_modifiers.includes("accessibility") || goal.identified_modifiers.includes("a11y") || goal.identified_modifiers.includes("wcag")) {
      deliverables.push({
        type: "security",
        description: `Accessibility audit for ${goal.target} against WCAG 2.2 AA`,
        assignee: "reviewer",
      });
    }
  } else if (targetLower.includes("api") || targetLower.includes("endpoint") || targetLower.includes("route")) {
    deliverables.push({
      type: "backend",
      description: `API implementation for ${goal.target}`,
      assignee: "backend",
    });
    deliverables.push({
      type: "qa",
      description: `API tests for ${goal.target} endpoint`,
      assignee: "qa",
    });
  } else if (targetLower.includes("form") || targetLower.includes("login") || targetLower.includes("signup")) {
    deliverables.push({
      type: "frontend",
      description: `Form component with validation for ${goal.target}`,
      assignee: "frontend",
    });
    deliverables.push({
      type: "backend",
      description: `Backend validation and submission handling for ${goal.target}`,
      assignee: "backend",
    });
    deliverables.push({
      type: "security",
      description: `Security review of ${goal.target} for injection and auth vulnerabilities`,
      assignee: "security",
    });
  } else {
    deliverables.push({
      type: "general",
      description: `Implementation of changes described in goal`,
      assignee: "backend",
    });
  }

  return {
    ...goal,
    accepted_criteria: baseCriteria,
    suggested_deliverables: deliverables,
    estimated_budget_usd: calculateEstimate(deliverables),
  };
}

/**
 * Estimate budget based on number and type of deliverables.
 * @param {Array} deliverables - Suggested deliverables list
 * @returns {number} Estimated cost in USD
 */
function calculateEstimate(deliverables) {
  const costPerDeliverable = {
    frontend: 5.0,
    backend: 4.0,
    qa: 3.0,
    security: 4.0,
    reviewer: 2.0,
    general: 3.0,
  };

  let total = 0;
  for (const d of deliverables) {
    total += costPerDeliverable[d.assignee] || 3.0;
  }
  return Math.round(total * 100) / 100;
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);
  let inputText;

  if (args.includes("--stdin")) {
    let chunks = "";
    process.stdin.setEncoding("utf-8");
    for await (const chunk of process.stdin) {
      chunks += chunk;
    }
    inputText = chunks.trim();
  } else {
    inputText = args.join(" ").trim();
  }

  if (!inputText) {
    console.error("Usage: goal-parser.mjs <goal text> [--stdin]");
    console.error("Example: node goal-parser.mjs \"Improve checkout conversion\"");
    process.exit(1);
  }

  const parsed = parseGoal(inputText);
  const expanded = expandGoal(parsed);

  console.log(JSON.stringify(expanded, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("goal-parser.mjs")) {
  main();
}
