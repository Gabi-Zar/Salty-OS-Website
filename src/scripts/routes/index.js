import { buildThemesBinary, themeSize, prepareTheme } from "../common/themes-utils.js";
import { userThemes, saveUserThemes, updateThemesInterface } from "../common/archive.js";
import { registerSimulator, loadThemeArea, selectTheme } from "../common/simulator.js";

export async function initIndex(serverThemes) {
    const themeCardTemplate = document.getElementById("theme-card-template");
    const latestThemesGrid = document.getElementById("latest-themes-grid");

    const themes = [...serverThemes].sort((a, b) => b["creation-date"].localeCompare(a["creation-date"])).slice(0, 4);

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

    await setupThemeCard(themes[0]);
    await Promise.all(themes.slice(1, 4).map(setupThemeCard));
}
