import type { Policy, Violation } from "./types.js";

export async function checkAll(policies: Policy[], repoPath: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  const queue = [...policies];
  let i = 0;
  while (i < queue.length) {
    const policy = queue[i];
    const children: Policy[] = [];
    await policy.check({
      repoPath,
      report(message, fix) {
        violations.push({ policy, message, fix });
      },
      queue(child) {
        children.push(child);
      },
    });
    queue.splice(i + 1, 0, ...children);
    i++;
  }
  return violations;
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

    const fixable = violations.filter((v) => v.fix);
    const unfixable = violations.filter((v) => !v.fix);

    if (fixable.length === 0) {
      return { fixed: [], remaining: unfixable };
    }

    const target = fixable[0];
    await target.fix!.execute();

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
