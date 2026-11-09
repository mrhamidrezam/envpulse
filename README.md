<div align="center">
  <img src="assets/logo.svg" alt="EnvPulse Logo" width="140" height="140">
  <h1>EnvPulse</h1>
  <p><strong>The Modern .env Studio, Security Linter, Multi-Environment Diff Engine & Schema Generator</strong></p>

  <p>
    <a href="https://mrhamidrezam.github.io/envpulse"><img src="https://img.shields.io/badge/Live_Demo-GitHub_Pages-6366f1?style=for-the-badge&logo=githubpages&logoColor=white" alt="Live Demo"></a>
    <img src="https://img.shields.io/badge/Dependencies-Zero-10b981?style=for-the-badge" alt="Zero Dependencies">
    <img src="https://img.shields.io/badge/Privacy-100%25_Client--Side-38bdf8?style=for-the-badge" alt="100% Client-Side">
    <img src="https://img.shields.io/badge/Tests-21%2F21_Passing-emerald?style=for-the-badge" alt="Tests">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-amber?style=for-the-badge" alt="MIT License"></a>
  </p>

  <p>
    <a href="https://mrhamidrezam.github.io/envpulse"><strong>⚡ Open Live Interactive Studio</strong></a>
  </p>
</div>

---

## ⚡ Overview

Environment variable management is one of the most critical yet error-prone aspects of modern software development. Accidental credential leaks on GitHub cost companies millions, out-of-sync `.env.example` templates break onboarding for new developers, and manually converting `.env` files into Kubernetes Secrets, Docker Compose, or type-safe schemas (Zod, Pydantic) is repetitive toil.

**EnvPulse** is an all-in-one developer workbench built to solve this:
- **100% Client-Side & Private**: Your secrets, keys, and credentials never touch a remote server or telemetry endpoint. Everything is computed right in your browser or local CLI.
- **Zero External Dependencies**: Fast, lightweight, isomorphic JavaScript engine that runs without npm packages.
- **Comprehensive Security Linter**: Detects high-risk leaked API keys (AWS, OpenAI, Anthropic, Gemini, GitHub, Stripe, Private Keys, Database URIs with plaintext passwords) before you commit.
- **Environment Diff & Sync**: Compares `.env` vs `.env.example` vs `.env.staging` with instant parity scoring and automated sanitized template generation.
- **Type-Safe Code Generator**: Converts environment variables into TypeScript Zod schemas, NodeJS `ProcessEnv` types, Python Pydantic V2 Settings, Go structs, and Rust Serde models.
- **Cloud & Infrastructure Exporter**: Instantly transforms `.env` to Kubernetes Secrets (YAML/Base64), ConfigMaps, Docker Compose environment blocks, Terraform `.tfvars`, shell exports, and GitHub CLI secret commands.
- **Built-in Cryptographic Secret Studio**: Generates 256-bit JWT secrets, AES-256 keys, UUIDv4, high-entropy passwords, and random API keys.

---

## ✨ Features at a Glance

| Feature | Description |
| :--- | :--- |
| **🛡️ Security Linter** | Real-time scanner detecting 10+ credential patterns, weak default passwords, duplicate keys, and POSIX violations. |
| **⚖️ Environment Diff** | Compares two environments, highlights missing variables, type conflicts, and computes synchronization parity. |
| **✨ .env.example Builder** | Automatically strips actual secrets, preserves comments & categories, and injects clean sanitized placeholders. |
| **📐 Schema Generation** | Generates type-safe configuration code for TypeScript (Zod), Python (Pydantic V2), Go, and Rust. |
| **🚀 Infra Converters** | One-click export to Kubernetes Secrets/ConfigMaps, Docker Compose, Terraform, and Shell scripts. |
| **🔒 Secret Masking** | Obfuscates sensitive values with a single click for safe screen sharing and live demos. |
| **🔑 Secret Generator** | Generates cryptographically secure high-entropy random keys, JWT secrets, and UUIDs. |

---

## 🛡️ Security Linter Rules

EnvPulse evaluates your `.env` against strict security and hygiene rules to compute an overall **Security Health Score (0–100%)**:

- `SEC_AWS_KEY`: AWS Access Key IDs (`AKIA...`, `ASIA...`)
- `SEC_OPENAI_KEY`: OpenAI API Keys (`sk-proj-...`, `sk-...`)
- `SEC_ANTHROPIC_KEY`: Anthropic Claude API Keys (`sk-ant-...`)
- `SEC_GEMINI_KEY`: Google Cloud / Gemini AI Keys (`AIzaSy...`)
- `SEC_GITHUB_TOKEN`: GitHub Personal Access & Fine-grained Tokens (`ghp_...`, `github_pat_...`)
- `SEC_STRIPE_SECRET`: Stripe Live Secret Keys (`sk_live_...`, `rk_live_...`)
- `SEC_PRIVATE_KEY`: Raw RSA, ECDSA, or OpenSSH Private Keys (`-----BEGIN PRIVATE KEY-----`)
- `SEC_SLACK_WEBHOOK`: Slack Incoming Webhook URLs & bot tokens
- `SEC_DB_URI_PASSWORD`: Database connection strings with embedded plaintext credentials
- `WEAK_SECRET`: Sensitive variables with default/weak values (`password`, `123456`, `admin`, `secret`)
- `DUPLICATE_KEY`: Duplicate variable declarations that silently overwrite previous values
- `UNQUOTED_SPACES`: Values containing spaces without double quotes breaking bash loaders

---

## 📐 Generated Code Examples

### TypeScript (Zod)
```typescript
import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DEBUG: z.coerce.boolean().default(false),
  DATABASE_URL: z.string().min(1),
  API_KEY: z.string().min(1, 'Required secret variable missing'),
});

export type Env = z.infer<typeof envSchema>;
```

### Python (Pydantic V2)
```python
from pydantic import Field, SecretStr, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    PORT: int = Field(3000)
    DEBUG: bool = Field(False)
    DATABASE_URL: str = Field(...)
    API_KEY: SecretStr = Field(...)

settings = AppSettings()
```

---

## 🚀 Infrastructure Exporters

### Kubernetes Secret (YAML)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  API_KEY: "secret-token"
```

### Docker Compose
```yaml
version: '3.8'
services:
  app:
    environment:
      - PORT=3000
      - DEBUG=false
```

---

## 🧪 Automated Testing

EnvPulse features a zero-dependency test runner covering the parser, linter, diff engine, schema generators, infrastructure converters, and crypto utilities:

```bash
# Clone the repository
git clone https://github.com/mrhamidrezam/envpulse.git
cd envpulse

# Run unit tests
node tests/test_envpulse.js
```

### Test Results:
```
⚡ Running EnvPulse Test Suite...

--- Parser & Serializer Tests ---
  ✓ Parses basic KEY=VALUE and empty lines
  ✓ Parses double and single quoted strings with escaping
  ✓ Parses multiline quoted values
  ✓ Handles inline comments and export prefix
  ✓ Infers correct types
  ✓ Serializes entries back to valid .env string

--- Linter & Security Inspector Tests ---
  ✓ Detects exposed AWS Access Key
  ✓ Detects exposed OpenAI and Gemini keys
  ✓ Detects weak password in sensitive keys
  ✓ Detects duplicate keys and unquoted spaces
  ✓ Calculates health score appropriately

--- Diff Engine Tests ---
  ✓ Identifies missing keys and parity score
  ✓ Generates clean sanitized .env.example

--- Schema Generators Tests ---
  ✓ Generates TypeScript Zod Schema
  ✓ Generates Python Pydantic V2 Model
  ✓ Generates Go and Rust Structs

--- Infrastructure Converters Tests ---
  ✓ Converts to Kubernetes Secret and ConfigMap
  ✓ Converts to Docker Compose, Shell, and JSON

--- Crypto & Utility Tests ---
  ✓ Generates secure random hex and UUID
  ✓ Generates high-entropy passwords and API keys
  ✓ Masks secrets and sensitive env values

==========================================
Test Results: 21 Passed, 0 Failed
==========================================
```

---

## 📂 Project Architecture

```
envpulse/
├── .github/
│   └── workflows/
│       └── test.yml          # GitHub Actions Multi-Node CI matrix (18, 20, 22)
├── assets/
│   ├── logo.svg              # Sleek SVG brand logo
│   └── favicon.svg           # High-DPI browser favicon
├── css/
│   └── style.css             # Dark-mode developer theme & responsive UI
├── js/
│   ├── app.js                # UI controller, event handlers & preset library
│   ├── parser.js             # Robust .env parser, serializer & type inference
│   ├── linter.js             # Security scanner, leak detector & score engine
│   ├── diff.js               # Multi-environment diff engine & template creator
│   ├── generators.js         # Zod, Pydantic, Go, and Rust schema generator
│   ├── converters.js         # Kubernetes, Docker, Terraform & Shell exporters
│   └── crypto.js             # Cryptographic secret generator & masking utility
├── tests/
│   └── test_envpulse.js      # Comprehensive zero-dependency test suite
├── index.html                # Interactive single-page web studio
├── LICENSE                   # MIT License
└── README.md                 # Complete documentation
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
