import fs from "fs/promises";

const ThemesCache = await loadOrCreateThemesCache();

async function loadOrCreateThemesCache() {
    try {
        const object = JSON.parse(await fs.readFile("./themes.json", "utf-8"));
        console.log("cache loaded from disk");
        return object;
    } catch (err) {
        console.log("New cache created");
        return [];
    }
}

async function storeThemesCache(object) {
    try {
        console.log("writing cache to disk");
        await fs.writeFile("./themes.json", JSON.stringify(object));
    } catch (err) {
        console.log("Error while writing cache to disk", err);
    }
}

async function refreshCache() {
    if (JSON.stringify(ThemesCache) !== JSON.stringify(await loadOrCreateThemesCache())) {
        storeThemesCache(ThemesCache);
    }

    setTimeout(() => refreshCache(), 60 * 60 * 1000);
}

export { ThemesCache, refreshCache };
