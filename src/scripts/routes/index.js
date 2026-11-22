import { addThemeCards } from "../common/theme-card.js";

export async function initIndex() {
    const res = await fetch("/api/get-themes?limit=4");
    if (!res.ok) {
        throw new Error(`unable to fetch themes from server. Status: ${res.status}`);
    }

    await addThemeCards(document.getElementById("latest-themes-grid"), await res.json());
}
