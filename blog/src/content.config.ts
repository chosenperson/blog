import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

const ROOT = path.resolve(import.meta.dirname, "../..");

const gameDiary = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "../gaming" }),
  schema: z.object({
    id: z.number(),
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    type: z.literal("game-diary"),
    game: z.object({
      name: z.string(),
      cnName: z.string(),
      steamAppId: z.number().optional(),
      releaseDate: z.string().optional(),
      developers: z.array(z.string()).optional(),
      publishers: z.array(z.string()).optional(),
      genres: z.array(z.string()).optional(),
      platforms: z.array(z.string()).optional(),
      hltb: z.object({
        main: z.number().optional(),
        mainExtra: z.number().optional(),
        completionist: z.number().optional(),
      }).optional(),
      mcScore: z.number().optional(),
    }),
    assets: z
      .object({
        cover: z.string().optional(),
        hero: z.string().optional(),
      })
      .optional(),
    myRecord: z.object({
      status: z.enum(["在玩", "已通关", "弃坑", "搁置", "想玩"]),
      platform: z.string(),
      playtimeHours: z.number().optional(),
      score: z.number().min(0).max(10),
      recommend: z.boolean(),
      logCount: z.number().optional(),
      firstPlayed: z.coerce.date().optional(),
      lastPlayed: z.coerce.date().optional(),
    }),
    tags: z.array(z.string()),
  }),
});

const WIKI_DIRS = [
  "study",
  "work",
  "环境配置",
  "日常问题",
  "plan",
  "day",
  "projects",
];

function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

const wiki = defineCollection({
  loader: {
    name: "wiki-loader",
    load: async ({ store, logger }) => {
      const files: string[] = [];
      for (const dir of WIKI_DIRS) {
        files.push(...walkDir(path.join(ROOT, dir)));
      }

      for (const filePath of files) {
        const id = path.relative(ROOT, filePath).replace(/\.md$/, "").replace(/\\/g, "/");
        const raw = fs.readFileSync(filePath, "utf-8");
        let data: Record<string, any> = {};
        let body = raw;
        try {
          const parsed = matter(raw);
          data = parsed.data || {};
          body = parsed.content || "";
          if (data.title && typeof data.title === "object") {
            data.title = String(data.title);
          }
          if (typeof data.tags === "string") {
            data.tags = data.tags
              .replace(/^\[/, "")
              .replace(/\]$/, "")
              .split(",")
              .map((s: string) => s.trim().replace(/^"|"$/g, ""))
              .filter(Boolean);
          }
        } catch {
          logger.warn(`Skipping ${id}: YAML parse error`);
          data = { title: path.basename(filePath, ".md") };
        }

        const html = await marked(body);
        store.set({ id, data, rendered: { html } });
      }
      logger.info(`Loaded ${files.length} wiki entries`);
    },
  },
  schema: z.object({
    id: z.coerce.number().optional(),
    title: z.string().optional(),
    path: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
  }),
});

export const collections = { "game-diary": gameDiary, wiki };
