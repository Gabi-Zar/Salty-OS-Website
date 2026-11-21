import { createHash, timingSafeEqual } from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { Theme } from "../models/theme.js";
import { invalidateThemesCache } from "../themes-cache.js";
import { HttpError, bearerToken } from "./http.js";
import { saltyOSDownload, epsilonDownload } from "../downloads-utils.js";

const router = express.Router();

const authFailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
});

function sha256(text) {
    return createHash("sha256").update(text).digest();
}

function adminOnly(req, res, next) {
    const token = process.env.ADMIN_TOKEN;
    if (!token) return next(new HttpError(404, "Not found"));

    const given = bearerToken(req);
    if (!given || !timingSafeEqual(sha256(given), sha256(token))) return next(new HttpError(401, "Unauthorized"));
    next();
}

const ID = /^[0-9a-f]{24}$/i;

router.use(authFailLimiter, adminOnly);

router.get("/themes", async (req, res) => {
    const isApproved = req.query.isApproved === "true";

    const themes = await Theme.find({ isApproved })
        .sort({ createdAt: isApproved ? -1 : 1 })
        .limit(limit);
    res.set("Cache-Control", "no-store").json(themes.map((theme) => ({ ...theme.toClient(), isApproved: theme.isApproved })));
});

router.post("/themes/:id/approve", async (req, res) => {
    if (!ID.test(req.params.id)) throw new HttpError(404, "Theme not found");

    const theme = await Theme.findById(req.params.id);
    if (!theme) throw new HttpError(404, "Theme not found");

    theme.status = "approved";
    await theme.save();
    invalidateThemesCache();
    res.json({ id: theme.id, name: theme.name, status: theme.status });
});

router.delete("/themes/:id", async (req, res) => {
    if (!ID.test(req.params.id)) throw new HttpError(404, "Theme not found");

    const theme = await Theme.findById(req.params.id).select("status");
    if (!theme) throw new HttpError(404, "Theme not found");

    await theme.deleteOne();
    if (theme.status === "approved") invalidateThemesCache();
    res.status(204).end();
});

router.get("/refresh-bin", async (req, res) => {
    await saltyOSDownload();
    await epsilonDownload();
    res.status(200).end();
});

export default router;
