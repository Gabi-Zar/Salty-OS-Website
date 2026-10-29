import nunjucks from "nunjucks";
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";

const SITE_URL = process.env.SITE_URL;
const LANGS = ["en", "fr"];
const DEFAULT_LANG = "en";

const format = (str, params) => str.replace(/\{(\w+)\}/g, (m, k) => params[k] ?? m);

async function buildPages() {
    const dicts = Object.fromEntries(await Promise.all(LANGS.map(async (lang) => [lang, JSON.parse(await readFile(`locales/${lang}.json`, "utf8"))])));
    const pages = await readdir("src/pages");

    for (const lang of LANGS) {
        const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(["src/pages", "src/templates"]), {
            autoescape: true,
            throwOnUndefined: true,
        });

        env.addGlobal("t", (key, params = {}) => {
            let value = dicts[lang][key];
            if (!value) {
                value = dicts[DEFAULT_LANG][key];
                if (!value) throw new Error(`missing key "${key}"`);
                console.warn(`[i18n] ${lang}: "${key}" missing, fall back to ${DEFAULT_LANG}`);
            }
            return format(value, params);
        });
        env.addGlobal("lang", lang);
        env.addGlobal("defaultLang", DEFAULT_LANG);
        env.addGlobal("langs", LANGS);
        env.addGlobal("prefix", lang === DEFAULT_LANG ? "" : `/${lang}`);
        env.addGlobal("siteUrl", SITE_URL);

        const outDir = lang === DEFAULT_LANG ? "public" : `public/${lang}`;
        if (lang !== DEFAULT_LANG) await rm(outDir, { recursive: true, force: true });
        await mkdir(outDir, { recursive: true });

        for (const page of pages) {
            const name = page.replace(".njk", "");
            const html = env.render(page, { pagePath: name === "index" ? "" : `/${name}` });
            await writeFile(`${outDir}/${name}.html`, html);
        }
    }
    console.log("[i18n] Pages build finished");
}

export { buildPages };
