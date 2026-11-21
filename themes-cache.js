import { Theme } from "./models/theme.js";

const MAX_ENTRIES = 100;
const SORT_FIELDS = { date: "createdAt", name: "name", author: "pseudo" };

export const SORTS = Object.keys(SORT_FIELDS);

let cache = new Map();

export function invalidateThemesCache() {
    cache = new Map();
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function queryPage({ search, sort, order, offset, limit }) {
    const filter = { isApproved: true };
    if (search) {
        const pattern = new RegExp(escapeRegExp(search), "i");
        filter.$or = [{ name: pattern }, { pseudo: pattern }];
    }
    const direction = order === "asc" ? 1 : -1;

    const themes = await Theme.find(filter)
        .sort({ [SORT_FIELDS[sort]]: direction, _id: direction })
        .collation({ locale: "en", strength: 2 })
        .skip(offset)
        .limit(limit);
    return JSON.stringify(themes.map((theme) => theme.toClient()));
}

export function getApprovedThemesPage(params) {
    const key = JSON.stringify([params.search, params.sort, params.order, params.offset, params.limit]);
    let entry = cache.get(key);
    if (!entry) {
        const mine = cache;
        entry = queryPage(params).catch((err) => {
            mine.delete(key);
            throw err;
        });
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
        cache.set(key, entry);
    }
    return entry;
}
