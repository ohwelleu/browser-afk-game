/**
 * Turn a simulator results JSON file into a self-contained `report.html`.
 *
 *   node --experimental-strip-types scripts/sim/report.ts <results.json> [--out report.html]
 *
 * Default output: `report.html` next to the input file.
 *
 * The sim CLI (`npm run sim -- --report`) calls `writeReport` after a run:
 *
 *   if (args.report) writeReport(toReportInput(result), join(outDir, 'report.html'));
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseReportInput, type ReportInput } from '../../src/sim/chart/data.ts';
import { buildReport } from '../../src/sim/report-html.ts';

/** Build the report and write it. Returns the path. */
export function writeReport(input: ReportInput, path: string): string {
  writeFileSync(path, buildReport(parseReportInput(input)));
  return path;
}

function main(args: string[]): number {
  let input: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i];
    else if (args[i].startsWith('--out=')) out = args[i].slice(6);
    else if (!args[i].startsWith('--') && !input) input = args[i];
    else throw new Error(`unknown argument "${args[i]}"`);
  }
  if (!input) {
    console.error('usage: scripts/sim/report.ts <results.json> [--out report.html]');
    return 1;
  }
  const json = JSON.parse(readFileSync(input, 'utf8')) as unknown;
  const path = writeReport(json as ReportInput, out ?? join(dirname(input), 'report.html'));
  console.log(path);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`report: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
