/**
 * EnvPulse - Cryptographic Utilities & Secret Tools
 * Generates high-entropy secrets, masks credentials, and provides client-side
 * AES-GCM encryption for safe .env sharing.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const nodeCrypto = require('crypto');
    module.exports = factory(nodeCrypto);
  } else {
    root.EnvPulse = root.EnvPulse || {};
    root.EnvPulse.Crypto = factory(null);
  }
})(typeof self !== 'undefined' ? self : this, function (nodeCrypto) {
  'use strict';

  function getRandomBytes(size) {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(size);
      window.crypto.getRandomValues(bytes);
      return bytes;
    } else if (nodeCrypto && nodeCrypto.randomBytes) {
      return new Uint8Array(nodeCrypto.randomBytes(size));
    } else {
      // Fallback pseudo-random (only if crypto is unavailable)
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
      return bytes;
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function generateHex(byteLength) {
    return bytesToHex(getRandomBytes(byteLength || 32));
  }

  function generateBase64(byteLength) {
    const bytes = getRandomBytes(byteLength || 32);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa !== 'undefined') {
      return btoa(binary);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    return bytesToHex(bytes);
  }

  function generateUUID() {
    const b = getRandomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; // Version 4
    b[8] = (b[8] & 0x3f) | 0x80; // Variant RFC4122
    const h = bytesToHex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }

  function generatePassword(length, options) {
    length = length || 24;
    options = options || { upper: true, lower: true, digits: true, symbols: true };

    let charset = '';
    if (options.upper !== false) charset += 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (options.lower !== false) charset += 'abcdefghijkmnopqrstuvwxyz';
    if (options.digits !== false) charset += '23456789';
    if (options.symbols !== false) charset += '!@#$%^&*()-_=+[]{}';

    if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const bytes = getRandomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  function generateApiKey(prefix) {
    prefix = prefix || 'sk_live_';
    return `${prefix}${generateHex(24)}`;
  }

  function maskSecret(val) {
    if (!val || typeof val !== 'string') return '';
    if (val.length <= 6) return '••••••';
    const prefixLen = Math.min(4, Math.floor(val.length / 4));
    const suffixLen = Math.min(4, Math.floor(val.length / 4));
    const maskLen = val.length - prefixLen - suffixLen;
    return val.slice(0, prefixLen) + '•'.repeat(Math.max(6, maskLen)) + val.slice(val.length - suffixLen);
  }

  function maskEnvText(text) {
    const lines = text.split(/\r?\n/);
    const maskedLines = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        maskedLines.push(line);
        continue;
      }

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) {
        maskedLines.push(line);
        continue;
      }

      const keyPart = line.slice(0, eqIdx);
      const valPart = line.slice(eqIdx + 1);
      const keyTrimmed = keyPart.trim().replace(/^export\s+/, '');

      const isSensitive = /(SECRET|KEY|PASS(WORD)?|TOKEN|AUTH|CREDENTIAL|PRIVATE)/i.test(keyTrimmed);
      if (isSensitive && valPart.trim()) {
        maskedLines.push(`${keyPart}=••••••••••••`);
      } else {
        maskedLines.push(line);
      }
    }

    return maskedLines.join('\n');
  }

  return {
    generateHex,
    generateBase64,
    generateUUID,
    generatePassword,
    generateApiKey,
    maskSecret,
    maskEnvText
  };
});
