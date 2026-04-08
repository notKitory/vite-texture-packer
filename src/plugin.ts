import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { MaxRectsPacker } from "maxrects-packer";
import sharp from "sharp";
import { debounce } from "throttle-debounce";
import { createLogger, type Plugin, type ResolvedConfig, type ViteDevServer } from "vite";

import { createAtlasMetadata } from "./metadata";
import { getPackageVersion } from "./package-version";
import type {
  CacheData,
  PackedAtlas,
  ResolvedTexturePackerOptions,
  TexturePackerOptions,
} from "./types";

const IMAGE_FILE_RE = /\.(png|jpg|jpeg|webp)$/i;
const CACHE_SAVE_DEBOUNCE_MS = 150;
const PACK_DEBOUNCE_MS = 150;

const logger = createLogger("info", { prefix: "[vite-texture-packer]" });

function log(message: string) {
  logger.info(message, { timestamp: true });
}

function logError(message: string) {
  logger.error(message, { timestamp: true });
}

function isPathEqualOrInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function validatePositiveInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `[vite-texture-packer] "${fieldName}" must be a positive integer. Received: ${value}`,
    );
  }
}

function validateNonNegativeInteger(value: number, fieldName: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `[vite-texture-packer] "${fieldName}" must be a non-negative integer. Received: ${value}`,
    );
  }
}

function resolveOptions(options: TexturePackerOptions): ResolvedTexturePackerOptions {
  if (typeof options.inputDir !== "string" || options.inputDir.trim().length === 0) {
    throw new Error('[vite-texture-packer] "inputDir" must be a non-empty string.');
  }

  if (typeof options.outputDir !== "string" || options.outputDir.trim().length === 0) {
    throw new Error('[vite-texture-packer] "outputDir" must be a non-empty string.');
  }

  if (options.cacheFile !== undefined && options.cacheFile.trim().length === 0) {
    throw new Error('[vite-texture-packer] "cacheFile" must be a non-empty string when provided.');
  }

  const width = options.width ?? 2048;
  const height = options.height ?? 2048;
  const padding = options.padding ?? 2;

  validatePositiveInteger(width, "width");
  validatePositiveInteger(height, "height");
  validateNonNegativeInteger(padding, "padding");

  const inputDir = path.resolve(options.inputDir);
  const outputDir = path.resolve(options.outputDir);

  if (isPathEqualOrInside(inputDir, outputDir)) {
    throw new Error(
      `[vite-texture-packer] "outputDir" must not be the same as or nested inside "inputDir".`,
    );
  }

  return {
    inputDir,
    outputDir,
    width,
    height,
    padding,
    cacheFile: options.cacheFile ? path.resolve(options.cacheFile) : undefined,
  };
}

function getRelativeDirectoryPath(inputRoot: string, dirPath: string): string {
  const relativePath = path.relative(inputRoot, dirPath);
  return relativePath === "" ? "" : relativePath;
}

function listSupportedImages(dirPath: string): string[] | null {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && IMAGE_FILE_RE.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return null;
  }
}

function getFolderHash(dirPath: string, files: string[]): string {
  const hash = crypto.createHash("md5");

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    hash.update(file);
    hash.update(String(stat.size));
    hash.update(String(stat.mtimeMs));
  }

  return hash.digest("hex");
}

function loadCache(cacheFilePath: string): CacheData {
  if (!fs.existsSync(cacheFilePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(cacheFilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Cache file must contain an object.");
    }

    const entries = Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    );

    return Object.fromEntries(entries);
  } catch {
    logError("Failed to load cache file. Starting fresh.");
    return {};
  }
}

function removeFileIfExists(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  } catch {
    logError(`Failed to remove stale artifact: ${filePath}`);
  }
}

function pruneEmptyOutputDirectories(targetDir: string, outputRoot: string) {
  let currentDir = targetDir;

  while (currentDir !== outputRoot) {
    if (!fs.existsSync(currentDir)) {
      currentDir = path.dirname(currentDir);
      continue;
    }

    const entries = fs.readdirSync(currentDir);

    if (entries.length > 0) {
      break;
    }

    fs.rmdirSync(currentDir);
    currentDir = path.dirname(currentDir);
  }
}

function removeGeneratedArtifacts(
  inputRoot: string,
  outputRoot: string,
  relativePath: string,
) {
  const sourceDir = path.join(inputRoot, relativePath);
  const targetDir = path.join(outputRoot, relativePath);
  const atlasName = path.basename(sourceDir) || "main";

  removeFileIfExists(path.join(targetDir, `${atlasName}.png`));
  removeFileIfExists(path.join(targetDir, `${atlasName}.json`));

  if (fs.existsSync(targetDir)) {
    pruneEmptyOutputDirectories(targetDir, outputRoot);
  }
}

function clearCacheBranch(
  inputRoot: string,
  outputRoot: string,
  cache: CacheData,
  relativePath: string,
) {
  const branchKeys = Object.keys(cache)
    .filter((cacheKey) =>
      relativePath === ""
        ? true
        : cacheKey === relativePath || cacheKey.startsWith(`${relativePath}${path.sep}`),
    )
    .sort((left, right) => left.length - right.length);

  for (const cacheKey of branchKeys) {
    removeGeneratedArtifacts(inputRoot, outputRoot, cacheKey);
    delete cache[cacheKey];
  }
}

function cleanupDirectoryWithoutImages(
  inputRoot: string,
  outputRoot: string,
  cache: CacheData,
  relativePath: string,
) {
  removeGeneratedArtifacts(inputRoot, outputRoot, relativePath);
  delete cache[relativePath];
}

function cleanupRemovedDirectories(
  inputRoot: string,
  outputRoot: string,
  cache: CacheData,
  visitedDirectories: Set<string>,
) {
  const staleKeys = Object.keys(cache)
    .filter((cacheKey) => !visitedDirectories.has(cacheKey))
    .sort((left, right) => left.length - right.length);

  for (const cacheKey of staleKeys) {
    removeGeneratedArtifacts(inputRoot, outputRoot, cacheKey);
    delete cache[cacheKey];
  }
}

async function packDirectory(
  dirPath: string,
  relativePath: string,
  outputRoot: string,
  options: ResolvedTexturePackerOptions,
  packageVersion: string,
): Promise<PackedAtlas | null> {
  const images = listSupportedImages(dirPath);

  if (!images || images.length === 0) {
    return null;
  }

  const targetDir = path.join(outputRoot, relativePath);
  const atlasName = path.basename(dirPath) || "main";

  fs.mkdirSync(targetDir, { recursive: true });

  const packer = new MaxRectsPacker(options.width, options.height, options.padding);
  const spriteBuffers = new Map<string, Buffer>();
  const frameNames = new Set<string>();

  for (const file of images) {
    const filePath = path.join(dirPath, file);
    const frameName = path.parse(file).name;

    if (frameNames.has(frameName)) {
      throw new Error(
      `[vite-texture-packer] Duplicate sprite name "${frameName}" in "${relativePath || "."}".`,
      );
    }

    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        logError(`Skipped file with unknown dimensions: ${file}`);
        continue;
      }

      const buffer = await image.toBuffer();

      frameNames.add(frameName);
      spriteBuffers.set(frameName, buffer);
      packer.add(metadata.width, metadata.height, { name: frameName });
    } catch {
      logError(`Skipped bad file: ${file}`);
    }
  }

  if (spriteBuffers.size === 0 || packer.bins.length === 0) {
    return null;
  }

  if (packer.bins.length > 1) {
    throw new Error(
      `[vite-texture-packer] "${relativePath || "."}" does not fit in a single atlas. Increase width/height or split the source directory.`,
    );
  }

  const [bin] = packer.bins;
  const frames = bin.rects.map((rect) => ({
    name: String(rect.data.name),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }));

  await sharp({
    create: {
      width: bin.width,
      height: bin.height,
      channels: 4,
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 0,
      },
    },
  })
    .composite(
      bin.rects.map((rect) => {
        const buffer = spriteBuffers.get(String(rect.data.name));

        if (!buffer) {
          throw new Error(
            `[vite-texture-packer] Missing sprite buffer for "${String(rect.data.name)}".`,
          );
        }

        return {
          input: buffer,
          top: rect.y,
          left: rect.x,
        };
      }),
    )
    .png()
    .toFile(path.join(targetDir, `${atlasName}.png`));

  const metadata = createAtlasMetadata(
    {
      atlasName,
      width: bin.width,
      height: bin.height,
      frames,
    },
    packageVersion,
  );

  fs.writeFileSync(
    path.join(targetDir, `${atlasName}.json`),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  log(
    `Packed: ${relativePath || "root"} -> ${atlasName} (${frames.length} frames)`,
  );

  return {
    atlasName,
    width: bin.width,
    height: bin.height,
    frames,
  };
}

async function syncDirectory(
  dirPath: string,
  inputRoot: string,
  outputRoot: string,
  options: ResolvedTexturePackerOptions,
  cache: CacheData,
  packageVersion: string,
) {
  const relativePath = getRelativeDirectoryPath(inputRoot, dirPath);

  if (!fs.existsSync(dirPath)) {
    clearCacheBranch(inputRoot, outputRoot, cache, relativePath);
    return;
  }

  const images = listSupportedImages(dirPath);

  if (!images) {
    clearCacheBranch(inputRoot, outputRoot, cache, relativePath);
    return;
  }

  if (images.length === 0) {
    cleanupDirectoryWithoutImages(inputRoot, outputRoot, cache, relativePath);
    return;
  }

  const folderHash = getFolderHash(dirPath, images);

  if (cache[relativePath] === folderHash) {
    return;
  }

  const atlas = await packDirectory(
    dirPath,
    relativePath,
    outputRoot,
    options,
    packageVersion,
  );

  if (!atlas) {
    cleanupDirectoryWithoutImages(inputRoot, outputRoot, cache, relativePath);
    return;
  }

  cache[relativePath] = folderHash;
}

async function scanAndPackRecursive(
  currentDir: string,
  inputRoot: string,
  outputRoot: string,
  options: ResolvedTexturePackerOptions,
  cache: CacheData,
  packageVersion: string,
  visitedDirectories: Set<string>,
) {
  if (!fs.existsSync(currentDir)) {
    return;
  }

  visitedDirectories.add(getRelativeDirectoryPath(inputRoot, currentDir));

  await syncDirectory(
    currentDir,
    inputRoot,
    outputRoot,
    options,
    cache,
    packageVersion,
  );

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await scanAndPackRecursive(
        path.join(currentDir, entry.name),
        inputRoot,
        outputRoot,
        options,
        cache,
        packageVersion,
        visitedDirectories,
      );
    }
  }
}

function resolveWatchTargetDirectory(event: string, filePath: string): string {
  if (event === "unlinkDir") {
    return filePath;
  }

  if (fs.existsSync(filePath)) {
    try {
      if (fs.statSync(filePath).isDirectory()) {
        return filePath;
      }
    } catch {
      return path.dirname(filePath);
    }
  }

  return path.dirname(filePath);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

type PackJobState = {
  running: boolean;
  pending: boolean;
  timer?: NodeJS.Timeout;
};

export function createTexturePackerPlugin(options: TexturePackerOptions): Plugin {
  const resolvedOptions = resolveOptions(options);
  const inputRoot = resolvedOptions.inputDir;
  const outputRoot = resolvedOptions.outputDir;
  const packageVersion = getPackageVersion();

  let cacheFilePath = "";
  let cache: CacheData = {};

  const writeCache = () => {
    if (!cacheFilePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(cacheFilePath), { recursive: true });
      fs.writeFileSync(cacheFilePath, `${JSON.stringify(cache, null, 2)}\n`);
    } catch {
      logError("Failed to save cache file.");
    }
  };

  const saveCache = debounce(CACHE_SAVE_DEBOUNCE_MS, writeCache);

  const packJobs = new Map<string, PackJobState>();

  const runScheduledPack = async (dirPath: string, state: PackJobState) => {
    if (state.running) {
      state.pending = true;
      return;
    }

    state.running = true;

    try {
      do {
        state.pending = false;
        await syncDirectory(
          dirPath,
          inputRoot,
          outputRoot,
          resolvedOptions,
          cache,
          packageVersion,
        );
      } while (state.pending);

      saveCache();
    } catch (error) {
      logError(formatError(error));
    } finally {
      state.running = false;

      if (!state.timer && !state.pending) {
        packJobs.delete(dirPath);
      }
    }
  };

  const triggerPack = (dirPath: string) => {
    const normalizedDirPath = path.resolve(dirPath);
    const existingState = packJobs.get(normalizedDirPath);

    if (existingState?.timer) {
      clearTimeout(existingState.timer);
    }

    const state = existingState ?? {
      running: false,
      pending: false,
    };

    state.timer = setTimeout(() => {
      state.timer = undefined;
      void runScheduledPack(normalizedDirPath, state);
    }, PACK_DEBOUNCE_MS);

    packJobs.set(normalizedDirPath, state);
  };

  return {
    name: "vite-texture-packer",

    configResolved(config: ResolvedConfig) {
      const viteCacheDir = config.cacheDir
        ? path.resolve(config.cacheDir)
        : path.resolve("node_modules/.vite");

      cacheFilePath = resolvedOptions.cacheFile
        ? resolvedOptions.cacheFile
        : path.join(viteCacheDir, "texture-packer.json");

      cache = loadCache(cacheFilePath);
    },

    async buildStart() {
      if (!fs.existsSync(inputRoot)) {
        return;
      }

      log(`Scanning ${options.inputDir}...`);

      const visitedDirectories = new Set<string>();

      await scanAndPackRecursive(
        inputRoot,
        inputRoot,
        outputRoot,
        resolvedOptions,
        cache,
        packageVersion,
        visitedDirectories,
      );

      cleanupRemovedDirectories(inputRoot, outputRoot, cache, visitedDirectories);
      writeCache();

      log("Finished scanning.");
    },

    configureServer(server: ViteDevServer) {
      server.watcher.add(inputRoot);

      server.watcher.on("all", (event, filePath) => {
        const normalizedPath = path.resolve(filePath);

        if (!isPathEqualOrInside(inputRoot, normalizedPath)) {
          return;
        }

        triggerPack(resolveWatchTargetDirectory(event, normalizedPath));
      });
    },
  };
}
