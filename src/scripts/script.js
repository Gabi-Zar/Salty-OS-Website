import { themeSize, prepareTheme } from "./common/themes-utils.js";
import { userThemes, updateThemesInterface } from "./common/archive.js";
import { initLangSwitcher } from "./common/lang-switcher.js";
import { initIndex } from "./routes/index.js";
import { initBrowse } from "./routes/browse.js";
import { initInstall } from "./routes/install.js";

import "./common/icons.js";

initLangSwitcher();

async function startup() {
    await Promise.all(
        userThemes.map(async (theme) => {
            updateThemesInterface(themeSize(await prepareTheme(theme)));
        }),
    );

    if (document.getElementById("latest-themes-grid")) {
        await initIndex();
    }

    if (document.getElementById("browse-grid")) {
        await initBrowse();
    }

    if (window.location.pathname.includes("install")) {
        await initInstall();
    }
}

startup();
