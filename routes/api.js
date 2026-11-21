import express from "express";
import { rateLimit } from "express-rate-limit";
import { Author, PSEUDO_PATTERN, generateKey, hashKey } from "../models/author.js";
import { Theme } from "../models/theme.js";
import { SORTS, getApprovedThemesPage, invalidateThemesCache } from "../themes-cache.js";
import { HttpError, bearerToken, errorHandler } from "./http.js";
import adminRoutes from "./admin.js";

const router = express.Router();

const limiterOptions = { standardHeaders: "draft-8", legacyHeaders: false };

const accountLimiter = rateLimit({ ...limiterOptions, windowMs: 24 * 60 * 60 * 1000, limit: 5 });
const publishLimiter = rateLimit({ ...limiterOptions, windowMs: 24 * 60 * 60 * 1000, limit: 5 });
const authFailLimiter = rateLimit({
    ...limiterOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
});

const ID = /^[0-9a-f]{24}$/i;

async function authorFromKey(req) {
    const key = bearerToken(req);
    if (!key) throw new HttpError(401, "A key is required (Authorization: Bearer <key>)");
    const author = await Author.findByKey(key);
    if (!author) throw new HttpError(401, "Invalid key");
    return author;
}

const summary = (theme) => ({ id: theme.id, name: theme.name, isApproved: theme.isApproved, createdAt: theme.createdAt });

function intParam(value, min, max, fallback) {
    value = Number(value);
    if (!Number.isInteger(value) || value < min || value > max) return fallback;
    return value;
}

router.get("/get-themes", async (req, res) => {
    const { search = "", sort = "date", order } = req.query;
    if (search.length > 15) throw new HttpError(400, "search must be 15 characters at most");
    if (!SORTS.includes(sort)) throw new HttpError(400, `sort must be one of: ${SORTS.join(", ")}`);
    const direction = order ?? (sort === "date" ? "desc" : "asc");
    if (direction !== "asc" && direction !== "desc") throw new HttpError(400, "order must be asc or desc");

    const body = await getApprovedThemesPage({
        search: search.trim(),
        sort,
        order: direction,
        offset: intParam(req.query.offset, 0, 1000000, 0),
        limit: intParam(req.query.limit, 1, 50, 20),
    });
    res.set({ "Cache-Control": "no-cache" }).type("application/json").send(body);
});

router.post("/create-account", accountLimiter, express.json({ limit: "1kb" }), async (req, res) => {
    const { pseudo } = req.body ?? {};
    const wanted = typeof pseudo === "string" ? pseudo.trim().normalize("NFKC") : "";
    if (!PSEUDO_PATTERN.test(wanted)) throw new HttpError(400, "The pseudo must be 3 to 15 letters, digits, '_', '.' or '-'");

    const taken = new HttpError(409, "This pseudo is already taken");
    if (await Author.exists({ pseudo: wanted })) throw taken;

    const key = generateKey();
    try {
        await Author.create({ pseudo: wanted, keyHash: hashKey(key) });
    } catch (err) {
        if (err?.code === 11000) throw taken;
        throw err;
    }
    res.status(201).json({ pseudo: wanted, key });
});

router.post("/publish-theme", publishLimiter, authFailLimiter, express.json({ limit: "1mb" }), async (req, res) => {
    const author = await authorFromKey(req);

    const theme = Theme.fromPayload(req.body?.theme, author);
    await theme.validate();

    try {
        await theme.save();
    } catch (err) {
        if (err?.code === 11000) throw new HttpError(409, `A theme named "${theme.name}" already exists`);
        throw err;
    }

    res.status(201).json(summary(theme));
});

router.get("/me", authFailLimiter, async (req, res) => {
    const author = await authorFromKey(req);
    res.set("Cache-Control", "no-store").json({ pseudo: author.pseudo });
});

router.get("/my-themes", authFailLimiter, async (req, res) => {
    const author = await authorFromKey(req);
    const themes = await Theme.find({ authorId: author._id }).select("name isApproved createdAt").sort({ createdAt: -1 });
    res.set("Cache-Control", "no-store").json({ pseudo: author.pseudo, themes: themes.map(summary) });
});

router.delete("/themes/:id", authFailLimiter, async (req, res) => {
    const author = await authorFromKey(req);
    if (!ID.test(req.params.id)) throw new HttpError(404, "Theme not found");

    const theme = await Theme.findOne({ _id: req.params.id, authorId: author._id }).select("isApproved");
    if (!theme) throw new HttpError(404, "Theme not found");

    await theme.deleteOne();
    if (theme.isApproved) invalidateThemesCache();
    res.status(204).end();
});

router.delete("/account", authFailLimiter, async (req, res) => {
    const author = await authorFromKey(req);

    const approved = await Theme.exists({ authorId: author._id, status: "approved" });
    await Theme.deleteMany({ authorId: author._id });
    await Author.deleteOne({ _id: author._id });

    if (approved) invalidateThemesCache();
    res.status(204).end();
});

router.use("/admin", adminRoutes);
router.use(errorHandler);

export default router;
