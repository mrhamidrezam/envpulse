/**
 * EnvPulse Test Suite
 * Zero-dependency automated test runner for Parser, Linter, Diff, Generators, Converters & Crypto.
 */
const assert = require('assert');
const Parser = require('../js/parser');
const Linter = require('../js/linter');
const Diff = require('../js/diff');
const Generators = require('../js/generators');
const Converters = require('../js/converters');
const Crypto = require('../js/crypto');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

console.log('\n⚡ Running EnvPulse Test Suite...\n');

// ==========================================
// 1. Parser Tests
// ==========================================
console.log('--- Parser & Serializer Tests ---');

test('Parses basic KEY=VALUE and empty lines', () => {
  const env = 'APP_NAME=EnvPulse\n\nPORT=3000';
  const res = Parser.parseEnv(env);
  assert.strictEqual(res.totalKeys, 2);
  assert.strictEqual(res.map.APP_NAME, 'EnvPulse');
  assert.strictEqual(res.map.PORT, '3000');
  assert.strictEqual(res.entries.length, 3);
});

test('Parses double and single quoted strings with escaping', () => {
  const env = `MSG="Hello \\"World\\"\\nNew Line"\nSECRET='Single quoted literal'`;
  const res = Parser.parseEnv(env);
  assert.strictEqual(res.map.MSG, 'Hello "World"\nNew Line');
  assert.strictEqual(res.map.SECRET, 'Single quoted literal');
});

test('Parses multiline quoted values', () => {
  const env = `CERT="-----BEGIN CERT-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END CERT-----"`;
  const res = Parser.parseEnv(env);
  assert.strictEqual(res.totalKeys, 1);
  assert.ok(res.map.CERT.includes('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A'));
  assert.ok(res.map.CERT.includes('-----END CERT-----'));
});

test('Handles inline comments and export prefix', () => {
  const env = `export API_URL=https://api.example.com # primary backend API\nDEBUG=true # flag`;
  const res = Parser.parseEnv(env);
  assert.strictEqual(res.map.API_URL, 'https://api.example.com');
  assert.strictEqual(res.entries[0].inlineComment, 'primary backend API');
  assert.strictEqual(res.entries[0].isExport, true);
  assert.strictEqual(res.map.DEBUG, 'true');
});

test('Infers correct types', () => {
  assert.strictEqual(Parser.inferType('true'), 'boolean');
  assert.strictEqual(Parser.inferType('false'), 'boolean');
  assert.strictEqual(Parser.inferType('8080'), 'number');
  assert.strictEqual(Parser.inferType('3.14'), 'number');
  assert.strictEqual(Parser.inferType('https://google.com'), 'url');
  assert.strictEqual(Parser.inferType('postgresql://user:pass@host/db'), 'uri');
  assert.strictEqual(Parser.inferType('{"key":"value"}'), 'json');
  assert.strictEqual(Parser.inferType('arbitrary text'), 'string');
  assert.strictEqual(Parser.inferType(''), 'empty');
});

test('Serializes entries back to valid .env string', () => {
  const entries = [
    { type: 'comment', comment: 'Server Config' },
    { key: 'PORT', value: '3000', type: 'number' },
    { key: 'APP_TITLE', value: 'EnvPulse Studio', type: 'string', inlineComment: 'App name' }
  ];
  const out = Parser.serializeEnv(entries);
  assert.ok(out.includes('# Server Config'));
  assert.ok(out.includes('PORT=3000'));
  assert.ok(out.includes('APP_TITLE="EnvPulse Studio" # App name'));
});

// ==========================================
// 2. Linter Tests
// ==========================================
console.log('\n--- Linter & Security Inspector Tests ---');

test('Detects exposed AWS Access Key', () => {
  const env = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
  const lint = Linter.lintEnv(env);
  assert.strictEqual(lint.summary.critical >= 1, true);
  const found = lint.issues.some(i => i.id === 'SEC_AWS_KEY');
  assert.ok(found, 'Should find SEC_AWS_KEY');
});

test('Detects exposed OpenAI and Gemini keys', () => {
  // Construct mock sample keys dynamically so static repo secret scanners do not flag test fixtures
  const dummyOpenAI = ['sk-proj-', 'samplefakekey123456789012345678'].join('');
  const dummyGemini = ['AIza', 'Sy', 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'].join('');
  const env = `OPENAI_API_KEY=${dummyOpenAI}\nGEMINI_API_KEY=${dummyGemini}`;
  const lint = Linter.lintEnv(env);
  assert.strictEqual(lint.summary.critical, 2);
  assert.ok(lint.issues.some(i => i.id === 'SEC_OPENAI_KEY'));
  assert.ok(lint.issues.some(i => i.id === 'SEC_GEMINI_KEY'));
});

test('Detects weak password in sensitive keys', () => {
  const env = 'DB_PASSWORD=password\nADMIN_SECRET=123456';
  const lint = Linter.lintEnv(env);
  assert.ok(lint.issues.some(i => i.id === 'WEAK_SECRET'));
});

test('Detects duplicate keys and unquoted spaces', () => {
  const env = 'PORT=3000\nPORT=8080\nTITLE=Hello World Without Quotes';
  const lint = Linter.lintEnv(env);
  assert.ok(lint.issues.some(i => i.id === 'DUPLICATE_KEY'));
  assert.ok(lint.issues.some(i => i.id === 'UNQUOTED_SPACES'));
});

test('Calculates health score appropriately', () => {
  const cleanEnv = 'PORT=3000\nNODE_ENV=production\nDATABASE_URL=postgres://user:placeholder@db.cloud/prod';
  const cleanLint = Linter.lintEnv(cleanEnv);
  assert.ok(cleanLint.score >= 70);

  const mockOpenAI = ['sk-', 'proj-', 'sample12345678901234567890'].join('');
  const dirtyEnv = `AWS_KEY=AKIAIOSFODNN7EXAMPLE\nOPENAI_KEY=${mockOpenAI}\nDB_PASS=123456\nPORT=3000\nPORT=8080`;
  const dirtyLint = Linter.lintEnv(dirtyEnv);
  assert.ok(dirtyLint.score < 30);
});

// ==========================================
// 3. Diff Engine Tests
// ==========================================
console.log('\n--- Diff Engine Tests ---');

test('Identifies missing keys and parity score', () => {
  const base = 'PORT=3000\nDATABASE_URL=postgres://...\nREDIS_HOST=localhost';
  const target = 'PORT=3000\nDATABASE_URL=postgres://...';
  const diff = Diff.compareEnvs(base, target);

  assert.strictEqual(diff.missingInTarget.length, 1);
  assert.strictEqual(diff.missingInTarget[0].key, 'REDIS_HOST');
  assert.strictEqual(diff.missingInBase.length, 0);
  assert.strictEqual(diff.sharedCount, 2);
  assert.strictEqual(diff.parityScore, 67);
});

test('Generates clean sanitized .env.example', () => {
  const env = '# Configuration\nPORT=8080\nDATABASE_URL=postgres://admin:secret123@prod-db.cloud/app\nSTRIPE_SECRET_KEY=sk_live_12345678901234567890';
  const example = Diff.generateExampleEnv(env);

  assert.ok(example.includes('PORT=8080'));
  assert.ok(!example.includes('secret123'));
  assert.ok(!example.includes('sk_live_'));
  assert.ok(example.includes('your_stripe_secret_key_here') || example.includes('your_secret_key_here'));
});

// ==========================================
// 4. Schema Generators Tests
// ==========================================
console.log('\n--- Schema Generators Tests ---');

test('Generates TypeScript Zod Schema', () => {
  const env = 'PORT=3000\nDEBUG=true\nAPI_URL=https://api.domain.com\nAPI_KEY=secret_xyz';
  const zodCode = Generators.generateZod(env);

  assert.ok(zodCode.includes("import { z } from 'zod';"));
  assert.ok(zodCode.includes('PORT: z.coerce.number().default(3000)'));
  assert.ok(zodCode.includes('DEBUG: z.coerce.boolean()'));
  assert.ok(zodCode.includes('API_URL: z.string().url()'));
  assert.ok(zodCode.includes('export type Env = z.infer<typeof envSchema>;'));
});

test('Generates Python Pydantic V2 Model', () => {
  const env = 'PORT=8000\nDEBUG=false\nDATABASE_URL=https://db.internal';
  const pyCode = Generators.generatePydantic(env);

  assert.ok(pyCode.includes('class AppSettings(BaseSettings):'));
  assert.ok(pyCode.includes('PORT: int'));
  assert.ok(pyCode.includes('DEBUG: bool'));
  assert.ok(pyCode.includes('DATABASE_URL: HttpUrl'));
});

test('Generates Go and Rust Structs', () => {
  const env = 'PORT=8080\nDB_NAME=postgres';
  const goCode = Generators.generateGo(env);
  const rustCode = Generators.generateRust(env);

  assert.ok(goCode.includes('Port int `env:"PORT"'));
  assert.ok(goCode.includes('DbName string `env:"DB_NAME"'));
  assert.ok(rustCode.includes('pub port: u16,'));
  assert.ok(rustCode.includes('pub db_name: String,'));
});

// ==========================================
// 5. Infrastructure Converters Tests
// ==========================================
console.log('\n--- Infrastructure Converters Tests ---');

test('Converts to Kubernetes Secret and ConfigMap', () => {
  const env = 'DB_USER=appuser\nDB_PASS=supersecret';
  const k8sSecret = Converters.toK8sSecret(env, { name: 'backend-secret' });
  const k8sConfig = Converters.toK8sConfigMap(env, { name: 'backend-config' });

  assert.ok(k8sSecret.includes('kind: Secret'));
  assert.ok(k8sSecret.includes('name: backend-secret'));
  assert.ok(k8sSecret.includes('DB_PASS: "supersecret"'));

  assert.ok(k8sConfig.includes('kind: ConfigMap'));
  assert.ok(k8sConfig.includes('name: backend-config'));
});

test('Converts to Docker Compose, Shell, and JSON', () => {
  const env = 'PORT=3000\nNODE_ENV=production';
  const compose = Converters.toDockerCompose(env, { service: 'api' });
  const sh = Converters.toShellExports(env);
  const json = Converters.toJSON(env);

  assert.ok(compose.includes('services:'));
  assert.ok(compose.includes('- PORT=3000'));
  assert.ok(sh.includes('export PORT="3000"'));
  assert.strictEqual(JSON.parse(json).PORT, '3000');
});

// ==========================================
// 6. Cryptography & Utilities Tests
// ==========================================
console.log('\n--- Crypto & Utility Tests ---');

test('Generates secure random hex and UUID', () => {
  const hex = Crypto.generateHex(32);
  assert.strictEqual(hex.length, 64);

  const uuid = Crypto.generateUUID();
  assert.strictEqual(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid), true);
});

test('Generates high-entropy passwords and API keys', () => {
  const pass = Crypto.generatePassword(32);
  assert.strictEqual(pass.length, 32);

  const key = Crypto.generateApiKey('sk_live_');
  assert.ok(key.startsWith('sk_live_'));
  assert.strictEqual(key.length, 8 + 48);
});

test('Masks secrets and sensitive env values', () => {
  const masked = Crypto.maskSecret('sk-proj-1234567890abcdef123456');
  assert.ok(masked.includes('••••'));
  assert.strictEqual(masked.startsWith('sk-p'), true);

  const env = 'APP_NAME=MyApp\nSTRIPE_SECRET=sk_live_secretkey123456';
  const maskedEnv = Crypto.maskEnvText(env);
  assert.ok(maskedEnv.includes('APP_NAME=MyApp'));
  assert.ok(maskedEnv.includes('STRIPE_SECRET=••••••••••••'));
});

// ==========================================
// Final Report
// ==========================================
console.log(`\n==========================================`);
console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log(`==========================================\n`);

if (failedTests > 0) {
  process.exit(1);
}
