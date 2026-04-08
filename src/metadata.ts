import type { PackedAtlas } from "./types";

export function createAtlasMetadata(atlas: PackedAtlas, packageVersion: string) {
  return {
    textures: [
      {
        image: `${atlas.atlasName}.png`,
        format: "RGBA8888",
        size: { w: atlas.width, h: atlas.height },
        scale: 1,
        frames: atlas.frames.map((frame) => ({
          filename: frame.name,
          rotated: false,
          trimmed: false,
          sourceSize: {
            w: frame.width,
            h: frame.height,
          },
          spriteSourceSize: {
            x: 0,
            y: 0,
            w: frame.width,
            h: frame.height,
          },
          frame: {
            x: frame.x,
            y: frame.y,
            w: frame.width,
            h: frame.height,
          },
        })),
      },
    ],
    meta: {
      app: "vite-texture-packer",
      version: packageVersion,
    },
  };
}
