import type { Policy, Violation } from "./types.js";

export async function checkAll(
  policies: Policy[],
  repoPath: string,
  onPolicy?: (policy: Policy, violations: Violation[]) => void,
): Promise<Violation[]> {
  const allViolations: Violation[] = [];
  const queue = [...policies];
  let i = 0;
  while (i < queue.length) {
    const policy = queue[i];
    const children: Policy[] = [];
    const policyViolations: Violation[] = [];
    await policy.check({
      repoPath,
      report(message, fix) {
        // Convert string to manual Fix object
        const fixObj = typeof fix === "string" ? { description: fix } : fix;
        const v: Violation = { policy, message, fix: fixObj };
        policyViolations.push(v);
        allViolations.push(v);
      },
      queue(child) {
        children.push(child);
      },
    });
    onPolicy?.(policy, policyViolations);
    queue.splice(i + 1, 0, ...children);
    i++;
  }
  return allViolations;
}

export interface FixResult {
  /** Violations fixed in this iteration */
  fixed: Violation[];
  /** Violations that remain and have no auto-fix */
  remaining: Violation[];
  /** Error if a fix destabilized previously-passing policies */
  stabilityError?: string;
}

export async function fixAll(
  policies: Policy[],
  repoPath: string,
  onIteration?: (violations: Violation[]) => void,
): Promise<FixResult> {
  const passingPolicies = new Set<string>();

  while (true) {
    const violations = await checkAll(policies, repoPath);
    onIteration?.(violations);

    const autoFixable = violations.filter((v) => v.fix?.execute);
    const remaining = violations.filter((v) => !v.fix?.execute);

    if (autoFixable.length === 0) {
      return { fixed: [], remaining };
    }

    const target = autoFixable[0];
    await target.fix!.execute!();

    // Re-check to verify stability
    const after = await checkAll(policies, repoPath);
    const afterNames = new Set(after.map((v) => `${v.policy.name}: ${v.message}`));
    const targetKey = `${target.policy.name}: ${target.message}`;

    if (afterNames.has(targetKey)) {
      return {
        fixed: [],
        remaining: after,
        stabilityError: `Fix for "${target.policy.name}" (${target.message}) had no effect`,
      };
    }

    for (const policyName of passingPolicies) {
      const nowFailing = after.find((v) => v.policy.name === policyName);
      if (nowFailing) {
        return {
          fixed: [],
          remaining: after,
          stabilityError: `Fix for "${target.policy.name}" broke previously-passing policy "${policyName}"`,
        };
      }
    }

    // Mark fixed policy as known-passing
    passingPolicies.add(target.policy.name);

    if (after.length === 0) {
      return { fixed: [target], remaining: [] };
    }
  }
}
