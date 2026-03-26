/**
 * Extract listing JSON from a saved Stay Awhile / Next.js listing HTML export.
 *
 * The stripped page (6113e18bb93f1d002d529c18.html) has no embedded "listings" payload.
 * The full save (6113e18bb93f1d002d529c18-2.html) includes Flight/RSC data with
 * "listings":[{...}] plus deferred chunks for publicDescription.space ($e7) and .notes ($e8).
 *
 * Usage:
 *   node extract_data.js
 *   node extract_data.js path/to/page.html
 *   node extract_data.js path/to/page.html path/to/out.json
 */

const fs = require('fs');
const path = require('path');

const defaultInput = path.join(
  __dirname,
  'destinations',
  '6113e18bb93f1d002d529c18-2.html',
);
const defaultOutput = path.join(__dirname, 'property_data.json');

const inputPath = path.resolve(process.argv[2] || defaultInput);
const outputPath = path.resolve(process.argv[3] || defaultOutput);

/**
 * Find the first '[' at or after anchor, then match the closing ']' at depth 0,
 * ignoring brackets inside JSON double-quoted strings (with backslash escapes).
 */
function extractBalancedArrayFrom(html, anchor) {
  const anchorIdx = html.indexOf(anchor);
  if (anchorIdx === -1) return null;
  const start = html.indexOf('[', anchorIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const c = html[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Next.js Flight: publicDescription.space / notes may be "$e7", "$e8".
 * The real text is in the next self.__next_f.push after the marker row
 * self.__next_f.push([1, "e7:Tfda,"]);
 */
function extractFlightDeferredString(html, refId) {
  const marker = `self.__next_f.push([1, "${refId}:`;
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const nextPush = html.indexOf('self.__next_f.push', start + marker.length);
  if (nextPush === -1) return null;

  const after1 = html.indexOf('1,', nextPush);
  if (after1 === -1) return null;

  const quoteStart = html.indexOf('"', after1);
  if (quoteStart === -1 || html[quoteStart] !== '"') return null;

  let i = quoteStart + 1;
  let out = '';
  while (i < html.length) {
    const c = html[i];
    if (c === '\\') {
      i++;
      if (i >= html.length) break;
      const n = html[i++];
      switch (n) {
        case 'n':
          out += '\n';
          break;
        case 't':
          out += '\t';
          break;
        case 'r':
          out += '\r';
          break;
        case '"':
          out += '"';
          break;
        case "'":
          out += "'";
          break;
        case '\\':
          out += '\\';
          break;
        case 'u':
          if (i + 3 < html.length) {
            const hex = html.slice(i, i + 4);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              out += String.fromCharCode(parseInt(hex, 16));
              i += 4;
              break;
            }
          }
          out += '\\u';
          break;
        default:
          out += '\\' + n;
      }
      continue;
    }
    if (c === '"') return out;
    out += c;
    i++;
  }
  return null;
}

function normalizeJsonArrayString(raw) {
  let s = raw;
  s = s.replace(/\\'/g, "'");
  s = s.replace(/\\\\"/g, '\\"');
  return s;
}

function resolveRef(html, val) {
  if (typeof val !== 'string') return val;
  const m = val.match(/^\$(e\d+)$/);
  if (!m) return val;
  const text = extractFlightDeferredString(html, m[1]);
  if (text != null) return text;
  const refId = m[1];
  const refRegex = new RegExp(`"${refId}:([\\s\\S]*?)"`, 'm');
  const refMatch = html.match(refRegex);
  if (refMatch && refMatch[1]) {
    return refMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
  }
  return val;
}

function main() {
  let htmlContent;
  try {
    htmlContent = fs.readFileSync(inputPath, 'utf8');
  } catch (err) {
    console.error('Error reading file:', err.message);
    process.exit(1);
  }

  const listingsStr = extractBalancedArrayFrom(htmlContent, '"listings":');

  if (!listingsStr) {
    console.error(
      'Could not find a "listings" JSON array in this HTML. Use a full page save that includes the Next.js Flight payload (e.g. 6113e18bb93f1d002d529c18-2.html), not the stripped clone.',
    );
    process.exit(1);
  }

  let listingsData;
  try {
    listingsData = JSON.parse(normalizeJsonArrayString(listingsStr));
  } catch (err) {
    console.error('JSON Parse Error:', err.message);
    const posMatch = err.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const snippet = listingsStr.substring(
        Math.max(0, pos - 50),
        Math.min(listingsStr.length, pos + 50),
      );
      console.log('Context around error position:');
      console.log('...');
      console.log(snippet);
      console.log(' '.repeat(Math.min(pos, 50) + 3) + '^');
    }
    process.exit(1);
  }

  const property = listingsData[0] || {};

  if (property.publicDescription) {
    const pd = property.publicDescription;
    for (const key of Object.keys(pd)) {
      pd[key] = resolveRef(htmlContent, pd[key]);
    }
  }

  const testimonialsStr = extractBalancedArrayFrom(
    htmlContent,
    '"testimonials":',
  );
  if (testimonialsStr) {
    try {
      property.testimonials = JSON.parse(
        normalizeJsonArrayString(testimonialsStr),
      );
    } catch {
      property.testimonials = [];
    }
  } else {
    property.testimonials = [];
  }

  const fbMatch = htmlContent.match(
    /"fallbackImage":"(https:\/\/[^"\\]+)"/,
  );
  if (fbMatch) {
    property.testimonialFallbackImage = fbMatch[1];
  }

  fs.writeFileSync(outputPath, JSON.stringify(property, null, 2));

  console.log(`Wrote ${outputPath}`);
  console.log(`Title: ${property.title || '(none)'}`);
  console.log(
    `Testimonials: ${Array.isArray(property.testimonials) ? property.testimonials.length : 0}`,
  );
}

main();
