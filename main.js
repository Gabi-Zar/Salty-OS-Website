import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { refreshCache } from "./themes-storage.js";
import { saltyOSDownload, epsilonDownload } from "./downloads-utils.js";
import { mkdir, rm } from "fs/promises";

import apiRoutes from "./routes/api.js";

const app = express();
const PORT = Number(process.env.PORT);
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const LANGS = ["en", "fr"];
const DEFAULT_LANG = "en";

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

const binLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode === 304,
});

const binOptions = {
    index: false,
    dotfiles: "ignore",
    etag: true,
    lastModified: true,
    maxAge: "1h",
    fallthrough: false,
};

if (!process.argv.includes("--dev")) {
    try {
        await rm("bin", { recursive: true, force: true });
        await mkdir("bin");
        await saltyOSDownload();
        await epsilonDownload();
    } catch (err) {
        console.error(err);
    }
}

if (TRUST_PROXY) {
    app.set("trust proxy", 1);
}

app.use(cookieParser());

app.get("/", (req, res, next) => {
    res.vary("Accept-Language");
    res.vary("Cookie");

    const lang = LANGS.includes(req.cookies.lang) ? req.cookies.lang : req.acceptsLanguages(LANGS) || DEFAULT_LANG;
    if (lang !== DEFAULT_LANG) return res.redirect(302, `/${lang}/`);
    next();
});

app.use(express.json());

app.use(express.static("public", { extensions: ["html"] }));
app.use(limiter);

app.use("/api", apiRoutes);
app.use("/bin", binLimiter, express.static("bin", binOptions));
app.get("/themes", (req, res) => res.redirect(301, "/themes/browse"));
app.get("/fr/themes", (req, res) => res.redirect(301, "/fr/themes/browse"));

await refreshCache();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
