import { compressBound, compressBlock } from "lz4js";

const PAGE = 0x1000;

const MAGIC = 0x87654321;
const VERSION = 4;
const HEADER_SIZE = 12;
const ENTRY_SIZE = 136;
const THEMES_MAX_SIZE = 0x180000; // 1572864

const WALLPAPER_ROWS = 16;

const ICON_NAMES = ["calculation", "code", "distributions", "elements", "finance", "graph", "inference", "regression", "sequence", "settings", "solver", "stat"];

function u32(...values) {
    const view = new DataView(new ArrayBuffer(values.length * 4));
    values.forEach((v, i) => view.setUint32(i * 4, v, true));
    return new Uint8Array(view.buffer);
}

function concat(parts) {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

function base64ToBytes(b64) {
    const binary = atob(b64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function rgbaToRgb565(rgba) {
    const out = new Uint8Array((rgba.length / 4) * 2);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 2) {
        const pixel = ((rgba[i] >> 3) << 11) | ((rgba[i + 1] >> 2) << 5) | (rgba[i + 2] >> 3);
        out[j] = pixel & 0xff;
        out[j + 1] = pixel >> 8;
    }
    return out;
}

function createCanvas(width, height) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

async function decodeImage(base64Png) {
    const bitmap = await createImageBitmap(new Blob([base64ToBytes(base64Png)]));
    try {
        const ctx = createCanvas(bitmap.width, bitmap.height).getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        return { rgb: rgbaToRgb565(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data), width: bitmap.width, height: bitmap.height };
    } finally {
        bitmap.close?.();
    }
}

function lz4Block(data) {
    const dst = new Uint8Array(compressBound(data.length));
    const size = compressBlock(data, dst, 0, data.length, new Uint32Array(1 << 16));
    return dst.slice(0, size);
}

function packIcon(image) {
    return lz4Block(image.rgb);
}

function packWallpaper(image) {
    const { rgb, width, height } = image;
    const chunkCount = Math.ceil(height / WALLPAPER_ROWS);
    const bytesPerRow = width * 2;

    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
        const start = i * WALLPAPER_ROWS * bytesPerRow;
        const end = Math.min(height, (i + 1) * WALLPAPER_ROWS) * bytesPerRow;
        chunks.push(lz4Block(rgb.subarray(start, end)));
    }

    let running = 0;
    const offsets = chunks.map((c) => {
        const offset = running;
        running += c.length;
        return offset;
    });

    return concat([u32(width, height, WALLPAPER_ROWS, chunkCount), u32(...offsets), u32(...chunks.map((c) => c.length)), ...chunks]);
}

function packThemes(themes) {
    let cursor = HEADER_SIZE + themes.length * ENTRY_SIZE;
    const entries = [];
    const blobs = [];

    for (const theme of themes) {
        const entry = new DataView(new ArrayBuffer(ENTRY_SIZE));

        const nameBytes = new TextEncoder().encode(theme.name);
        nameBytes.forEach((c, i) => entry.setUint8(i, c));

        let wallOffset = 0,
            wallSize = 0;
        if (theme.wallpaper) {
            wallOffset = cursor;
            wallSize = theme.wallpaper.length;
            blobs.push(theme.wallpaper);
            cursor += wallSize;
        }

        const palette = u32(...theme.palette);
        const paletteOffset = cursor;
        blobs.push(palette);
        cursor += palette.length;

        entry.setUint8(16, Boolean(theme.wallpaper));
        entry.setUint8(17, 1);
        entry.setUint8(18, theme.icons.some(Boolean));
        entry.setUint8(19, theme.defaultCircleLevel);
        entry.setUint8(20, theme.isAppNameBackgroundHover);
        entry.setUint32(24, wallOffset, true);
        entry.setUint32(28, wallSize, true);
        entry.setUint32(32, paletteOffset, true);
        entry.setUint32(36, palette.length, true);

        theme.icons.forEach((icon, i) => {
            if (!icon) return;
            entry.setUint32(40 + i * 4, cursor, true);
            entry.setUint32(88 + i * 4, icon.length, true);
            blobs.push(icon);
            cursor += icon.length;
        });

        entries.push(new Uint8Array(entry.buffer));
    }

    if (cursor > THEMES_MAX_SIZE) {
        throw new Error(`Themes too large (${(cursor / 1024).toFixed(1)} / ${THEMES_MAX_SIZE / 1024} KiB)`);
    }

    const raw = concat([u32(MAGIC, VERSION, themes.length), ...entries, ...blobs]);

    const padded = new Uint8Array(Math.ceil(raw.length / PAGE) * PAGE);
    padded.set(raw);
    return padded;
}

async function prepareTheme(theme) {
    const name = theme.name.trim();
    const palette = Object.values(theme.palette);

    const [wallpaper, ...icons] = await Promise.all([
        theme.wallpaper ? decodeImage(theme.wallpaper).then(packWallpaper) : null,
        ...ICON_NAMES.map((n) => (theme.icons[n] ? decodeImage(theme.icons[n]).then(packIcon) : null)),
    ]);

    return { name, palette, defaultCircleLevel: theme.variables.defaultCircleLevel, isAppNameBackgroundHover: theme.variables.isAppNameBackgroundHover, wallpaper, icons };
}

function themeSize(theme) {
    return ENTRY_SIZE + 4 * theme.palette.length + (theme.wallpaper ? theme.wallpaper.length : 0) + theme.icons.reduce((sum, icon) => sum + (icon ? icon.length : 0), 0);
}

async function buildThemesBinary(themes) {
    const prepared = await Promise.all(
        themes.map((theme, i) =>
            prepareTheme(theme).catch((e) => {
                const label = typeof theme?.name === "string" ? ` "${theme.name}"` : "";
                throw new Error(`Theme ${i + 1}${label}: ${e.message}`);
            }),
        ),
    );
    return packThemes(prepared);
}

export { buildThemesBinary, themeSize, prepareTheme, HEADER_SIZE, THEMES_MAX_SIZE };
