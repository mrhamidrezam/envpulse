/**
 * EnvPulse - Infrastructure & Format Exporter
 * Converts .env variables into Kubernetes Secrets/ConfigMaps, Docker Compose,
 * Terraform, Shell exports, JSON, and YAML.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Parser = require('./parser');
    module.exports = factory(Parser);
  } else {
    root.EnvPulse = root.EnvPulse || {};
    root.EnvPulse.Converters = factory(root.EnvPulse.Parser);
  }
})(typeof self !== 'undefined' ? self : this, function (Parser) {
  'use strict';

  function encodeBase64(str) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    return str;
  }

  function toK8sSecret(envText, options) {
    options = options || {};
    const secretName = options.name || 'app-secrets';
    const useBase64 = options.base64 === true;
    const parsed = Parser.parseEnv(envText || '');

    const lines = [
      `apiVersion: v1`,
      `kind: Secret`,
      `metadata:`,
      `  name: ${secretName}`,
      `type: Opaque`,
      useBase64 ? `data:` : `stringData:`
    ];

    for (const [key, val] of Object.entries(parsed.map)) {
      const formattedVal = useBase64 ? encodeBase64(val) : JSON.stringify(val);
      lines.push(`  ${key}: ${formattedVal}`);
    }

    return lines.join('\n');
  }

  function toK8sConfigMap(envText, options) {
    options = options || {};
    const configMapName = options.name || 'app-config';
    const parsed = Parser.parseEnv(envText || '');

    const lines = [
      `apiVersion: v1`,
      `kind: ConfigMap`,
      `metadata:`,
      `  name: ${configMapName}`,
      `data:`
    ];

    for (const [key, val] of Object.entries(parsed.map)) {
      lines.push(`  ${key}: ${JSON.stringify(val)}`);
    }

    return lines.join('\n');
  }

  function toDockerCompose(envText, options) {
    options = options || {};
    const serviceName = options.service || 'app';
    const asList = options.asList !== false;
    const parsed = Parser.parseEnv(envText || '');

    const lines = [
      `version: '3.8'`,
      `services:`,
      `  ${serviceName}:`,
      `    environment:`
    ];

    for (const [key, val] of Object.entries(parsed.map)) {
      if (asList) {
        lines.push(`      - ${key}=${val}`);
      } else {
        lines.push(`      ${key}: ${JSON.stringify(val)}`);
      }
    }

    return lines.join('\n');
  }

  function toTerraformTfvars(envText) {
    const parsed = Parser.parseEnv(envText || '');
    const lines = [];

    for (const [key, val] of Object.entries(parsed.map)) {
      const type = Parser.inferType(val);
      if (type === 'number') {
        lines.push(`${key.toLowerCase()} = ${val}`);
      } else if (type === 'boolean') {
        lines.push(`${key.toLowerCase()} = ${val.toLowerCase()}`);
      } else {
        lines.push(`${key.toLowerCase()} = ${JSON.stringify(val)}`);
      }
    }

    return lines.join('\n');
  }

  function toShellExports(envText) {
    const parsed = Parser.parseEnv(envText || '');
    const lines = [`#!/usr/bin/env bash`];

    for (const [key, val] of Object.entries(parsed.map)) {
      lines.push(`export ${key}="${Parser.escapeDoubleQuoted(val)}"`);
    }

    return lines.join('\n');
  }

  function toJSON(envText, pretty) {
    const parsed = Parser.parseEnv(envText || '');
    return JSON.stringify(parsed.map, null, pretty !== false ? 2 : 0);
  }

  function toYAML(envText) {
    const parsed = Parser.parseEnv(envText || '');
    const lines = [];

    for (const [key, val] of Object.entries(parsed.map)) {
      const type = Parser.inferType(val);
      if (type === 'number' || type === 'boolean') {
        lines.push(`${key}: ${val}`);
      } else if (val.includes('\n')) {
        lines.push(`${key}: |`);
        for (const line of val.split('\n')) {
          lines.push(`  ${line}`);
        }
      } else {
        lines.push(`${key}: ${JSON.stringify(val)}`);
      }
    }

    return lines.join('\n');
  }

  function toGhSecrets(envText) {
    const parsed = Parser.parseEnv(envText || '');
    const lines = [`# Run these commands in your repository root with GitHub CLI`];

    for (const [key, val] of Object.entries(parsed.map)) {
      lines.push(`gh secret set ${key} --body "${Parser.escapeDoubleQuoted(val)}"`);
    }

    return lines.join('\n');
  }

  return {
    toK8sSecret,
    toK8sConfigMap,
    toDockerCompose,
    toTerraformTfvars,
    toShellExports,
    toJSON,
    toYAML,
    toGhSecrets
  };
});
