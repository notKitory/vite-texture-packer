import type { Plugin } from "vite";

import { createTexturePackerPlugin } from "./plugin";
import type { TexturePackerOptions } from "./types";

export type { TexturePackerOptions } from "./types";

/**
 * Creates the Vite plugin that scans sprite directories and generates texture atlases.
 *
 * @param options Plugin configuration for source directories, output paths, and atlas limits.
 * @returns A configured Vite plugin instance.
 */
export function texturePacker(options: TexturePackerOptions): Plugin {
  return createTexturePackerPlugin(options);
}

export default texturePacker;
