import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { ICON_FORMAT_LZ4, ICON_FORMAT_RAW565, ICON_NAMES, VERSION, unpackIcon, unpackWallpaper } from "../src/scripts/common/themes-utils.js";

const HEX = /^[0-9a-f]{6}$/;

export class InvalidThemeError extends Error {}

function flattenColors(section) {
    if (!section || typeof section !== "object" || Array.isArray(section)) throw new TypeError("colors must be an object");

    const out = [];
    for (const [key, value] of Object.entries(section)) {
        if (key.startsWith("_")) continue;
        if (value && typeof value === "object") {
            for (const [sub, v] of Object.entries(value)) if (!sub.startsWith("_")) out.push([key + sub, v]);
        } else out.push([key, value]);
    }
    return out;
}

function normalizeColors(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new InvalidThemeError("colors must be an object");
    const clean = (v) => (typeof v === "string" && !v.startsWith("@") ? v.replace(/^(?:#|0x)/i, "").toLowerCase() : v);
    return Object.fromEntries(flattenColors(raw).map(([name, value]) => [name, clean(value)]));
}

const DEFAULT_SLOTS = flattenColors(JSON.parse(readFileSync(new URL("./epsilon.json", import.meta.url), "utf8")).colors);
const SLOT_INDEX = new Map(DEFAULT_SLOTS.map(([name], i) => [name, i]));

function validColors(colors) {
    for (const [name, value] of colors) {
        const slot = SLOT_INDEX.get(name);
        if (slot === undefined) throw new Error(`Unknown color ${name}`);
        if (value.startsWith("@")) {
            const target = SLOT_INDEX.get(value.slice(1));
            if (target === undefined || target >= slot) throw new Error(`${name}: ${value} must point to a color that comes before it`);
        } else if (!HEX.test(value)) throw new Error(`${name}: ${value} is not RRGGBB`);
    }
    return true;
}

function blob(unpack) {
    return {
        type: Buffer,
        validate: {
            validator(value) {
                unpack(value, this.data?.variables?.iconFormat);
                return true;
            },
        },
    };
}

const themeSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, match: [/^[\x20-\x7E]{1,15}$/, "1 to 15 ASCII characters"] },

        authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Author", required: true, index: true },
        pseudo: { type: String, required: true },

        formatVersion: { type: Number, default: VERSION },

        data: {
            variables: {
                defaultCircleLevel: { type: Number, default: 0, min: 0, max: 7, validate: Number.isInteger },
                isAppNameBackgroundHover: { type: Number, default: 0, min: 0, max: 1, validate: Number.isInteger },
                iconFormat: { type: Number, default: ICON_FORMAT_RAW565, min: ICON_FORMAT_LZ4, max: ICON_FORMAT_RAW565, validate: Number.isInteger },
                isUpsilonBattery: { type: Number, default: 0, min: 0, max: 1, validate: Number.isInteger },
            },
            colors: { type: Map, of: String, validate: { validator: validColors } },
            wallpaper: blob(unpackWallpaper),
            icons: Object.fromEntries(ICON_NAMES.map((n) => [n, blob(unpackIcon)])),
        },

        isApproved: { type: Boolean, default: false },
    },
    { timestamps: true },
);

themeSchema.index({ isApproved: 1, createdAt: -1 });
themeSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

themeSchema.statics.fromPayload = function (payload, author) {
    const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    if (!isObject(payload)) throw new InvalidThemeError("theme must be an object");
    if (typeof payload.name !== "string") throw new InvalidThemeError("name must be a string");
    if (payload.variables != null && !isObject(payload.variables)) throw new InvalidThemeError("variables must be an object");
    if (payload.icons != null && !isObject(payload.icons)) throw new InvalidThemeError("icons must be an object");

    const toBuffer = (value) => {
        if (value == null) return undefined;
        if (typeof value !== "string") throw new InvalidThemeError("images must be base64 strings");
        return Buffer.from(value, "base64");
    };

    return new this({
        name: payload.name,
        authorId: author._id,
        pseudo: author.pseudo,
        data: {
            variables: payload.variables,
            colors: normalizeColors(payload.colors),
            wallpaper: toBuffer(payload.wallpaper),
            icons: Object.fromEntries(ICON_NAMES.filter((n) => payload.icons?.[n]).map((n) => [n, toBuffer(payload.icons[n])])),
        },
    });
};

themeSchema.methods.toClient = function () {
    const { variables, colors, wallpaper, icons } = this.data;
    return {
        id: this.id,
        name: this.name,
        pseudo: this.pseudo,
        createdAt: this.createdAt.toISOString(),
        colors: Object.fromEntries(colors ?? []),
        variables: {
            defaultCircleLevel: variables.defaultCircleLevel,
            isAppNameBackgroundHover: variables.isAppNameBackgroundHover,
            iconFormat: variables.iconFormat,
            isUpsilonBattery: variables.isUpsilonBattery,
        },
        wallpaper: wallpaper ? wallpaper.toString("base64") : null,
        icons: Object.fromEntries(ICON_NAMES.filter((n) => icons[n]).map((n) => [n, icons[n].toString("base64")])),
    };
};

export const Theme = mongoose.model("Theme", themeSchema);
