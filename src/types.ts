/**
 * User-facing options for configuring atlas generation.
 */
export interface TexturePackerOptions {
  /**
   * Directory with source images. Each nested folder becomes a separate atlas.
   */
  inputDir: string;
  /**
   * Directory where generated atlas images and metadata files are written.
   */
  outputDir: string;
  /**
   * Maximum allowed width of a generated atlas in pixels.
   *
   * `2048` is the recommended upper bound to reduce the risk of WebGL texture
   * upload failures on older mobile GPUs, excessive VRAM usage, and slower
   * scene startup caused by large texture uploads.
   *
   * @default 2048
   */
  maxWidth?: number;
  /**
   * Maximum allowed height of a generated atlas in pixels.
   *
   * `2048` is the recommended upper bound to reduce the risk of WebGL texture
   * upload failures on older mobile GPUs, excessive VRAM usage, and slower
   * scene startup caused by large texture uploads.
   *
   * @default 2048
   */
  maxHeight?: number;
  /**
   * Spacing between sprites inside the atlas in pixels.
   *
   * @default 2
   */
  padding?: number;
  /**
   * Optional path to the cache file used to skip unchanged atlases.
   */
  cacheFile?: string;
}

/**
 * Fully resolved texture packer options with defaults applied.
 */
export interface ResolvedTexturePackerOptions {
  /**
   * Absolute path to the source images directory.
   */
  inputDir: string;
  /**
   * Absolute path to the generated atlases directory.
   */
  outputDir: string;
  /**
   * Maximum allowed atlas width in pixels.
   */
  maxWidth: number;
  /**
   * Maximum allowed atlas height in pixels.
   */
  maxHeight: number;
  /**
   * Spacing between sprites inside the atlas in pixels.
   */
  padding: number;
  /**
   * Absolute path to the cache file, when caching is enabled.
   */
  cacheFile?: string;
}

/**
 * Hash cache keyed by a directory path relative to the input root.
 */
export interface CacheData {
  [relativePath: string]: string;
}

/**
 * A packed sprite frame inside a generated atlas.
 */
export interface PackedFrame {
  /**
   * Frame name derived from the source filename.
   */
  name: string;
  /**
   * Horizontal position inside the atlas.
   */
  x: number;
  /**
   * Vertical position inside the atlas.
   */
  y: number;
  /**
   * Frame width in pixels.
   */
  width: number;
  /**
   * Frame height in pixels.
   */
  height: number;
}

/**
 * In-memory representation of a generated atlas and its frames.
 */
export interface PackedAtlas {
  /**
   * Output atlas basename without file extension.
   */
  atlasName: string;
  /**
   * Final atlas width in pixels.
   */
  width: number;
  /**
   * Final atlas height in pixels.
   */
  height: number;
  /**
   * Frames packed into the atlas.
   */
  frames: PackedFrame[];
}
