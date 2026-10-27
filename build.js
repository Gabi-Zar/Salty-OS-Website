import * as esbuild from "esbuild";
import { rm } from "fs/promises";

try {
    await rm("public/dist", { recursive: true });
} catch {}

const watch = process.argv.includes("--watch");

const options = {
    entryPoints: ["src/script.js"],
    outdir: "public/dist",
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: watch,
    minify: !watch,
    logLevel: "info",
};

if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("esbuild: watching src/…");
} else {
    await esbuild.build(options);
}
