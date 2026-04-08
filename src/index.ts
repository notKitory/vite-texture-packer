import type { Plugin } from "vite";

import { createTexturePackerPlugin } from "./plugin";
import type { TexturePackerOptions } from "./types";

export type { TexturePackerOptions } from "./types";

export function texturePacker(options: TexturePackerOptions): Plugin {
  return createTexturePackerPlugin(options);
}

export default texturePacker;
