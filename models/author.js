import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";

export const PSEUDO_PATTERN = /^[\p{L}\p{N}_.-]{3,15}$/u;

const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes in base64url

export const generateKey = () => randomBytes(32).toString("base64url");
export const isKeyFormat = (key) => typeof key === "string" && KEY_PATTERN.test(key);
export const hashKey = (key) => createHash("sha256").update(key).digest("hex");

const authorSchema = new mongoose.Schema(
    {
        pseudo: { type: String, required: true, trim: true, match: PSEUDO_PATTERN },
        keyHash: { type: String, required: true, unique: true, select: false },
    },
    { timestamps: true, collation: { locale: "en", strength: 2 } },
);

authorSchema.index({ pseudo: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

authorSchema.statics.findByKey = function (key) {
    if (!isKeyFormat(key)) return null;
    return this.findOne({ keyHash: hashKey(key) });
};

export const Author = mongoose.model("Author", authorSchema);
