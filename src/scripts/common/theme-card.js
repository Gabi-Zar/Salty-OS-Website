import { buildThemesBinary, themeSize, prepareTheme } from "./themes-utils.js";
import { userThemes, saveUserThemes, updateThemesInterface } from "./archive.js";
import { registerSimulator, loadThemeArea, selectTheme } from "./simulator.js";

export async function addThemeCards(grid, themes, isCurrent = () => true) {
    const themeCardTemplate = document.getElementById("theme-card-template");

    async function setupThemeCard(theme) {
        if (!isCurrent()) return;

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
        grid.appendChild(themeCardTemplateCopy);

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

    if (grid.childElementCount === 0) {
        await setupThemeCard(themes[0]);
        await Promise.all(themes.slice(1).map(setupThemeCard));
    } else {
        await Promise.all(themes.map(setupThemeCard));
    }
}
