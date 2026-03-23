// ─── create-ficecal-plugin template tests ────────────────────────────────────
//
// Tests cover the pure template functions (no file I/O) and the scaffold
// file builder. Verifies file list, content correctness, and pluginId derivation.

import { describe, it, expect } from "vitest";
import {
  pluginId,
  dirName,
  packageJsonTemplate,
  tsconfigTemplate,
  readmeTemplate,
  indexTemplate,
  billingAdapterTemplate,
  themeTemplate,
  mcpToolTemplate,
  testTemplate,
  buildScaffoldFiles,
} from "../src/templates.js";
import type { ScaffoldOptions } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_OPTS: ScaffoldOptions = {
  packageName: "@acme/ficecal-plugin-datadog",
  displayName: "Datadog Observability Plugin",
  description: "Integrates Datadog APM cost data with FiceCal",
  author: "Acme Corp",
  license: "MIT",
  pluginType: "billing",
  outDir: "/tmp/ficecal-plugins",
};

const FULL_OPTS: ScaffoldOptions = { ...BASE_OPTS, pluginType: "full" };
const THEME_OPTS: ScaffoldOptions = { ...BASE_OPTS, pluginType: "theme" };
const MCP_OPTS: ScaffoldOptions = { ...BASE_OPTS, pluginType: "mcp" };
const UNSCOPED_OPTS: ScaffoldOptions = {
  ...BASE_OPTS,
  packageName: "ficecal-plugin-simple",
};

// ─── pluginId ──────────────────────────────────────────────────────────────────

describe("pluginId", () => {
  it("converts scoped package to camelCase", () => {
    expect(pluginId(BASE_OPTS)).toBe("ficecalPluginDatadog");
  });

  it("converts unscoped package to camelCase", () => {
    expect(pluginId(UNSCOPED_OPTS)).toBe("ficecalPluginSimple");
  });

  it("handles single-segment package", () => {
    expect(pluginId({ ...BASE_OPTS, packageName: "foo" })).toBe("foo");
  });
});

// ─── dirName ──────────────────────────────────────────────────────────────────

describe("dirName", () => {
  it("returns last segment for scoped package", () => {
    expect(dirName("@acme/ficecal-plugin-datadog")).toBe("ficecal-plugin-datadog");
  });

  it("returns name unchanged for unscoped package", () => {
    expect(dirName("ficecal-plugin-simple")).toBe("ficecal-plugin-simple");
  });
});

// ─── packageJsonTemplate ──────────────────────────────────────────────────────

describe("packageJsonTemplate", () => {
  it("produces valid JSON", () => {
    const json = packageJsonTemplate(BASE_OPTS);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("has correct name", () => {
    const pkg = JSON.parse(packageJsonTemplate(BASE_OPTS));
    expect(pkg.name).toBe(BASE_OPTS.packageName);
  });

  it("has correct description", () => {
    const pkg = JSON.parse(packageJsonTemplate(BASE_OPTS));
    expect(pkg.description).toBe(BASE_OPTS.description);
  });

  it("has author and license", () => {
    const pkg = JSON.parse(packageJsonTemplate(BASE_OPTS));
    expect(pkg.author).toBe(BASE_OPTS.author);
    expect(pkg.license).toBe(BASE_OPTS.license);
  });

  it("includes @ficecal/plugin-api as peer dependency", () => {
    const pkg = JSON.parse(packageJsonTemplate(BASE_OPTS));
    expect(pkg.peerDependencies["@ficecal/plugin-api"]).toBeDefined();
  });

  it("has build and test scripts", () => {
    const pkg = JSON.parse(packageJsonTemplate(BASE_OPTS));
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  it("is type: module", () => {
    const pkg = JSON.parse(packageJsonTemplate(BASE_OPTS));
    expect(pkg.type).toBe("module");
  });
});

// ─── tsconfigTemplate ─────────────────────────────────────────────────────────

describe("tsconfigTemplate", () => {
  it("produces valid JSON", () => {
    expect(() => JSON.parse(tsconfigTemplate())).not.toThrow();
  });

  it("enables strict mode", () => {
    const tsconf = JSON.parse(tsconfigTemplate());
    expect(tsconf.compilerOptions.strict).toBe(true);
  });

  it("uses ESNext module", () => {
    const tsconf = JSON.parse(tsconfigTemplate());
    expect(tsconf.compilerOptions.module).toBe("ESNext");
  });
});

// ─── readmeTemplate ───────────────────────────────────────────────────────────

describe("readmeTemplate", () => {
  it("starts with the display name as h1", () => {
    const md = readmeTemplate(BASE_OPTS);
    expect(md).toMatch(/^# Datadog Observability Plugin/);
  });

  it("includes the description", () => {
    const md = readmeTemplate(BASE_OPTS);
    expect(md).toContain(BASE_OPTS.description);
  });

  it("includes the package name in install instructions", () => {
    const md = readmeTemplate(BASE_OPTS);
    expect(md).toContain(BASE_OPTS.packageName);
  });

  it("includes the license", () => {
    const md = readmeTemplate(BASE_OPTS);
    expect(md).toContain(BASE_OPTS.license);
  });
});

// ─── indexTemplate ────────────────────────────────────────────────────────────

describe("indexTemplate — billing type", () => {
  it("imports FicecalPlugin", () => {
    expect(indexTemplate(BASE_OPTS)).toContain("FicecalPlugin");
  });

  it("imports billingAdapterContribution for billing type", () => {
    expect(indexTemplate(BASE_OPTS)).toContain("billing-adapter.js");
  });

  it("does not import theme or mcp for billing type", () => {
    const content = indexTemplate(BASE_OPTS);
    expect(content).not.toContain("theme.js");
    expect(content).not.toContain("mcp-tool.js");
  });

  it("exports plugin with correct id", () => {
    expect(indexTemplate(BASE_OPTS)).toContain(`"${BASE_OPTS.packageName}"`);
  });

  it("exports default plugin", () => {
    expect(indexTemplate(BASE_OPTS)).toContain("export default plugin");
  });
});

describe("indexTemplate — full type", () => {
  it("imports all three contribution files", () => {
    const content = indexTemplate(FULL_OPTS);
    expect(content).toContain("billing-adapter.js");
    expect(content).toContain("theme.js");
    expect(content).toContain("mcp-tool.js");
  });

  it("includes all three in contributions", () => {
    const content = indexTemplate(FULL_OPTS);
    expect(content).toContain("billingAdapters");
    expect(content).toContain("themes");
    expect(content).toContain("mcpTools");
  });
});

describe("indexTemplate — theme type", () => {
  it("imports only theme", () => {
    const content = indexTemplate(THEME_OPTS);
    expect(content).toContain("theme.js");
    expect(content).not.toContain("billing-adapter.js");
    expect(content).not.toContain("mcp-tool.js");
  });
});

describe("indexTemplate — mcp type", () => {
  it("imports only mcp-tool", () => {
    const content = indexTemplate(MCP_OPTS);
    expect(content).toContain("mcp-tool.js");
    expect(content).not.toContain("billing-adapter.js");
    expect(content).not.toContain("theme.js");
  });
});

// ─── billingAdapterTemplate ───────────────────────────────────────────────────

describe("billingAdapterTemplate", () => {
  it("exports billingAdapterContribution", () => {
    expect(billingAdapterTemplate(BASE_OPTS)).toContain("billingAdapterContribution");
  });

  it("imports BillingAdapterContribution type", () => {
    expect(billingAdapterTemplate(BASE_OPTS)).toContain("BillingAdapterContribution");
  });

  it("has a stub load() function", () => {
    expect(billingAdapterTemplate(BASE_OPTS)).toContain("async load(");
  });

  it("has ingestMode: deterministic", () => {
    expect(billingAdapterTemplate(BASE_OPTS)).toContain('"deterministic"');
  });
});

// ─── themeTemplate ────────────────────────────────────────────────────────────

describe("themeTemplate", () => {
  it("exports themeContribution", () => {
    expect(themeTemplate(BASE_OPTS)).toContain("themeContribution");
  });

  it("imports ThemeContribution type", () => {
    expect(themeTemplate(BASE_OPTS)).toContain("ThemeContribution");
  });

  it("has color tokens", () => {
    expect(themeTemplate(BASE_OPTS)).toContain("--color-primary");
  });

  it("has a unique theme id", () => {
    const content = themeTemplate(BASE_OPTS);
    expect(content).toContain("-theme");
  });
});

// ─── mcpToolTemplate ──────────────────────────────────────────────────────────

describe("mcpToolTemplate", () => {
  it("exports mcpToolContribution", () => {
    expect(mcpToolTemplate(BASE_OPTS)).toContain("mcpToolContribution");
  });

  it("imports McpToolContribution type", () => {
    expect(mcpToolTemplate(BASE_OPTS)).toContain("McpToolContribution");
  });

  it("has a handler function", () => {
    expect(mcpToolTemplate(BASE_OPTS)).toContain("async (envelope)");
  });

  it("includes stub warning in warnings array", () => {
    expect(mcpToolTemplate(BASE_OPTS)).toContain("Stub result");
  });
});

// ─── testTemplate ─────────────────────────────────────────────────────────────

describe("testTemplate", () => {
  it("imports plugin from src/index.js", () => {
    expect(testTemplate(BASE_OPTS)).toContain("../src/index.js");
  });

  it("has describe block with package name", () => {
    expect(testTemplate(BASE_OPTS)).toContain(BASE_OPTS.packageName);
  });

  it("tests plugin.id", () => {
    expect(testTemplate(BASE_OPTS)).toContain("plugin.id");
  });
});

// ─── buildScaffoldFiles ───────────────────────────────────────────────────────

describe("buildScaffoldFiles — billing", () => {
  const files = buildScaffoldFiles(BASE_OPTS);
  const paths = files.map((f) => f.path);

  it("includes package.json", () => {
    expect(paths).toContain("package.json");
  });

  it("includes tsconfig.json", () => {
    expect(paths).toContain("tsconfig.json");
  });

  it("includes README.md", () => {
    expect(paths).toContain("README.md");
  });

  it("includes src/index.ts", () => {
    expect(paths).toContain("src/index.ts");
  });

  it("includes tests/plugin.test.ts", () => {
    expect(paths).toContain("tests/plugin.test.ts");
  });

  it("includes src/billing-adapter.ts for billing type", () => {
    expect(paths).toContain("src/billing-adapter.ts");
  });

  it("does NOT include theme or mcp files for billing type", () => {
    expect(paths).not.toContain("src/theme.ts");
    expect(paths).not.toContain("src/mcp-tool.ts");
  });

  it("returns 6 files for billing type", () => {
    expect(files).toHaveLength(6);
  });

  it("all files have non-empty content", () => {
    for (const file of files) {
      expect(file.content.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("buildScaffoldFiles — full", () => {
  const files = buildScaffoldFiles(FULL_OPTS);
  const paths = files.map((f) => f.path);

  it("includes all contribution files", () => {
    expect(paths).toContain("src/billing-adapter.ts");
    expect(paths).toContain("src/theme.ts");
    expect(paths).toContain("src/mcp-tool.ts");
  });

  it("returns 8 files for full type", () => {
    // package.json, tsconfig.json, README.md, src/index.ts, tests/plugin.test.ts
    // + billing-adapter.ts + theme.ts + mcp-tool.ts
    expect(files).toHaveLength(8);
  });
});

describe("buildScaffoldFiles — theme", () => {
  const files = buildScaffoldFiles(THEME_OPTS);
  const paths = files.map((f) => f.path);

  it("includes theme.ts only", () => {
    expect(paths).toContain("src/theme.ts");
    expect(paths).not.toContain("src/billing-adapter.ts");
    expect(paths).not.toContain("src/mcp-tool.ts");
  });

  it("returns 6 files", () => {
    expect(files).toHaveLength(6);
  });
});

describe("buildScaffoldFiles — mcp", () => {
  const files = buildScaffoldFiles(MCP_OPTS);
  const paths = files.map((f) => f.path);

  it("includes mcp-tool.ts only", () => {
    expect(paths).toContain("src/mcp-tool.ts");
    expect(paths).not.toContain("src/billing-adapter.ts");
    expect(paths).not.toContain("src/theme.ts");
  });

  it("returns 6 files", () => {
    expect(files).toHaveLength(6);
  });
});

describe("buildScaffoldFiles — unscoped package name", () => {
  it("works with unscoped package names", () => {
    const files = buildScaffoldFiles(UNSCOPED_OPTS);
    expect(files.length).toBeGreaterThan(0);
  });
});
