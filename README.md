# vite-texture-packer

[English](./README.md) | [Русский](./README_RU.md)

`vite-texture-packer` is a Vite plugin that automatically scans sprite directories and packs them into atlases. The plugin is compatible with Phaser and PixiJS.

![meme](./images/meme.png)

## Installation

```bash
npm i vite-texture-packer
```

## Usage

```ts
import { defineConfig } from "vite";
import texturePacker from "vite-texture-packer";

export default defineConfig({
  plugins: [
    texturePacker({
      inputDir: "./textures",
      outputDir: "./public/resources/atlases",
    }),
  ],
});
```

Each directory inside `inputDir` is packed independently. For example, for `./textures/ui/buttons` the plugin will generate:

- `public/resources/atlases/ui/buttons/buttons.png`
- `public/resources/atlases/ui/buttons/buttons.json`

## Example Project Structure

```text
public
└── resources
    └── atlases
        └── .gitkeep
textures
├── ui
│   ├── MenuIcons
│   │   ├── AchievementsIcon.png
│   │   ├── Chest.png
│   │   └── SettingsIcon.png
│   ├── SocialIcons
│   │   ├── DiscordIcon.png
│   │   ├── GoogleIcon.png
│   │   └── TelegramIcon.png
│   └── Spinner
│       ├── Spinner_0.png
│       ├── Spinner_1.png
│       ├── Spinner_2.png
│       └── Spinner_3.png
└── weapons
    └── GasterBlaster
        ├── GasterBlaster_0.png
        ├── GasterBlaster_1.png
        ├── GasterBlaster_2.png
        └── GasterBlaster_3.png
vite.config.ts
```

The plugin will generate atlas file pairs that mirror the source folder structure:

```text
public
└── resources
    └── atlases
        ├── ui
        │   ├── MenuIcons
        │   │   ├── MenuIcons.png
        │   │   └── MenuIcons.json
        │   ├── SocialIcons
        │   │   ├── SocialIcons.png
        │   │   └── SocialIcons.json
        │   └── Spinner
        │       ├── Spinner.png
        │       └── Spinner.json
        ├── weapons
        │   └── GasterBlaster
        │       ├── GasterBlaster.png
        │       └── GasterBlaster.json
        └── .gitkeep
```

## Options

```ts
interface TexturePackerOptions {
  inputDir: string;
  outputDir: string;
  maxWidth?: number;
  maxHeight?: number;
  padding?: number;
  cacheFile?: string;
}
```

| Option | Default | Description |
| --- | --- | --- |
| `inputDir` | required | Directory with source images to pack. Each nested folder becomes its own atlas. |
| `outputDir` | required | Directory where generated `.png` and `.json` files are written, mirroring the `inputDir` structure. |
| `maxWidth` | `2048` | Maximum allowed width of a single atlas PNG. The plugin tries to fit all images from one folder into an atlas no wider than this. |
| `maxHeight` | `2048` | Maximum allowed height of a single atlas PNG. The plugin tries to fit all images from one folder into an atlas no taller than this. |
| `padding` | `2` | Padding in pixels between sprites inside the atlas. |
| `cacheFile` | `<vite cache dir>/texture-packer.json` | Path to the cache file used to avoid rebuilding unchanged atlases. |

## Notes

- `outputDir` cannot be the same as `inputDir` and cannot be nested inside `inputDir`.
- Only `png`, `jpg`, `jpeg`, and `webp` files are packed.
- `2048x2048` is the recommended atlas limit for broad browser and mobile GPU compatibility. Larger atlases are more likely to exceed `MAX_TEXTURE_SIZE` on older devices, create VRAM spikes during texture uploads, and slow down scene startup.
- If source files are removed from a directory, stale generated atlas files are removed automatically.
