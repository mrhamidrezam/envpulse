/**
 * EnvPulse - Parser & Serializer Module
 * Robust .env parsing with comments, multiline values, type inference, and quotes.
 * Isomorphic: works in browser and Node.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.EnvPulse = root.EnvPulse || {};
    root.EnvPulse.Parser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function inferType(val) {
    if (val === undefined || val === null || val === '') return 'empty';
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === 'false') return 'boolean';
    if (/^-?\d+$/.test(val.trim())) return 'number';
    if (/^-?\d+\.\d+$/.test(val.trim())) return 'number';
    if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(val.trim())) return 'url';
    if (/^[a-zA-Z0-9+.-]+:\/\/.+/.test(val.trim())) return 'uri';
    if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
      try {
        JSON.parse(val);
        return 'json';
      } catch (e) {
        // not valid json, fallback to string
      }
    }
    return 'string';
  }

  function parseEnv(text) {
    if (typeof text !== 'string') text = '';
    const lines = text.split(/\r?\n/);
    const entries = [];
    const map = {};
    const comments = [];
    const errors = [];

    let currentEntry = null;
    let inMultiline = false;
    let multilineQuote = null;
    let multilineBuffer = '';
    let multilineStartLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];

      if (inMultiline) {
        // We are inside a multiline quoted value
        const quoteIndex = line.indexOf(multilineQuote);
        if (quoteIndex !== -1 && (quoteIndex === 0 || line[quoteIndex - 1] !== '\\')) {
          // Closed multiline
          multilineBuffer += '\n' + line.slice(0, quoteIndex);
          const rawValue = multilineBuffer;
          const cleanedValue = multilineQuote === '"' ? unescapeDoubleQuoted(rawValue) : rawValue;
          
          if (currentEntry) {
            currentEntry.value = cleanedValue;
            currentEntry.type = inferType(cleanedValue);
            map[currentEntry.key] = cleanedValue;
          }
          inMultiline = false;
          multilineQuote = null;
          multilineBuffer = '';
          currentEntry = null;
        } else {
          multilineBuffer += '\n' + line;
        }
        continue;
      }

      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        entries.push({
          type: 'empty',
          line: lineNum,
          raw: line,
          key: '',
          value: ''
        });
        continue;
      }

      // Comment line
      if (trimmed.startsWith('#')) {
        const commentText = trimmed.slice(1).trim();
        comments.push({ line: lineNum, text: commentText });
        entries.push({
          type: 'comment',
          line: lineNum,
          raw: line,
          comment: commentText,
          key: '',
          value: ''
        });
        continue;
      }

      // Check key=value assignment
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) {
        // Maybe export KEY? or invalid line
        const exportMatch = line.match(/^\s*export\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        if (exportMatch) {
          const key = exportMatch[1];
          const entry = {
            key: key,
            value: '',
            raw: line,
            type: 'empty',
            line: lineNum,
            isExport: true
          };
          entries.push(entry);
          map[key] = '';
          continue;
        }

        errors.push({
          line: lineNum,
          message: 'Missing "=" delimiter in assignment',
          raw: line
        });
        entries.push({
          type: 'invalid',
          line: lineNum,
          raw: line,
          error: 'Missing "=" delimiter'
        });
        continue;
      }

      let rawKey = line.slice(0, eqIdx);
      let rawVal = line.slice(eqIdx + 1);

      // Check export prefix
      let isExport = false;
      const exportPrefixMatch = rawKey.match(/^\s*export\s+(.+)$/);
      if (exportPrefixMatch) {
        isExport = true;
        rawKey = exportPrefixMatch[1];
      }

      const key = rawKey.trim();

      // Check quotes in value
      const trimmedVal = rawVal.trim();
      let value = '';
      let inlineComment = null;
      let quoteType = null;

      if (trimmedVal.startsWith('"')) {
        // Double quote
        quoteType = 'double';
        const closingIdx = findClosingQuote(trimmedVal, 1, '"');
        if (closingIdx === -1) {
          // Multiline string started
          inMultiline = true;
          multilineQuote = '"';
          multilineBuffer = trimmedVal.slice(1);
          multilineStartLine = lineNum;

          currentEntry = {
            key,
            value: '',
            raw: line,
            line: lineNum,
            quoted: quoteType,
            isExport,
            isMultiline: true
          };
          entries.push(currentEntry);
          continue;
        } else {
          value = unescapeDoubleQuoted(trimmedVal.slice(1, closingIdx));
          const remainder = trimmedVal.slice(closingIdx + 1).trim();
          if (remainder.startsWith('#')) {
            inlineComment = remainder.slice(1).trim();
          }
        }
      } else if (trimmedVal.startsWith("'")) {
        // Single quote (literal)
        quoteType = 'single';
        const closingIdx = findClosingQuote(trimmedVal, 1, "'");
        if (closingIdx === -1) {
          inMultiline = true;
          multilineQuote = "'";
          multilineBuffer = trimmedVal.slice(1);
          multilineStartLine = lineNum;

          currentEntry = {
            key,
            value: '',
            raw: line,
            line: lineNum,
            quoted: quoteType,
            isExport,
            isMultiline: true
          };
          entries.push(currentEntry);
          continue;
        } else {
          value = trimmedVal.slice(1, closingIdx);
          const remainder = trimmedVal.slice(closingIdx + 1).trim();
          if (remainder.startsWith('#')) {
            inlineComment = remainder.slice(1).trim();
          }
        }
      } else {
        // Unquoted value: check for inline comments
        // Inline comments are preceded by whitespace and '#'
        const commentIdx = trimmedVal.search(/\s+#/);
        if (commentIdx !== -1) {
          value = trimmedVal.slice(0, commentIdx).trim();
          inlineComment = trimmedVal.slice(commentIdx).replace(/^\s+#\s*/, '');
        } else {
          value = trimmedVal;
        }
      }

      const entry = {
        key,
        value,
        raw: line,
        type: inferType(value),
        line: lineNum,
        quoted: quoteType,
        inlineComment,
        isExport
      };

      entries.push(entry);
      map[key] = value;
    }

    return {
      entries,
      map,
      comments,
      errors,
      totalKeys: Object.keys(map).length,
      linesCount: lines.length
    };
  }

  function findClosingQuote(str, startPos, quoteChar) {
    for (let i = startPos; i < str.length; i++) {
      if (str[i] === quoteChar && (i === 0 || str[i - 1] !== '\\')) {
        return i;
      }
    }
    return -1;
  }

  function unescapeDoubleQuoted(str) {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  function escapeDoubleQuoted(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  function serializeEnv(entries, options) {
    options = options || {};
    const lines = [];

    for (const entry of entries) {
      if (entry.type === 'empty') {
        lines.push('');
      } else if (entry.type === 'comment') {
        lines.push('# ' + (entry.comment || ''));
      } else if (entry.key) {
        let val = entry.value || '';
        let formattedVal = val;

        if (options.quoteAll || val.includes(' ') || val.includes('#') || val.includes('\n') || val.includes('"')) {
          formattedVal = `"${escapeDoubleQuoted(val)}"`;
        }

        const prefix = entry.isExport ? 'export ' : '';
        const line = `${prefix}${entry.key}=${formattedVal}${entry.inlineComment ? ' # ' + entry.inlineComment : ''}`;
        lines.push(line);
      }
    }

    return lines.join('\n');
  }

  return {
    parseEnv,
    serializeEnv,
    inferType,
    escapeDoubleQuoted,
    unescapeDoubleQuoted
  };
});
