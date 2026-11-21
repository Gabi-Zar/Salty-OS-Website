import { compressBound, compressHC, decompress } from "./lz4hc.js";
import defaultTheme from "../../../models/epsilon.json" with { type: "json" };

const PAGE = 0x1000;

const MAGIC = 0x87654321;
const VERSION = 6;
const HEADER_SIZE = 12;
const ENTRY_SIZE = 136;
const THEMES_MAX_SIZE = 0x180000; // 1572864

const WALLPAPER_ROWS = 16;
const WALLPAPER_WIDTH = 320;
const WALLPAPER_HEIGHT = 240;
const WALLPAPER_CHUNK_COUNT = Math.ceil(WALLPAPER_HEIGHT / WALLPAPER_ROWS);
const WALLPAPER_HEADER_SIZE = 16 + WALLPAPER_CHUNK_COUNT * 8;
const WALLPAPER_MAX_BLOB_SIZE = WALLPAPER_HEADER_SIZE + WALLPAPER_CHUNK_COUNT * compressBound(WALLPAPER_ROWS * WALLPAPER_WIDTH * 2);

const ICON_WIDTH = 55;
const ICON_HEIGHT = 56;
const ICON_SIZE = ICON_WIDTH * ICON_HEIGHT * 2;
const ICON_ALIGNMENT = 4;
const ICON_FORMAT_LZ4 = 0;
const ICON_FORMAT_RAW565 = 1;
const LZ4_LEVEL = 12;

const PNG_BASE64_SIGNATURE = "iVBORw0KGgo";

const PALETTE_MAGIC = 0x324c4150;
const PALETTE_NAME_SIZE = 32;
const PALETTE_RECORD_SIZE = PALETTE_NAME_SIZE + 4;

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

function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function asBytes(value) {
    if (!ArrayBuffer.isView(value)) throw new TypeError("expected binary data");
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
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

function packIcon(image, format) {
    if (image.width !== ICON_WIDTH || image.height !== ICON_HEIGHT) {
        throw new Error(`icon must be ${ICON_WIDTH}x${ICON_HEIGHT} (got ${image.width}x${image.height})`);
    }
    return format === ICON_FORMAT_LZ4 ? compressHC(image.rgb, LZ4_LEVEL) : image.rgb;
}

function packWallpaper(image) {
    const { rgb, width, height } = image;
    if (width !== WALLPAPER_WIDTH || height !== WALLPAPER_HEIGHT) {
        throw new Error(`wallpaper must be ${WALLPAPER_WIDTH}x${WALLPAPER_HEIGHT} (got ${width}x${height})`);
    }
    const chunkCount = Math.ceil(height / WALLPAPER_ROWS);
    const bytesPerRow = width * 2;

    const chunks = [];
    for (let i = 0; i < chunkCount; i++) {
        const start = i * WALLPAPER_ROWS * bytesPerRow;
        const end = Math.min(height, (i + 1) * WALLPAPER_ROWS) * bytesPerRow;
        chunks.push(compressHC(rgb.subarray(start, end), LZ4_LEVEL));
    }

    let running = 0;
    const offsets = chunks.map((c) => {
        const offset = running;
        running += c.length;
        return offset;
    });

    return concat([u32(width, height, WALLPAPER_ROWS, chunkCount), u32(...offsets), u32(...chunks.map((c) => c.length)), ...chunks]);
}

function unpackIcon(blob, format = ICON_FORMAT_RAW565) {
    const bytes = asBytes(blob);

    if (format !== ICON_FORMAT_LZ4) {
        if (bytes.length !== ICON_SIZE) throw new Error(`icon: expected ${ICON_SIZE} bytes of RGB565 (${ICON_WIDTH}x${ICON_HEIGHT}), got ${bytes.length}`);
        return bytes;
    }

    if (bytes.length === 0 || bytes.length > compressBound(ICON_SIZE)) throw new Error(`icon: invalid LZ4 blob size (${bytes.length} bytes)`);
    try {
        return decompress(bytes, ICON_SIZE);
    } catch (err) {
        throw new Error(`icon: corrupted LZ4 data (${err.message})`);
    }
}

function unpackWallpaper(blob) {
    const bytes = asBytes(blob);
    if (bytes.length < WALLPAPER_HEADER_SIZE || bytes.length > WALLPAPER_MAX_BLOB_SIZE) {
        throw new Error(`wallpaper: invalid blob size (${bytes.length} bytes)`);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const [width, height, rows, count] = [0, 4, 8, 12].map((offset) => view.getUint32(offset, true));
    if (width !== WALLPAPER_WIDTH || height !== WALLPAPER_HEIGHT || rows !== WALLPAPER_ROWS || count !== WALLPAPER_CHUNK_COUNT) {
        throw new Error(`wallpaper: the header must announce ${WALLPAPER_WIDTH}x${WALLPAPER_HEIGHT} in ${WALLPAPER_CHUNK_COUNT} chunks of ${WALLPAPER_ROWS} rows`);
    }

    const rgb = new Uint8Array(width * height * 2);
    let next = 0;
    for (let i = 0; i < count; i++) {
        const offset = view.getUint32(16 + i * 4, true);
        const size = view.getUint32(16 + count * 4 + i * 4, true);
        const start = WALLPAPER_HEADER_SIZE + offset;
        if (offset !== next || start + size > bytes.length) throw new Error(`wallpaper chunk ${i}: offset or size out of the blob`);

        const top = i * rows;
        const chunkRows = Math.min(height, top + rows) - top;
        let pixels;
        try {
            pixels = decompress(bytes.subarray(start, start + size), chunkRows * width * 2);
        } catch (err) {
            throw new Error(`wallpaper chunk ${i}: corrupted LZ4 data (${err.message})`);
        }
        rgb.set(pixels, top * width * 2);
        next += size;
    }
    if (WALLPAPER_HEADER_SIZE + next !== bytes.length) throw new Error("wallpaper: unexpected bytes after the last chunk");

    return { width, height, rgb };
}

function flatColors(section) {
    const out = [];
    for (const [key, value] of Object.entries(section)) {
        if (key.startsWith("_")) continue;
        if (value && typeof value === "object") {
            for (const [sub, v] of Object.entries(value)) if (!sub.startsWith("_")) out.push([key + sub, v]);
        } else out.push([key, value]);
    }
    return out;
}

const DEFAULT_COLORS = new Map(flatColors(defaultTheme.colors));

function resolveColors(colors) {
    const own = new Map(flatColors(colors));
    for (const name of own.keys()) if (!DEFAULT_COLORS.has(name)) throw new Error(`unknown color ${name}`);

    const resolved = new Map();
    for (const [name, defaultValue] of DEFAULT_COLORS) {
        const value = own.get(name) ?? defaultValue;
        if (value.startsWith("@")) {
            const color = resolved.get(value.slice(1));
            if (color === undefined) throw new Error(`${name}: ${value} must refer to a color declared before it in epsilon.json`);
            resolved.set(name, color);
        } else {
            resolved.set(name, parseInt(value, 16));
        }
    }
    return resolved;
}

function encodePalette(colors) {
    const blob = new Uint8Array(8 + colors.size * PALETTE_RECORD_SIZE);
    const view = new DataView(blob.buffer);
    view.setUint32(0, PALETTE_MAGIC, true);
    view.setUint32(4, colors.size, true);

    let offset = 8;
    for (const [name, color] of colors) {
        blob.set(new TextEncoder().encode(name), offset);
        view.setUint32(offset + PALETTE_NAME_SIZE, color, true);
        offset += PALETTE_RECORD_SIZE;
    }
    return blob;
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

        const palette = theme.palette;
        const paletteOffset = cursor;
        blobs.push(palette);
        cursor += palette.length;

        entry.setUint8(16, Boolean(theme.wallpaper));
        entry.setUint8(17, 1);
        entry.setUint8(18, theme.icons.some(Boolean));
        entry.setUint8(19, theme.defaultCircleLevel);
        entry.setUint8(20, theme.isAppNameBackgroundHover);
        entry.setUint8(21, theme.iconFormat);
        entry.setUint8(22, theme.isUpsilonBattery);
        entry.setUint32(24, wallOffset, true);
        entry.setUint32(28, wallSize, true);
        entry.setUint32(32, paletteOffset, true);
        entry.setUint32(36, palette.length, true);

        theme.icons.forEach((icon, i) => {
            if (!icon) return;
            const padding = theme.iconFormat === ICON_FORMAT_RAW565 ? (ICON_ALIGNMENT - (cursor % ICON_ALIGNMENT)) % ICON_ALIGNMENT : 0;
            if (padding) {
                blobs.push(new Uint8Array(padding));
                cursor += padding;
            }
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

async function packedImage(value, pack, unpack) {
    if (!value) return null;
    if (value.startsWith(PNG_BASE64_SIGNATURE)) return pack(await decodeImage(value));

    const bytes = base64ToBytes(value);
    unpack(bytes);
    return bytes;
}

async function prepareTheme(theme) {
    const name = theme.name.trim();
    const palette = encodePalette(resolveColors(theme.colors));

    const iconFormat = theme.variables.iconFormat ?? ICON_FORMAT_RAW565;

    const [wallpaper, ...icons] = await Promise.all([
        packedImage(theme.wallpaper, packWallpaper, unpackWallpaper),
        ...ICON_NAMES.map((n) =>
            packedImage(
                theme.icons?.[n],
                (image) => packIcon(image, iconFormat),
                (bytes) => unpackIcon(bytes, iconFormat),
            ),
        ),
    ]);

    return {
        name,
        palette,
        defaultCircleLevel: theme.variables.defaultCircleLevel,
        isAppNameBackgroundHover: theme.variables.isAppNameBackgroundHover,
        iconFormat,
        isUpsilonBattery: theme.variables.isUpsilonBattery ?? 0,
        wallpaper,
        icons,
    };
}

function themeSize(theme) {
    const icons = theme.icons.filter(Boolean);
    const padding = icons.length && theme.iconFormat === ICON_FORMAT_RAW565 ? ICON_ALIGNMENT - 1 : 0;
    return ENTRY_SIZE + theme.palette.length + (theme.wallpaper ? theme.wallpaper.length : 0) + icons.reduce((sum, icon) => sum + icon.length, 0) + padding;
}

async function toPackedTheme(theme) {
    const prepared = await prepareTheme(theme);
    return {
        name: prepared.name,
        colors: theme.colors,
        variables: {
            defaultCircleLevel: prepared.defaultCircleLevel,
            isAppNameBackgroundHover: prepared.isAppNameBackgroundHover,
            iconFormat: prepared.iconFormat,
            isUpsilonBattery: prepared.isUpsilonBattery,
        },
        wallpaper: prepared.wallpaper ? bytesToBase64(prepared.wallpaper) : null,
        icons: Object.fromEntries(ICON_NAMES.flatMap((n, i) => (prepared.icons[i] ? [[n, bytesToBase64(prepared.icons[i])]] : []))),
    };
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

export { buildThemesBinary, themeSize, prepareTheme, toPackedTheme, unpackIcon, unpackWallpaper, ICON_NAMES, ICON_FORMAT_LZ4, ICON_FORMAT_RAW565, VERSION, HEADER_SIZE, THEMES_MAX_SIZE };
