#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC_EXTS = new Set([".md", ".mdx"]);
const CATEGORIES = ["hld", "lld", "adr", "prd"] as const;
type Category = (typeof CATEGORIES)[number];

interface DocSources {
  hld?: string | string[];
  lld?: string | string[];
  adr?: string | string[];
  prd?: string | string[];
}

interface RepoConfig {
  name: string;
  repo: string;
  docs: DocSources;
}

interface SyncConfig {
  repos: RepoConfig[];
}

interface GithubEntry {
  type: "file" | "dir";
  name: string;
  path: string;
  content?: string;
}

async function githubGet(endpoint: string, token: string | undefined): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/${endpoint}`, { headers });
  if (!res.ok) throw new Error(`failed to fetch ${endpoint} (${res.status})`);
  return res.json();
}

async function drainEntries(
  repo: string,
  repoName: string,
  entries: GithubEntry[],
  category: Category,
  basePath: string,
  token: string | undefined,
): Promise<void> {
  for (const entry of entries) {
    if (entry.type === "dir") {
      const children = (await githubGet(
        `repos/${repo}/contents/${entry.path}`,
        token,
      )) as GithubEntry[];
      await drainEntries(repo, repoName, children, category, basePath, token);
    } else if (DOC_EXTS.has(extname(entry.name))) {
      let raw: string;
      if (entry.content) {
        raw = entry.content;
      } else {
        const file = (await githubGet(
          `repos/${repo}/contents/${entry.path}`,
          token,
        )) as GithubEntry;
        raw = file.content!;
      }
      const content = Buffer.from(raw, "base64").toString("utf-8");
      const rel = entry.path.slice(basePath.length).replace(/^\//, "");
      const dest = join(ROOT, category, repoName, rel);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content, "utf-8");
      console.log(`  ${category}/${repoName}/${rel}`);
    }
  }
}

async function syncPath(
  repo: string,
  repoName: string,
  srcPath: string,
  category: Category,
  token: string | undefined,
): Promise<void> {
  const result = await githubGet(`repos/${repo}/contents/${srcPath}`, token);
  const isDir = Array.isArray(result);
  const basePath = isDir ? srcPath : dirname(srcPath);
  const entries = isDir ? (result as GithubEntry[]) : [result as GithubEntry];
  await drainEntries(repo, repoName, entries, category, basePath, token);
}

async function main() {
  const config = yaml.load(
    readFileSync(join(ROOT, "sync.config.yaml"), "utf-8"),
  ) as SyncConfig;

  const token = process.env.GITHUB_TOKEN;
  if (!token) console.warn("GITHUB_TOKEN not set — unauthenticated requests apply (60/hr)");

  for (const repoConfig of config.repos) {
    console.log(`\n${repoConfig.name} (${repoConfig.repo})`);
    for (const category of CATEGORIES) {
      const paths = repoConfig.docs[category];
      if (!paths) continue;
      for (const srcPath of ([] as string[]).concat(paths)) {
        await syncPath(repoConfig.repo, repoConfig.name, srcPath, category, token);
      }
    }
  }

  console.log("\ndone");
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
