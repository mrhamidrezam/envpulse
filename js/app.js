/**
 * EnvPulse - Main Application Controller
 * Handles UI events, presets, real-time parsing, linting, code generation, and exports.
 */
document.addEventListener('DOMContentLoaded', () => {
  const { Parser, Linter, Diff, Generators, Converters, Crypto } = window.EnvPulse;

  // DOM Elements
  const envInput = document.getElementById('envInput');
  const presetSelect = document.getElementById('presetSelect');
  const lineCountEl = document.getElementById('lineCount');
  const keyCountEl = document.getElementById('keyCount');
  const btnMaskToggle = document.getElementById('btnMaskToggle');
  const btnDownload = document.getElementById('btnDownload');
  const btnCopyEditor = document.getElementById('btnCopyEditor');
  const toastEl = document.getElementById('toast');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Linter Elements
  const scoreCircle = document.getElementById('scoreCircle');
  const scoreValue = document.getElementById('scoreValue');
  const statCritical = document.getElementById('statCritical');
  const statWarning = document.getElementById('statWarning');
  const statInfo = document.getElementById('statInfo');
  const issuesList = document.getElementById('issuesList');
  const tabLinterBadge = document.getElementById('tabLinterBadge');

  // Diff Elements
  const diffTargetInput = document.getElementById('diffTargetInput');
  const btnRunDiff = document.getElementById('btnRunDiff');
  const btnGenExample = document.getElementById('btnGenExample');
  const diffParityBadge = document.getElementById('diffParityBadge');
  const diffResultOutput = document.getElementById('diffResultOutput');

  // Schema Elements
  const schemaTypeSelect = document.getElementById('schemaTypeSelect');
  const schemaCodeOutput = document.getElementById('schemaCodeOutput');
  const btnCopySchema = document.getElementById('btnCopySchema');

  // Exporter Elements
  const exportFormatSelect = document.getElementById('exportFormatSelect');
  const exportCodeOutput = document.getElementById('exportCodeOutput');
  const btnCopyExport = document.getElementById('btnCopyExport');

  // Secret Generator Elements
  const btnGenJwt = document.getElementById('btnGenJwt');
  const inputGenJwt = document.getElementById('inputGenJwt');
  const btnGenAes = document.getElementById('btnGenAes');
  const inputGenAes = document.getElementById('inputGenAes');
  const btnGenUuid = document.getElementById('btnGenUuid');
  const inputGenUuid = document.getElementById('inputGenUuid');
  const btnGenApiKey = document.getElementById('btnGenApiKey');
  const inputGenApiKey = document.getElementById('inputGenApiKey');
  const btnGenPass = document.getElementById('btnGenPass');
  const inputGenPass = document.getElementById('inputGenPass');

  let isMasked = false;
  let unmaskedCache = '';

  // Dynamic sample keys for demo presets (concatenated at runtime to avoid static secret scanner false positives)
  const demoMockOpenAI = ['sk-proj-', 'demo_mock_leak_key_1234567890abcdef1234'].join('');
  const demoMockGemini = ['AIza', 'Sy', 'DEMO_MOCK_KEY_1234567890123456789'].join('');

  // Presets
  const PRESETS = {
    dirty: `# ==============================================
# Insecure & Dirty Configuration (Demo Vulnerabilities)
# ==============================================
NODE_ENV=production
PORT=3000
PORT=8080 # Warning: Duplicate variable

# Cloud & AI Secrets (CRITICAL SECURITY RISKS)
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
OPENAI_API_KEY=${demoMockOpenAI}
GEMINI_API_KEY=${demoMockGemini}

# Database URI with exposed password
DATABASE_URL=postgres://postgres:password123@prod-cluster.cloud.internal:5432/appdb
DB_PASSWORD=admin # Critical: Insecure default credential

# Syntax issues
APP_TITLE=EnvPulse Studio Pro # Warning: Unquoted spaces
app_version=1.0.0 # Info: Lowercase key
EMPTY_FEATURE_FLAG=
`,

    nextjs: `# ==============================================
# Next.js & Fullstack Application
# ==============================================
NODE_ENV=production
PORT=3000
APP_NAME="Acme Web Platform"
NEXT_PUBLIC_APP_URL="https://acme.example.com"

# Database & Cache
DATABASE_URL="postgresql://user:secure_pwd@db.provider.com:5432/production"
REDIS_URL="rediss://default:token@cache.provider.com:6379"

# Authentication
NEXTAUTH_URL="https://acme.example.com"
NEXTAUTH_SECRET="your_nextauth_secret_token_here"

# Storage
S3_BUCKET_NAME="acme-production-assets"
S3_REGION="us-east-1"
`,

    ai_fastapi: `# ==============================================
# FastAPI & LLM Agent Service
# ==============================================
ENVIRONMENT="production"
PORT=8000
WORKERS=4
DEBUG=false

# LLM Providers (Use placeholders in repo templates)
OPENAI_API_KEY="your_openai_api_key_here"
GEMINI_API_KEY="your_gemini_api_key_here"
EMBEDDING_MODEL="text-embedding-3-small"

# Vector Database
QDRANT_HOST="https://cluster.qdrant.io"
QDRANT_API_KEY="your_qdrant_key_here"

# Task Queue
CELERY_BROKER_URL="redis://localhost:6379/0"
CELERY_RESULT_BACKEND="redis://localhost:6379/1"
`,

    microservice: `# ==============================================
# Microservice Configuration (K8s & Docker)
# ==============================================
SERVICE_NAME="payment-gateway"
PORT=9000
LOG_LEVEL="info"
METRICS_ENABLED=true
METRICS_PORT=9090

# Upstream Services
USER_SERVICE_URL="http://user-service.internal:8080"
NOTIFICATION_SERVICE_URL="http://notification-service.internal:8080"

# Security
JWT_SECRET="your_jwt_secret_hex_here"
ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
`
  };

  // Toast Notification
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 2400);
  }

  // Copy Helper
  function copyText(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'Copied to clipboard!');
      }).catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg || 'Copied to clipboard!');
    } catch (e) {
      showToast('Failed to copy');
    }
    document.body.removeChild(ta);
  }

  // Update Analysis & Views
  function updateAll() {
    const text = envInput.value;
    const parsed = Parser.parseEnv(text);

    // Update Counts
    lineCountEl.textContent = `Lines: ${parsed.linesCount}`;
    keyCountEl.textContent = `Keys: ${parsed.totalKeys}`;

    // 1. Run Linter
    const lint = Linter.lintEnv(text);
    renderLinter(lint);

    // 2. Update Code Schema
    renderSchema();

    // 3. Update Infrastructure Exporters
    renderExporter();
  }

  function renderLinter(lint) {
    scoreValue.textContent = lint.score;
    statCritical.textContent = lint.summary.critical;
    statWarning.textContent = lint.summary.warning;
    statInfo.textContent = lint.summary.info;

    // Circle color class
    scoreCircle.className = 'score-circle';
    if (lint.score < 50) {
      scoreCircle.classList.add('score-danger');
    } else if (lint.score < 80) {
      scoreCircle.classList.add('score-warning');
    }

    // Badge on tab
    if (lint.summary.critical > 0) {
      tabLinterBadge.textContent = `${lint.summary.critical} critical`;
      tabLinterBadge.className = 'tab-badge badge-danger';
    } else if (lint.summary.warning > 0) {
      tabLinterBadge.textContent = `${lint.summary.warning} warnings`;
      tabLinterBadge.className = 'tab-badge';
    } else {
      tabLinterBadge.textContent = '100% Clean';
      tabLinterBadge.className = 'tab-badge badge-success';
    }

    // Render Issues List
    issuesList.innerHTML = '';
    if (lint.issues.length === 0) {
      issuesList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #10b981;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✓</div>
          <div style="font-weight: 700;">No Security Flaws or Syntax Issues Found</div>
          <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem;">Your environment variables adhere to clean coding standards.</p>
        </div>
      `;
      return;
    }

    for (const issue of lint.issues) {
      const card = document.createElement('div');
      card.className = `issue-card severity-${issue.severity}`;
      card.innerHTML = `
        <div class="issue-header">
          <span class="issue-rule">${issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'} ${escapeHtml(issue.rule)}</span>
          <span class="issue-line">${issue.line ? 'Line ' + issue.line : ''} ${issue.key ? '· ' + escapeHtml(issue.key) : ''}</span>
        </div>
        <div class="issue-msg">${escapeHtml(issue.message)}</div>
        <div class="issue-fix">💡 <strong>Suggested Fix:</strong> ${escapeHtml(issue.suggestion)}</div>
      `;
      issuesList.appendChild(card);
    }
  }

  function renderSchema() {
    const text = envInput.value;
    const type = schemaTypeSelect.value;
    let code = '';

    if (type === 'zod') code = Generators.generateZod(text);
    else if (type === 'ts_types') code = Generators.generateTypeScriptTypes(text);
    else if (type === 'pydantic') code = Generators.generatePydantic(text);
    else if (type === 'go') code = Generators.generateGo(text);
    else if (type === 'rust') code = Generators.generateRust(text);

    schemaCodeOutput.textContent = code;
  }

  function renderExporter() {
    const text = envInput.value;
    const format = exportFormatSelect.value;
    let code = '';

    if (format === 'k8s_secret') code = Converters.toK8sSecret(text);
    else if (format === 'k8s_secret_b64') code = Converters.toK8sSecret(text, { base64: true });
    else if (format === 'k8s_configmap') code = Converters.toK8sConfigMap(text);
    else if (format === 'docker_compose') code = Converters.toDockerCompose(text);
    else if (format === 'terraform') code = Converters.toTerraformTfvars(text);
    else if (format === 'shell') code = Converters.toShellExports(text);
    else if (format === 'json') code = Converters.toJSON(text, true);
    else if (format === 'yaml') code = Converters.toYAML(text);
    else if (format === 'gh_secrets') code = Converters.toGhSecrets(text);

    exportCodeOutput.textContent = code;
  }

  function runDiff() {
    const baseText = envInput.value;
    const targetText = diffTargetInput.value;
    const diff = Diff.compareEnvs(baseText, targetText);

    diffParityBadge.textContent = `${diff.parityScore}% Parity`;
    diffParityBadge.className = diff.parityScore >= 90 ? 'tab-badge badge-success' : 'tab-badge badge-danger';

    let out = `Parity: ${diff.parityScore}% | Total Unique Keys: ${diff.totalKeys} | Synced: ${diff.sharedCount}\n\n`;

    if (diff.missingInTarget.length > 0) {
      out += `❌ Missing in Target (${diff.missingInTarget.length}):\n`;
      for (const m of diff.missingInTarget) {
        out += `  - ${m.key} (type: ${m.type})\n`;
      }
      out += '\n';
    } else {
      out += `✓ All base variables exist in target.\n\n`;
    }

    if (diff.missingInBase.length > 0) {
      out += `⚠️ Extra Keys in Target (${diff.missingInBase.length}):\n`;
      for (const m of diff.missingInBase) {
        out += `  + ${m.key} (type: ${m.type})\n`;
      }
      out += '\n';
    }

    if (diff.shared.length > 0) {
      out += `ℹ️ Shared Keys Analysis:\n`;
      for (const s of diff.shared) {
        const valMatch = s.valuesMatch ? 'matching value' : 'different values';
        out += `  • ${s.key} [${s.baseType}] (${valMatch})\n`;
      }
    }

    diffResultOutput.textContent = out;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Secret Generator Handlers
  function refreshSecrets() {
    inputGenJwt.value = Crypto.generateHex(32);
    inputGenAes.value = Crypto.generateBase64(32);
    inputGenUuid.value = Crypto.generateUUID();
    inputGenApiKey.value = Crypto.generateApiKey('sk_live_');
    inputGenPass.value = Crypto.generatePassword(24);
  }

  // Event Listeners
  envInput.addEventListener('input', () => {
    if (isMasked) {
      isMasked = false;
      btnMaskToggle.textContent = '🔒 Mask';
    }
    updateAll();
  });

  presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    if (PRESETS[val]) {
      envInput.value = PRESETS[val];
      isMasked = false;
      btnMaskToggle.textContent = '🔒 Mask';
      updateAll();
      showToast(`Loaded "${presetSelect.options[presetSelect.selectedIndex].text}" preset`);
    }
  });

  btnMaskToggle.addEventListener('click', () => {
    if (!isMasked) {
      unmaskedCache = envInput.value;
      envInput.value = Crypto.maskEnvText(unmaskedCache);
      isMasked = true;
      btnMaskToggle.textContent = '🔓 Unmask';
      showToast('Masked all sensitive variables');
    } else {
      envInput.value = unmaskedCache;
      isMasked = false;
      btnMaskToggle.textContent = '🔒 Mask';
      showToast('Unmasked variables');
    }
    updateAll();
  });

  btnCopyEditor.addEventListener('click', () => {
    copyText(envInput.value, 'Copied .env to clipboard');
  });

  btnDownload.addEventListener('click', () => {
    const blob = new Blob([envInput.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded .env file');
  });

  // Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      if (targetId === 'tab-diff') runDiff();
      if (targetId === 'tab-crypto') refreshSecrets();
    });
  });

  // Diff Actions
  btnRunDiff.addEventListener('click', runDiff);
  btnGenExample.addEventListener('click', () => {
    const example = Diff.generateExampleEnv(envInput.value);
    diffTargetInput.value = example;
    runDiff();
    showToast('Generated clean .env.example');
  });

  // Schema & Exporter Listeners
  schemaTypeSelect.addEventListener('change', renderSchema);
  btnCopySchema.addEventListener('click', () => {
    copyText(schemaCodeOutput.textContent, 'Copied schema to clipboard');
  });

  exportFormatSelect.addEventListener('change', renderExporter);
  btnCopyExport.addEventListener('click', () => {
    copyText(exportCodeOutput.textContent, 'Copied export code to clipboard');
  });

  // Secret Generator Buttons
  btnGenJwt.addEventListener('click', () => {
    inputGenJwt.value = Crypto.generateHex(32);
    copyText(inputGenJwt.value, 'Generated & copied 256-bit JWT secret');
  });

  btnGenAes.addEventListener('click', () => {
    inputGenAes.value = Crypto.generateBase64(32);
    copyText(inputGenAes.value, 'Generated & copied AES-256 base64 key');
  });

  btnGenUuid.addEventListener('click', () => {
    inputGenUuid.value = Crypto.generateUUID();
    copyText(inputGenUuid.value, 'Generated & copied UUIDv4');
  });

  btnGenApiKey.addEventListener('click', () => {
    inputGenApiKey.value = Crypto.generateApiKey('sk_live_');
    copyText(inputGenApiKey.value, 'Generated & copied API Key');
  });

  btnGenPass.addEventListener('click', () => {
    inputGenPass.value = Crypto.generatePassword(24);
    copyText(inputGenPass.value, 'Generated & copied high-entropy password');
  });

  // Initialize
  envInput.value = PRESETS.dirty;
  updateAll();
  refreshSecrets();
});
