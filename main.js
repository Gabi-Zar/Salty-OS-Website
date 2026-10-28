import "dotenv/config";
import express from "express";
import apiRoutes from "./routes/api.js";
import { rateLimit } from "express-rate-limit";
import { refreshCache } from "./themes-storage.js";
import { writeFile } from "fs/promises";

const app = express();
const PORT = Number(process.env.PORT);
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

let downloadedVersion = "";

async function verifySimulatorUpdate() {
    const res = await fetch("https://api.github.com/repos/SaltyMold/Salty-OS/releases");

    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`);
    }

    const releases = await res.json();
    const release = releases.find((r) => !r.prerelease && !r.draft);

    if (release.tag_name !== downloadedVersion) {
        const simulatorRes = await fetch(release.assets.find((asset) => asset.name === "epsilon.html").browser_download_url);
        if (!simulatorRes.ok) {
            throw new Error(`GitHub download error: ${simulatorRes.status}`);
        }

        let text = await simulatorRes.text();
        text = text.replace("var SALTY_ALLOWED_ORIGINS = [];", `var SALTY_ALLOWED_ORIGINS = ["${process.env.SALTY_ALLOWED_ORIGIN}"];`);

        await writeFile("./epsilon.html", text, "utf-8");

        downloadedVersion = release.tag_name;
        setTimeout(() => verifySimulatorUpdate(), 24 * 60 * 60 * 1000);
    }
}

try {
    await verifySimulatorUpdate();
} catch (err) {
    console.error(err);
}

if (TRUST_PROXY) {
    app.set("trust proxy", 1);
}

app.use(express.json());

app.use(express.static("public", { extensions: ["html"] }));
app.use(limiter);

app.use("/api", apiRoutes);

await refreshCache();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
