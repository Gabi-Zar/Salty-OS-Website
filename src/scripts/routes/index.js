import { buildThemesBinary, themeSize, prepareTheme } from "../common/themes-utils.js";
import { userThemes, saveUserThemes, updateThemesInterface } from "../common/archive.js";
import { registerSimulator, loadThemeArea, selectTheme } from "../common/simulator.js";

export async function initIndex() {
    const res = await fetch("/api/get-themes?limit=4");
    if (!res.ok) {
        throw new Error(`unable to fetch themes from server. Status: ${res.status}`);
    }

    const themes = await res.json();

    const themeCardTemplate = document.getElementById("theme-card-template");
    const latestThemesGrid = document.getElementById("latest-themes-grid");

    async function setupThemeCard(theme) {
        const themeCardTemplateCopy = themeCardTemplate.content.cloneNode(true);
        const iframe = themeCardTemplateCopy.getElementById("simulator");
        const button = themeCardTemplateCopy.getElementById("button");

        button.addEventListener("click", async () => {
            const size = themeSize(await prepareTheme(theme));
            if (updateThemesInterface(size)) {
                userThemes.push(theme);
                saveUserThemes();
            }
        });

        themeCardTemplateCopy.getElementById("title").appendChild(document.createTextNode(theme.name));
        themeCardTemplateCopy.getElementById("author").appendChild(document.createTextNode(theme.pseudo));
        latestThemesGrid.appendChild(themeCardTemplateCopy);

        iframe.src = iframe.dataset.src;

        const simulator = registerSimulator(iframe);
        const bin = await buildThemesBinary([theme]);
        const result = await loadThemeArea(simulator, bin);
        if (result.code !== 0) {
            console.error(`Theme "${theme.name}" rejected, code`, result.code);
            return;
        }
        selectTheme(simulator, 1);
    }

    if (themes.length === 0) return;

    await setupThemeCard(themes[0]);
    await Promise.all(themes.slice(1, 4).map(setupThemeCard));
}
