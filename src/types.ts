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
   * Maximum width of a generated atlas in pixels.
   *
   * @default 2048
   */
  width?: number;
  /**
   * Maximum height of a generated atlas in pixels.
   *
   * @default 2048
   */
  height?: number;
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
   * Maximum atlas width in pixels.
   */
  width: number;
  /**
   * Maximum atlas height in pixels.
   */
  height: number;
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
