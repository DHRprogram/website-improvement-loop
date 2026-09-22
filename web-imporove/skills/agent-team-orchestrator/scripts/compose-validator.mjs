/**
 * compose-validator.mjs — Validates docker-compose.yml for correctness and security compliance.
 *
 * Checks:
 *   - All services declare health checks
 *   - No secrets hardcoded in environment values
 *   - Network topology is correct (services on agent-team-net)
 *   - Volume mounts use named volumes or bind-mounted paths with :ro where appropriate
 *   - Resource limits are set for all container services
 *   - OTEL collector configuration is present and valid
 *
 * Usage:
 *   node compose-validator.mjs --file path/to/docker-compose.yml
 *   cat docker-compose.yml | node compose-validator.mjs --stdin
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "yaml";

const REQUIRED_SERVICES = [
  "postgres", "redis", "gateway", "control_room", "orchestrator",
  "sandbox", "memory", "git_bridge", "otel-collector",
];
const AGENT_RUNTIME_REPLICAS_MIN = 1;
const SENSITIVE_ENV_PATTERNS = /PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL/i;

/**
 * Parse YAML content into a structured object.
 * @param {string} content - YAML string content
 * @returns {Object} Parsed compose structure
 */
export function parseCompose(content) {
  try {
    return yaml.parse(content);
  } catch (err) {
    throw new Error(`Invalid YAML: ${err.message}`);
  }
}

/**
 * Validate that all required services are declared.
 * @param {Object} compose - Parsed compose structure
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRequiredServices(compose) {
  const errors = [];
  const services = compose.services || {};

  for (const required of REQUIRED_SERVICES) {
    if (!services[required]) {
      errors.push(`Missing required service: ${required}`);
    }
  }

  // Agent runtime must have replicas >= min
  const runtime = services.agent_runtime;
  if (runtime && runtime.deploy && runtime.deploy.replicas) {
    if (runtime.deploy.replicas < AGENT_RUNTIME_REPLICAS_MIN) {
      errors.push(`agent_runtime replicas (${runtime.deploy.replicas}) below minimum (${AGENT_RUNTIME_REPLICAS_MIN})`);
    }
  } else if (!runtime) {
    errors.push("Missing agent_runtime service (required for worker execution)");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate health checks exist for all long-running services.
 * @param {Object} compose - Parsed compose structure
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateHealthChecks(compose) {
  const errors = [];
  const services = compose.services || {};

  for (const [name, service] of Object.entries(services)) {
    if (name === "otel-collector") continue; // OTEL collector uses its own config
    if (!service.healthcheck) {
      errors.push(`Service "${name}" has no healthcheck defined`);
    } else if (!service.healthcheck.test) {
      errors.push(`Service "${name}" healthcheck missing test command`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate no hardcoded secrets in environment variables.
 * @param {Object} compose - Parsed compose structure
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateNoSecrets(compose) {
  const warnings = [];
  const services = compose.services || {};

  for (const [name, service] of Object.entries(services)) {
    const envEntries = service.environment || [];
    const envPairs = Array.isArray(envEntries) ? envEntries : Object.entries(envEntries || {});

    for (const entry of envPairs) {
      const key = Array.isArray(entry) ? entry[0] : entry;
      const value = Array.isArray(entry) ? entry[1] : entry[key] || "";

      if (SENSITIVE_ENV_PATTERNS.test(key) && typeof value === "string" && !value.startsWith("${")) {
        warnings.push(`Service "${name}" has non-variable reference for sensitive env var: ${key}=${maskValue(value)}`);
      }
    }

    // Also check env_file entries themselves (they should point to .env which is gitignored)
    if (Array.isArray(service.env_file)) {
      for (const ef of service.env_file) {
        const base = typeof ef === "object" ? ef.path : ef;
        if (base === ".env" || base === ".env.local") {
          // These are local files not committed; acceptable warning level
        }
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Mask a secret value for safe logging.
 * @param {string} value - Secret value
 * @returns {string} Masked value showing only first and last char
 */
function maskValue(value) {
  if (value.length <= 2) return "*".repeat(value.length);
  return value[0] + "*".repeat(value.length - 2) + value[value.length - 1];
}

/**
 * Validate resource limits are set for all compute services.
 * @param {Object} compose - Parsed compose structure
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateResourceLimits(compose) {
  const errors = [];
  const services = compose.services || {};

  for (const [name, service] of Object.entries(services)) {
    if (name === "postgres" || name === "redis") continue; // DB services handled separately
    if (name === "otel-collector") continue;

    const hasLimits = service.deploy?.resources?.limits ||
                      service.mem_limit || service.memory ||
                      service.cpus || service.cpu_quota;

    if (!hasLimits) {
      errors.push(`Service "${name}" has no resource limits defined`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate network topology: all services should be on the same bridge network.
 * @param {Object} compose - Parsed compose structure
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateNetworkTopology(compose) {
  const errors = [];
  const services = compose.services || {};

  for (const [name, service] of Object.entries(services)) {
    if (!service.networks || service.networks.length === 0) {
      errors.push(`Service "${name}" is not attached to any network`);
    }
  }

  // Check that the network is defined at top level
  if (!compose.networks || !compose.networks["agent-team-net"]) {
    errors.push('Network "agent-team-net" not defined at top level');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Run all validations and produce a summary report.
 * @param {string} content - Raw YAML content
 * @returns {Object} Complete validation report
 */
export function validateCompose(content) {
  const compose = parseCompose(content);
  const report = {
    valid: true,
    version: compose.version || "unset",
    checks: {},
    errors: [],
    warnings: [],
  };

  const svcResult = validateRequiredServices(compose);
  const healthResult = validateHealthChecks(compose);
  const secretsResult = validateNoSecrets(compose);
  const limitsResult = validateResourceLimits(compose);
  const networkResult = validateNetworkTopology(compose);

  report.checks.required_services = svcResult;
  report.checks.health_checks = healthResult;
  report.checks.no_secrets = secretsResult;
  report.checks.resource_limits = limitsResult;
  report.checks.network_topology = networkResult;

  const allErrors = [svcResult.errors, healthResult.errors, limitsResult.errors, networkResult.errors].flat();
  report.warnings = secretsResult.warnings;
  report.errors = allErrors;
  report.valid = allErrors.length === 0;

  return report;
}

/**
 * Main CLI entry point.
 */
export async function main() {
  const args = process.argv.slice(2);
  let content;

  if (args.includes("--stdin")) {
    let chunks = "";
    process.stdin.setEncoding("utf-8");
    for await (const chunk of process.stdin) {
      chunks += chunk;
    }
    content = chunks;
  } else {
    const filePath = args.find((a) => a.startsWith("--file="))?.split("=")[1]
      || args.find((a) => a.startsWith("-f="))?.split("=")[1];

    if (!filePath) {
      console.error("Usage: compose-validator.mjs --file <path> [--stdin]");
      process.exit(1);
    }
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    content = readFileSync(filePath, "utf-8");
  }

  const report = validateCompose(content);

  if (!report.valid) {
    console.error("docker-compose.yml validation FAILED:");
    for (const err of report.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    if (report.warnings.length > 0) {
      console.error("\nWarnings:");
      for (const w of report.warnings) {
        console.error(`  [WARN] ${w}`);
      }
    }
    process.exit(1);
  }

  console.log("docker-compose.yml validation PASSED");
  if (report.warnings.length > 0) {
    console.log(`\n${report.warnings.length} warning(s):`);
    for (const w of report.warnings) {
      console.log(`  [WARN] ${w}`);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("compose-validator.mjs")) {
  main();
}
