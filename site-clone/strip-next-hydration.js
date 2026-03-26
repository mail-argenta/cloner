#!/usr/bin/env node
/**
 * Strips Next.js / React hydration from a static exported listing HTML file:
 * - Removes RSC payload scripts (self.__next_f, webpack, $RC) between <body> and <header>
 * - Removes all /_next/static/chunks/*.js script tags from <head>
 * - Removes Google Maps loader tied to Next callback
 * - Removes Live Reload logger, next-route-announcer, rht toaster
 *
 * Usage:
 *   node strip-next-hydration.js
 *   node strip-next-hydration.js destinations/your-page.html
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(
  __dirname,
  'destinations',
  '6113e18bb93f1d002d529c18.html',
);

const HEADER_MARK = '<header class="z-[100] fixed top-0 left-0 w-full">';

function stripHtml(html) {
  const bodyOpen = html.indexOf('<body');
  const bodyTagEnd = bodyOpen === -1 ? -1 : html.indexOf('>', bodyOpen) + 1;
  const headerStart = html.indexOf(HEADER_MARK);

  if (bodyOpen === -1 || bodyTagEnd < 2 || headerStart === -1 || headerStart < bodyTagEnd) {
    throw new Error(
      'Could not find <body> … <header> boundary. File may already be stripped or markup changed.',
    );
  }

  let out = html.slice(0, bodyTagEnd) + '\n    ' + html.slice(headerStart);

  out = out.replace(
    /<script[\s\S]*?src=["']\/_next\/static\/[^"']+["'][\s\S]*?<\/script>\s*/g,
    '',
  );

  out = out.replace(/<script[^>]*id="__googleMapsScriptId"[\s\S]*?<\/script>\s*/g, '');

  out = out.replace(/<script[^>]*cdn\.lr-in-prod\.com[^>]*><\/script>\s*/gi, '');

  out = out.replace(/<next-route-announcer[^>]*><\/next-route-announcer>\s*/g, '');
  out = out.replace(
    /<div[^>]*data-rht-toaster[^>]*style="[^"]*"[^>]*><\/div>\s*/g,
    '',
  );

  return out;
}

function main() {
  const target = path.resolve(process.argv[2] || DEFAULT_FILE);
  if (!fs.existsSync(target)) {
    console.error('File not found:', target);
    process.exit(1);
  }

  const html = fs.readFileSync(target, 'utf8');
  let out;
  try {
    out = stripHtml(html);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  fs.writeFileSync(target, out);
  console.log('Stripped Next hydration:', target);
}

main();
