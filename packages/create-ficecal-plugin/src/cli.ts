#!/usr/bin/env node
// ─── create-ficecal-plugin CLI ────────────────────────────────────────────────
//
// Usage:
//   npx create-ficecal-plugin
//   npx create-ficecal-plugin --name @acme/ficecal-plugin-datadog --type billing
//
// Non-interactive mode (all flags provided):
//   npx create-ficecal-plugin \
//     --name @acme/ficecal-plugin-foo \
//     --display-name "Foo Plugin" \
//     --description "Does foo" \
//     --author "Acme" \
//     --license MIT \
//     --type billing \
//     --out-dir ./plugins

import { parseArgs } from "node:util";
import { join, resolve } from "node:path";
import { scaffold } from "./scaffolder.js";
import type { ScaffoldOptions, PluginType } from "./types.js";

// ─── Argument parsing ─────────────────────────────────────────────────────────

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    name:           { type: "string" },
    "display-name": { type: "string" },
    description:    { type: "string" },
    author:         { type: "string" },
    license:        { type: "string", default: "MIT" },
    type:           { type: "string", default: "billing" },
    "out-dir":      { type: "string", default: "." },
    help:           { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`
create-ficecal-plugin — scaffold a FiceCal v2 community plugin

Usage:
  npx create-ficecal-plugin [options]

Options:
  --name           npm package name (e.g. @acme/ficecal-plugin-foo)  [required]
  --display-name   Human-readable name                                [required]
  --description    Short description                                  [required]
  --author         Author name or organisation                        [required]
  --license        SPDX license identifier (default: MIT)
  --type           Plugin type: billing | theme | mcp | full          (default: billing)
  --out-dir        Output directory (default: current directory)
  --help           Show this help message

Examples:
  npx create-ficecal-plugin --name @acme/ficecal-plugin-datadog --type billing \\
    --display-name "Datadog Plugin" --description "Datadog cost adapter" --author "Acme"

  npx create-ficecal-plugin --type full --name @me/ficecal-plugin-full \\
    --display-name "Full Plugin" --description "All contribution types" --author "Me"
`);
  process.exit(0);
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TYPES: PluginType[] = ["billing", "theme", "mcp", "full"];

function required(flag: string, value: string | undefined): string {
  if (!value) {
    console.error(`Error: --${flag} is required`);
    process.exit(1);
  }
  return value;
}

const packageName  = required("name", values.name);
const displayName  = required("display-name", values["display-name"]);
const description  = required("description", values.description);
const author       = required("author", values.author);
const license      = values.license ?? "MIT";
const pluginType   = (values.type ?? "billing") as PluginType;
const outDirRaw    = values["out-dir"] ?? ".";

if (!VALID_TYPES.includes(pluginType)) {
  console.error(`Error: --type must be one of: ${VALID_TYPES.join(", ")}`);
  process.exit(1);
}

const outDir = resolve(process.cwd(), outDirRaw);

// ─── Scaffold ─────────────────────────────────────────────────────────────────

const opts: ScaffoldOptions = {
  packageName,
  displayName,
  description,
  author,
  license,
  pluginType,
  outDir,
};

console.log(`\n✦ create-ficecal-plugin\n`);
console.log(`  Package  : ${packageName}`);
console.log(`  Type     : ${pluginType}`);
console.log(`  Out dir  : ${join(outDir, packageName.includes("/") ? packageName.split("/")[1]! : packageName)}\n`);

scaffold(opts)
  .then((output) => {
    console.log(`✓ Created ${output.files.length} files in ${output.dirName}/\n`);
    for (const file of output.files) {
      console.log(`  ${file.path}`);
    }
    console.log(`\nNext steps:\n`);
    console.log(`  cd ${output.dirName}`);
    console.log(`  pnpm install`);
    console.log(`  pnpm typecheck`);
    console.log(`  pnpm test\n`);
  })
  .catch((err: unknown) => {
    console.error("Scaffold failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
