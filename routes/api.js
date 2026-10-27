import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { ThemesCache } from "../themes-storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const simulatorPath = path.resolve(__dirname, "../epsilon.html");

const router = express.Router();

const publishLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

const simulatorLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

router.get("/get-themes", async (req, res) => {
    try {
        return res.status(200).json(ThemesCache);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/publish-theme", publishLimiter, async (req, res) => {
    try {
        return res.status(200).json({ message: "UwU" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

async function validateSimulatorCache(req, res, next) {
    try {
        const stat = await fs.stat(simulatorPath);

        res.set({
            "Last-Modified": stat.mtime.toUTCString(),
            ETag: `W/"${stat.size.toString(16)}-${stat.mtime.getTime().toString(16)}"`,
            "Cache-Control": "public, max-age=3600",
        });
        if (req.fresh) return res.status(304).end();
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

router.get("/get-simulator", validateSimulatorCache, simulatorLimiter, (req, res) => {
    try {
        res.sendFile(simulatorPath, { etag: false, lastModified: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
