import "dotenv/config";
import * as esbuild from "esbuild";
import { rm } from "fs/promises";
import { watch } from "fs";
import { buildPages } from "./i18n-build.js";
import { buildLz4hc } from "./lz4hc/build.js";

await rm("public/dist", { recursive: true, force: true });
await buildLz4hc();

const isWatching = process.argv.includes("--watch");

const options = {
    entryPoints: ["src/scripts/script.js"],
    outdir: "public/dist",
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: isWatching,
    minify: !isWatching,
    legalComments: "eof",
    logLevel: "info",
};

await buildPages();

if (isWatching) {
    const ctx = await esbuild.context(options);
    await ctx.watch();

    let timer;
    for (const dir of ["src/pages", "src/templates", "locales"]) {
        watch(dir, { recursive: true }, () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                buildPages().catch(console.error);
            }, 100);
        });
    }
} else {
    await esbuild.build(options);
}
