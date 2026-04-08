import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import texturePacker from "../src/index";

type MockWatcher = EventEmitter & {
  add: (value: string) => void;
};

const cleanupPaths: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();

  for (const targetPath of cleanupPaths.splice(0)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
});

function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vite-texture-packer-"));
  cleanupPaths.push(tempDir);
  return tempDir;
}

async function createImage(filePath: string, width: number, height: number, red: number) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: {
        r: red,
        g: 30,
        b: 50,
        alpha: 1,
      },
    },
  })
    .png()
    .toFile(filePath);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function createPluginPaths() {
  const rootDir = createTempDir();

  return {
    rootDir,
    inputDir: path.join(rootDir, "input"),
    outputDir: path.join(rootDir, "output"),
    cacheDir: path.join(rootDir, ".vite"),
    cacheFile: path.join(rootDir, ".vite", "texture-packer.json"),
  };
}

async function runBuild(plugin: ReturnType<typeof texturePacker>, cacheDir: string) {
  plugin.configResolved?.({
    cacheDir,
  } as never);

  await plugin.buildStart?.call({} as never);
}

function createWatcher(): MockWatcher {
  const watcher = new EventEmitter() as MockWatcher;
  watcher.add = () => undefined;
  return watcher;
}

function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("texturePacker", () => {
  it("packs images into Phaser metadata and mirrors the package version", async () => {
    const paths = createPluginPaths();
    const atlasDir = path.join(paths.inputDir, "ui");

    await createImage(path.join(atlasDir, "button.png"), 20, 14, 220);
    await createImage(path.join(atlasDir, "panel.png"), 18, 12, 180);

    const plugin = texturePacker({
      inputDir: paths.inputDir,
      outputDir: paths.outputDir,
      cacheFile: paths.cacheFile,
    });

    await runBuild(plugin, paths.cacheDir);

    const atlasJsonPath = path.join(paths.outputDir, "ui", "ui.json");
    const atlasPngPath = path.join(paths.outputDir, "ui", "ui.png");
    const atlasJson = readJson<{
      textures: Array<{ frames: Array<{ filename: string }> }>;
      meta: { version: string };
    }>(atlasJsonPath);
    const packageJson = readJson<{ version: string }>(path.resolve("package.json"));

    expect(fs.existsSync(atlasPngPath)).toBe(true);
    expect(atlasJson.textures[0]?.frames.map((frame) => frame.filename)).toEqual([
      "button",
      "panel",
    ]);
    expect(atlasJson.meta.version).toBe(packageJson.version);

    const cacheJson = readJson<Record<string, string>>(paths.cacheFile);
    expect(cacheJson.ui).toBeTypeOf("string");
  });

  it("reuses cache and removes stale artifacts when a directory becomes empty", async () => {
    const paths = createPluginPaths();
    const atlasDir = path.join(paths.inputDir, "icons");
    const sourceImage = path.join(atlasDir, "star.png");

    await createImage(sourceImage, 16, 16, 255);

    const plugin = texturePacker({
      inputDir: paths.inputDir,
      outputDir: paths.outputDir,
      cacheFile: paths.cacheFile,
    });

    await runBuild(plugin, paths.cacheDir);

    const atlasJsonPath = path.join(paths.outputDir, "icons", "icons.json");
    const initialStat = fs.statSync(atlasJsonPath).mtimeMs;

    await waitFor(50);
    await runBuild(plugin, paths.cacheDir);

    expect(fs.statSync(atlasJsonPath).mtimeMs).toBe(initialStat);

    fs.rmSync(sourceImage, { force: true });

    await runBuild(plugin, paths.cacheDir);

    expect(fs.existsSync(atlasJsonPath)).toBe(false);
    expect(fs.existsSync(path.join(paths.outputDir, "icons", "icons.png"))).toBe(false);

    const cacheJson = readJson<Record<string, string>>(paths.cacheFile);
    expect(cacheJson.icons).toBeUndefined();
  });

  it("batches burst watcher events into a single repack", async () => {
    const paths = createPluginPaths();
    const atlasDir = path.join(paths.inputDir, "burst");
    const spritePath = path.join(atlasDir, "pulse.png");

    await createImage(spritePath, 20, 20, 140);

    const plugin = texturePacker({
      inputDir: paths.inputDir,
      outputDir: paths.outputDir,
      cacheFile: paths.cacheFile,
    });

    await runBuild(plugin, paths.cacheDir);

    const watcher = createWatcher();
    plugin.configureServer?.({
      watcher,
    } as never);

    const atlasJsonPath = path.join(paths.outputDir, "burst", "burst.json");
    const writeSpy = vi.spyOn(fs, "writeFileSync");

    await createImage(spritePath, 24, 20, 80);

    watcher.emit("all", "change", spritePath);
    watcher.emit("all", "change", spritePath);
    watcher.emit("all", "change", spritePath);

    await waitFor(500);

    const atlasWrites = writeSpy.mock.calls.filter(([targetPath]) => targetPath === atlasJsonPath);

    expect(atlasWrites).toHaveLength(1);

    const atlasJson = readJson<{
      textures: Array<{ frames: Array<{ frame: { w: number } }> }>;
    }>(atlasJsonPath);
    expect(atlasJson.textures[0]?.frames[0]?.frame.w).toBe(24);
  });
});
