import "dotenv/config";
import * as esbuild from "esbuild";
import { rm } from "fs/promises";
import { watch } from "fs";
import { buildPages } from "./i18n-build.js";

await rm("public/dist", { recursive: true, force: true });

const isWatching = process.argv.includes("--watch");

const options = {
    entryPoints: ["src/scripts/script.js"],
    outdir: "public/dist",
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: isWatching,
    minify: !isWatching,
    logLevel: "info",
};

await buildPages();

if (isWatching) {
    const ctx = await esbuild.context(options);
    await ctx.watch();

    for (const dir of ["src/pages", "src/templates", "locales"]) {
        watch(dir, { recursive: true }, async () => {
            try {
                await buildPages();
            } catch {}
        });
    }
} else {
    await esbuild.build(options);
}
