import mongoose from "mongoose";
import { InvalidThemeError } from "../models/theme.js";

export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export function bearerToken(req) {
    return /^Bearer (\S+)$/.exec(req.get("authorization") ?? "")?.[1] ?? null;
}

export function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    if (err instanceof InvalidThemeError) return res.status(400).json({ message: err.message });
    if (err instanceof mongoose.Error.ValidationError) {
        const errors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.name === "CastError" ? `invalid value for ${e.path}` : e.message }));
        return res.status(400).json({ message: "Invalid theme", errors });
    }
    if (err.type === "entity.too.large") return res.status(413).json({ message: "Request too large" });
    if (err.type === "entity.parse.failed" || err.type === "encoding.unsupported" || err.type === "charset.unsupported") return res.status(400).json({ message: "Invalid JSON" });

    console.error(err);
    res.status(500).json({ message: "Server error" });
}
