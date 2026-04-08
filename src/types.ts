export interface TexturePackerOptions {
  inputDir: string;
  outputDir: string;
  width?: number;
  height?: number;
  padding?: number;
  cacheFile?: string;
}

export interface ResolvedTexturePackerOptions {
  inputDir: string;
  outputDir: string;
  width: number;
  height: number;
  padding: number;
  cacheFile?: string;
}

export interface CacheData {
  [relativePath: string]: string;
}

export interface PackedFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackedAtlas {
  atlasName: string;
  width: number;
  height: number;
  frames: PackedFrame[];
}
