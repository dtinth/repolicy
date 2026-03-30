#!/usr/bin/env node

import { Command } from "commander";
import { checkAll, fixAll } from "./runner.js";
import { policies } from "./policies.js";
import type { Policy, Violation } from "./types.js";

const repoPath = process.cwd();

function formatViolation(v: Violation, verbose: boolean): string {
  const isAutoFixable = v.fix?.execute !== undefined;
  const hasManualFix = v.fix?.description !== undefined && !isAutoFixable;
  let badge = "";
  if (isAutoFixable) badge = " [fixable]";
  else if (hasManualFix) badge = " [manual fix]";

  if (verbose && v.fix) {
    return `  ${v.policy.name}: ${v.message}\n    ${isAutoFixable ? "fix" : "manual fix"}: ${v.fix.description}`;
  }
  return `  ${v.policy.name}: ${v.message}${badge}`;
}

const program = new Command();

program.name("repolicy").description("Lint and fix repository policy compliance").version("0.0.0");

program
  .command("check", { isDefault: true })
  .description("Check repository for policy violations")
  .option("-v, --verbose", "Show full violation details")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const onPolicy = opts.verbose
      ? (policy: Policy, violations: Violation[]) => {
          if (violations.length === 0) {
            console.log(`  ✓ ${policy.name}`);
          } else {
            for (const v of violations) {
              const fix = v.fix ? ` → ${v.fix.description}` : "";
              console.log(`  ✗ ${policy.name}: ${v.message}${fix}`);
            }
          }
        }
      : undefined;

    const violations = await checkAll(policies, repoPath, onPolicy);

    if (opts.json) {
      console.log(
        JSON.stringify(
          violations.map((v) => ({
            policy: v.policy.name,
            message: v.message,
            fixable: !!v.fix,
            fixDescription: v.fix?.description,
          })),
          null,
          2,
        ),
      );
      process.exit(violations.length > 0 ? 1 : 0);
    }

    if (opts.verbose) {
      if (violations.length > 0) process.exit(1);
      return;
    }

    if (violations.length === 0) {
      console.log("All policies pass.");
      return;
    }

    console.log(`${violations.length} violation(s) found:\n`);
    for (const v of violations) {
      console.log(formatViolation(v, false));
    }
    process.exit(1);
  });

program
  .command("fix")
  .description("Auto-fix policy violations")
  .option("-v, --verbose", "Show details of each fix applied")
  .action(async (opts) => {
    let totalFixed = 0;

    const result = await fixAll(policies, repoPath, (violations) => {
      const autoFixable = violations.filter((v) => v.fix?.execute);
      if (autoFixable.length > 0 && opts.verbose) {
        console.log(`Applying fix: ${autoFixable[0].fix!.description}`);
      }
      totalFixed += autoFixable.length > 0 ? 1 : 0;
    });

    if (result.stabilityError) {
      console.error(`Error: ${result.stabilityError}`);
      process.exit(2);
    }

    if (totalFixed > 0) {
      console.log(`Applied ${totalFixed} fix(es).`);
    }

    if (result.remaining.length > 0) {
      console.log(`\n${result.remaining.length} violation(s) require manual intervention:\n`);
      for (const v of result.remaining) {
        console.log(`  ${v.policy.name}: ${v.message}`);
      }
      process.exit(1);
    } else {
      console.log("Repository is now in compliance.");
    }
  });

program
  .command("list")
  .description("List all registered policies")
  .action(() => {
    if (policies.length === 0) {
      console.log("No policies registered.");
      return;
    }
    for (const p of policies) {
      console.log(`  ${p.name}`);
    }
  });

program.parse();
