import express from "express";
import { rateLimit } from "express-rate-limit";
import { ThemesCache } from "../themes-storage.js";

const router = express.Router();

const publishLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 5,
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

export default router;
