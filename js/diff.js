/**
 * EnvPulse - Multi-Environment Diff Engine & Example Generator
 * Compares two .env files side-by-side, identifies missing or mismatched keys,
 * and generates clean, sanitized .env.example templates.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Parser = require('./parser');
    module.exports = factory(Parser);
  } else {
    root.EnvPulse = root.EnvPulse || {};
    root.EnvPulse.Diff = factory(root.EnvPulse.Parser);
  }
})(typeof self !== 'undefined' ? self : this, function (Parser) {
  'use strict';

  function compareEnvs(baseText, targetText) {
    const baseParsed = Parser.parseEnv(baseText || '');
    const targetParsed = Parser.parseEnv(targetText || '');

    const baseKeys = Object.keys(baseParsed.map);
    const targetKeys = Object.keys(targetParsed.map);

    const allKeysSet = new Set([...baseKeys, ...targetKeys]);
    const allKeys = Array.from(allKeysSet).sort();

    const missingInTarget = [];
    const missingInBase = [];
    const shared = [];

    for (const key of allKeys) {
      const inBase = Object.prototype.hasOwnProperty.call(baseParsed.map, key);
      const inTarget = Object.prototype.hasOwnProperty.call(targetParsed.map, key);

      if (inBase && !inTarget) {
        missingInTarget.push({
          key,
          baseValue: baseParsed.map[key],
          type: Parser.inferType(baseParsed.map[key])
        });
      } else if (!inBase && inTarget) {
        missingInBase.push({
          key,
          targetValue: targetParsed.map[key],
          type: Parser.inferType(targetParsed.map[key])
        });
      } else {
        const baseVal = baseParsed.map[key];
        const targetVal = targetParsed.map[key];
        const baseType = Parser.inferType(baseVal);
        const targetType = Parser.inferType(targetVal);

        shared.push({
          key,
          baseValue: baseVal,
          targetValue: targetVal,
          valuesMatch: baseVal === targetVal,
          typesMatch: baseType === targetType,
          baseType,
          targetType
        });
      }
    }

    const totalUnique = allKeys.length;
    const syncedCount = shared.length;
    const parityScore = totalUnique === 0 ? 100 : Math.round((syncedCount / totalUnique) * 100);

    return {
      parityScore,
      totalKeys: totalUnique,
      sharedCount: syncedCount,
      missingInTarget,
      missingInBase,
      shared,
      isFullySynced: missingInTarget.length === 0 && missingInBase.length === 0
    };
  }

  function getPlaceholderValue(key, originalValue) {
    const k = key.toUpperCase();
    if (k === 'NODE_ENV' || k === 'APP_ENV' || k === 'ENVIRONMENT') return 'development';
    if (k === 'PORT') return originalValue && /^\d+$/.test(originalValue) ? originalValue : '3000';
    if (k.includes('HOST')) return 'localhost';
    if (k.includes('URL') || k.includes('DOMAIN') || k.includes('ORIGIN')) return 'http://localhost:3000';
    if (k.includes('DATABASE_URL') || k.includes('DB_URI')) return 'postgresql://postgres:postgres@localhost:5432/my_db';
    if (k.includes('REDIS_URL')) return 'redis://localhost:6379';
    if (k.includes('PASSWORD') || k.includes('PASS')) return 'your_secure_password_here';
    if (k.includes('API_KEY') || k.includes('APIKEY')) return 'your_api_key_here';
    if (k.includes('SECRET')) return 'your_secret_key_here';
    if (k.includes('TOKEN')) return 'your_token_here';
    if (k.includes('EMAIL') || k.includes('MAIL')) return 'user@example.com';
    if (k.includes('ENABLE') || k.includes('DEBUG') || k.includes('IS_')) return 'false';
    if (/^\d+$/.test(originalValue)) return '0';
    if (originalValue.toLowerCase() === 'true' || originalValue.toLowerCase() === 'false') return 'false';
    return `your_${key.toLowerCase()}_here`;
  }

  function generateExampleEnv(text, options) {
    options = options || {};
    const parsed = Parser.parseEnv(text || '');
    const lines = [];

    for (const entry of parsed.entries) {
      if (entry.type === 'empty') {
        lines.push('');
      } else if (entry.type === 'comment') {
        lines.push('# ' + (entry.comment || ''));
      } else if (entry.key) {
        const placeholder = getPlaceholderValue(entry.key, entry.value);
        const prefix = entry.isExport ? 'export ' : '';
        const comment = entry.inlineComment ? ` # ${entry.inlineComment}` : '';
        lines.push(`${prefix}${entry.key}=${placeholder}${comment}`);
      }
    }

    return lines.join('\n');
  }

  return {
    compareEnvs,
    generateExampleEnv,
    getPlaceholderValue
  };
});
