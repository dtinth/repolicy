export interface Fix {
  description: string;
  execute: () => Promise<void>;
}

export interface PolicyContext {
  /** Absolute path to the repository root */
  repoPath: string;
  /** Report a violation. Optionally provide a Fix to enable auto-remediation. */
  report(this: void, message: string, fix?: Fix): void;
  /** Queue a child policy to run immediately after this policy (depth-first). */
  queue(this: void, policy: Policy): void;
}

export interface Policy {
  name: string;
  check(context: PolicyContext): Promise<void>;
}

export interface Violation {
  policy: Policy;
  message: string;
  fix?: Fix;
}
