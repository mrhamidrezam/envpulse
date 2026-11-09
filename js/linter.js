/**
 * EnvPulse - Security Linter & Hygiene Inspector
 * Scans .env configurations for exposed secrets, security vulnerabilities,
 * syntax errors, and naming convention violations.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Parser = require('./parser');
    module.exports = factory(Parser);
  } else {
    root.EnvPulse = root.EnvPulse || {};
    root.EnvPulse.Linter = factory(root.EnvPulse.Parser);
  }
})(typeof self !== 'undefined' ? self : this, function (Parser) {
  'use strict';

  // Secret Detection Patterns
  const SECRET_PATTERNS = [
    {
      id: 'SEC_AWS_KEY',
      name: 'AWS Access Key ID',
      severity: 'critical',
      regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/,
      description: 'Found AWS Access Key ID. Real credentials should never be committed to repository files.'
    },
    {
      id: 'SEC_OPENAI_KEY',
      name: 'OpenAI API Key',
      severity: 'critical',
      regex: /\bsk-(proj-)?[a-zA-Z0-9_\-]{20,}\b/,
      description: 'Exposed OpenAI API Key detected. Committing this will trigger immediate key revocation or quota draining.'
    },
    {
      id: 'SEC_ANTHROPIC_KEY',
      name: 'Anthropic Claude API Key',
      severity: 'critical',
      regex: /\bsk-ant-[a-zA-Z0-9_\-]{20,}\b/,
      description: 'Exposed Anthropic API Key detected.'
    },
    {
      id: 'SEC_GEMINI_KEY',
      name: 'Google Gemini / Cloud API Key',
      severity: 'critical',
      regex: /\bAIzaSy[a-zA-Z0-9_\-]{33}\b/,
      description: 'Found Google Cloud / Gemini AI API Key.'
    },
    {
      id: 'SEC_GITHUB_TOKEN',
      name: 'GitHub Personal Access Token',
      severity: 'critical',
      regex: /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b|\bgithub_pat_[a-zA-Z0-9_]{40,}\b/,
      description: 'GitHub token detected. Can grant full repository or account read/write access.'
    },
    {
      id: 'SEC_STRIPE_SECRET',
      name: 'Stripe Secret Key',
      severity: 'critical',
      regex: /\b[rs]k_live_[0-9a-zA-Z]{24,}\b/,
      description: 'Production Stripe secret key found! Financial infrastructure risk.'
    },
    {
      id: 'SEC_PRIVATE_KEY',
      name: 'Private Cryptographic Key',
      severity: 'critical',
      regex: /-----BEGIN\s+([A-Z0-9\-_ ]+)?PRIVATE KEY-----/,
      description: 'Raw private RSA/ECDSA/SSH key embedded in configuration.'
    },
    {
      id: 'SEC_SLACK_WEBHOOK',
      name: 'Slack Incoming Webhook / Token',
      severity: 'critical',
      regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Za-z_]+\/B[0-9A-Za-z_]+\/[0-9A-Za-z_]+|\bxox[baprs]-[0-9a-zA-Z]{10,}/,
      description: 'Slack incoming webhook or bot token detected.'
    },
    {
      id: 'SEC_DB_URI_PASSWORD',
      name: 'Database URI with Plaintext Password',
      severity: 'critical',
      regex: /^[a-zA-Z0-9+.-]+:\/\/[^:]+:([^@]+)@.+/,
      description: 'Database connection string contains explicit credentials in plaintext.'
    },
    {
      id: 'SEC_JWT_TOKEN',
      name: 'JSON Web Token (JWT)',
      severity: 'warning',
      regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
      description: 'Embedded JWT token found. Tokens may contain sensitive user identity data or expire quickly.'
    }
  ];

  // Weak password values for keys named PASSWORD, SECRET, KEY, TOKEN
  const WEAK_VALUES = new Set([
    'password', '123456', '12345678', 'admin', 'root', 'secret',
    'default', 'changeme', 'letmein', 'test', 'qwerty', 'development', 'dev'
  ]);

  function lintEnv(text) {
    const parseResult = Parser.parseEnv(text);
    const issues = [];
    const seenKeys = new Map();

    // Check syntax errors reported by parser
    for (const err of parseResult.errors) {
      issues.push({
        id: 'SYN_ERROR',
        rule: 'Syntax Error',
        severity: 'critical',
        line: err.line,
        key: '',
        message: err.message,
        suggestion: 'Ensure line adheres to standard KEY=VALUE format.'
      });
    }

    for (const entry of parseResult.entries) {
      if (entry.type === 'empty' || entry.type === 'comment' || entry.type === 'invalid') {
        continue;
      }

      const key = entry.key;
      const val = entry.value;
      const line = entry.line;

      // 1. Duplicate key check
      if (seenKeys.has(key)) {
        issues.push({
          id: 'DUPLICATE_KEY',
          rule: 'Duplicate Variable',
          severity: 'warning',
          line,
          key,
          message: `Variable "${key}" is already defined on line ${seenKeys.get(key)}. Later values overwrite earlier ones.`,
          suggestion: 'Consolidate duplicate keys to prevent unpredictable runtime behavior.'
        });
      } else {
        seenKeys.set(key, line);
      }

      // 2. Key naming conventions (POSIX uppercase style)
      if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          issues.push({
            id: 'NAMING_LOWERCASE',
            rule: 'Naming Convention',
            severity: 'info',
            line,
            key,
            message: `Key "${key}" contains lowercase characters. Standard convention favors UPPER_SNAKE_CASE.`,
            suggestion: `Rename to "${key.toUpperCase()}" for cross-platform POSIX compatibility.`
          });
        } else {
          issues.push({
            id: 'NAMING_INVALID',
            rule: 'Invalid Key Format',
            severity: 'warning',
            line,
            key,
            message: `Key "${key}" contains special characters or starts with a digit.`,
            suggestion: 'Use only alphanumeric characters and underscores [A-Z0-9_].'
          });
        }
      }

      // 3. Unquoted values containing spaces
      if (!entry.quoted && val.includes(' ') && !entry.inlineComment) {
        issues.push({
          id: 'UNQUOTED_SPACES',
          rule: 'Unquoted Spaces',
          severity: 'warning',
          line,
          key,
          message: `Value for "${key}" contains spaces without quotes. This can break bash scripts and standard loaders.`,
          suggestion: `Wrap the value in double quotes: "${val}".`
        });
      }

      // 4. Trailing or leading whitespace in unquoted value
      if (!entry.quoted && (entry.raw.split('=')[1] || '').length > val.length) {
        const rawAfterEq = entry.raw.split('=')[1] || '';
        if (rawAfterEq.startsWith(' ') || rawAfterEq.endsWith(' ')) {
          issues.push({
            id: 'WHITESPACE_TRIM',
            rule: 'Unintended Whitespace',
            severity: 'info',
            line,
            key,
            message: `Value for "${key}" has leading or trailing spaces around the "=" operator.`,
            suggestion: 'Remove spacing immediately before or after the equals sign.'
          });
        }
      }

      // 5. Empty value check
      if (val === '' && !entry.inlineComment) {
        issues.push({
          id: 'EMPTY_VALUE',
          rule: 'Empty Variable',
          severity: 'info',
          line,
          key,
          message: `Variable "${key}" has an empty value.`,
          suggestion: 'Provide a default value or add an inline comment explaining its requirement.'
        });
      }

      // 6. Weak password / trivial secret check
      const isSensitiveKey = /(PASS(WORD)?|SECRET|TOKEN|KEY|AUTH|CREDENTIAL)/i.test(key);
      if (isSensitiveKey && WEAK_VALUES.has(val.toLowerCase())) {
        issues.push({
          id: 'WEAK_SECRET',
          rule: 'Insecure Default Credential',
          severity: 'critical',
          line,
          key,
          message: `Sensitive variable "${key}" is set to a trivial/weak value: "${val}".`,
          suggestion: 'Generate a strong high-entropy secret (use EnvPulse secret generator).'
        });
      }

      // 7. Production secrets & tokens pattern inspection
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(val) || pattern.regex.test(entry.raw)) {
          issues.push({
            id: pattern.id,
            rule: pattern.name,
            severity: pattern.severity,
            line,
            key,
            message: pattern.description,
            suggestion: 'Store this in a secure secret manager, CI/CD secret vault, or use an environment placeholder.'
          });
        }
      }

      // 8. Hardcoded localhost check in keys with URL or HOST
      if (/(URL|HOST|DOMAIN|ORIGIN)/i.test(key) && /(localhost|127\.0\.0\.1)/i.test(val)) {
        issues.push({
          id: 'LOCAL_HOST_URL',
          rule: 'Localhost Target',
          severity: 'info',
          line,
          key,
          message: `"${key}" points to a local address (${val}).`,
          suggestion: 'Ensure production environments override this with public domain.'
        });
      }
    }

    // Calculate Health & Security Score (0 to 100)
    let score = 100;
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const issue of issues) {
      if (issue.severity === 'critical') {
        score -= 25;
        criticalCount++;
      } else if (issue.severity === 'warning') {
        score -= 8;
        warningCount++;
      } else if (issue.severity === 'info') {
        score -= 2;
        infoCount++;
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      totalKeys: parseResult.totalKeys,
      issues,
      summary: {
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
        total: issues.length,
        status: score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 40 ? 'Needs Attention' : 'Critical Risk'
      }
    };
  }

  return {
    lintEnv,
    SECRET_PATTERNS
  };
});
