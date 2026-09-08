#!/usr/bin/env node
/**
 * check-user-path-map-freshness.mjs — Report whether
 * design/system/user-path-map.html is still current with respect to the
 * prototype pages and the generated screen inventory.
 *
 * Usage:
 *   node scripts/check-user-path-map-freshness.mjs           # check this repository
 *   node scripts/check-user-path-map-freshness.mjs <root>    # check another checkout
 *   node scripts/check-user-path-map-freshness.mjs --help    # print this usage
 *
 * IMPORTANT — Stage 1 scope (GitHub issue #665):
 *   The production freshness verdict depends on the authoritative source
 *   metadata header that GitHub issue #645 delivers together with the path map
 *   itself. Until that header exists, this command only resolves its arguments
 *   and repository root, then fails closed with exit 2. It never guesses the
 *   recorded revision from HEAD, file mtimes or a fixed date, and it never
 *   reports fresh — "cannot be determined" is not "current".
 *
 * Exit codes:
 *   0  --help, or (once issue #645 lands) a proven-fresh path map
 *   1  a proven-stale path map
 *   2  usage or configuration failure, including any undecidable state
 *
 * The command is read-only: it never writes to the repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PATH_MAP = 'design/system/user-path-map.html';

const EXIT_OK = 0;
const EXIT_CONFIG = 2;

const USAGE = [
  'usage: node scripts/check-user-path-map-freshness.mjs [--help] [repository-root]',
  '',
  `Checks whether ${PATH_MAP} is still current with respect to`,
  'design/prototype/pages/** and design/system/screen-inventory.md.',
  '',
  'The production verdict is not available yet: it depends on the authoritative',
  'source metadata header delivered by GitHub issue #645. Until that header',
  'exists, every real invocation fails closed with exit 2 rather than claiming',
  'the path map is current.',
  '',
  'Exit codes:',
  '  0  --help, or (after issue #645) a proven-fresh path map',
  '  1  a proven-stale path map',
  '  2  usage or configuration failure, including any undecidable state',
].join('\n');

function fail(rule, subject, message) {
  console.error(`ERROR [${rule}] ${subject}: ${message}`);
  return EXIT_CONFIG;
}

function failUsage(message) {
  const status = fail('PATH_MAP_USAGE', 'scripts/check-user-path-map-freshness.mjs', message);
  console.error(USAGE);
  return status;
}

function main(argv) {
  const positional = [];

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return EXIT_OK;
    }
    if (arg.startsWith('-')) {
      return failUsage(`unsupported argument: ${arg}`);
    }
    positional.push(arg);
  }

  if (positional.length > 1) {
    return failUsage(`expected at most one repository root, got ${positional.length}`);
  }

  const requested = positional.length === 1 ? positional[0] : DEFAULT_ROOT;
  if (requested.trim() === '') {
    return fail('PATH_MAP_ROOT', '(empty)', 'repository root cannot be resolved from an empty argument');
  }

  const root = path.resolve(requested);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return fail('PATH_MAP_ROOT', requested, 'repository root cannot be resolved to an existing directory');
  }

  if (!fs.existsSync(path.join(root, PATH_MAP))) {
    return fail(
      'PATH_MAP_ARTIFACT_MISSING',
      PATH_MAP,
      'the path map is missing, so freshness cannot be determined; GitHub issue #645 owns this artifact',
    );
  }

  return fail(
    'PATH_MAP_AUTHORITY_UNSETTLED',
    PATH_MAP,
    'the authoritative source metadata contract from GitHub issue #645 is not settled, so freshness cannot be determined',
  );
}

process.exit(main(process.argv.slice(2)));
