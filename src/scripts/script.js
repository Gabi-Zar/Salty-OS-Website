import { buildThemesBinary, themeSize, prepareTheme, HEADER_SIZE, THEMES_MAX_SIZE } from "./themes-utils.js";
import Cookies from "js-cookie";

const simulators = new Map();
let nextId = 1;

const badge = document.getElementById("archive-counter");
const counter = {
    get() {
        return parseInt(badge.textContent) || 0;
    },
    set(value) {
        badge.textContent = value;
        badge.classList.toggle("hidden", value <= 0);
    },
    increment(step = 1) {
        this.set(this.get() + step);
    },
};

const themesSizeBarContainer = document.getElementById("themes-size-bar-container");
const themesSizeBar = document.getElementById("themes-size-bar");
const themesSizeText = document.getElementById("themes-size-text");

let userThemes = localStorage.getItem("userThemes") ? JSON.parse(localStorage.getItem("userThemes")) : [];
console.log(userThemes);
let totalThemesSize = HEADER_SIZE;
themesSizeText.innerText = `${(totalThemesSize / 1024).toFixed(1)} / ${THEMES_MAX_SIZE / 1024} KiB`;

const archiveIcon = document.getElementById("archive-icon");
const archiveIconAnimation = lottie.loadAnimation({ container: archiveIcon, renderer: "svg", loop: false, autoplay: false, path: "https://useanimations.com/icons/archive.json" });
archiveIcon.addEventListener("mouseenter", () => {
    archiveIconAnimation.setDirection(1);
    archiveIconAnimation.play();
});
archiveIcon.addEventListener("mouseleave", () => {
    archiveIconAnimation.setDirection(-1);
    archiveIconAnimation.play();
});

const langSwitcher = document.querySelector(".lang-switcher");
const trigger = langSwitcher.querySelector(".lang-trigger");
const dropdown = langSwitcher.querySelector(".lang-dropdown");
const options = dropdown.querySelectorAll(".lang-option");

let isOpen = false;

function toggleDropdown() {
    isOpen = !isOpen;
    trigger.setAttribute("aria-expanded", isOpen.toString());
    dropdown.classList.toggle("open", isOpen);
}

trigger.addEventListener("click", (e) => {
    e.preventDefault();
    toggleDropdown();
});

for (const option of options) {
    option.addEventListener("click", (e) => {
        e.stopPropagation();

        const text = option.querySelector("span").textContent;

        for (const option of options) {
            option.classList.remove("selected");
        }
        option.classList.add("selected");
        document.getElementById("selected-lang").textContent = text;

        console.log(text);

        switch (text) {
            case "English":
                Cookies.set("lang", "en");
                window.location.replace(`${window.location.origin}${window.location.pathname.replace("/fr", "")}`);
                break;
            case "Français":
                Cookies.set("lang", "fr");
                window.location.replace(`${window.location.origin}/fr${window.location.pathname}`);
                break;
        }

        toggleDropdown();
    });
}

function animateGithubIcon(id) {
    const githubIcon = document.getElementById(id);
    const githubIconAnimation = lottie.loadAnimation({ container: githubIcon, renderer: "svg", loop: true, autoplay: false, path: "https://useanimations.com/icons/github.json" });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let stopAfterCycle = false;
    githubIconAnimation.addEventListener("loopComplete", () => {
        if (stopAfterCycle) {
            stopAfterCycle = false;
            githubIconAnimation.goToAndStop(0, true);
        }
    });
    githubIcon.addEventListener("mouseenter", () => {
        stopAfterCycle = false;
        if (!motion.matches) githubIconAnimation.play();
    });
    githubIcon.addEventListener("mouseleave", () => {
        stopAfterCycle = !motion.matches && !githubIconAnimation.isPaused;
        if (!stopAfterCycle) githubIconAnimation.goToAndStop(0, true);
    });
}

window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return;
    const simulator = simulators.get(e.source);
    if (!simulator) return;
    if (e.data?.type === "salty:ready") {
        simulator.resolveReady();
    } else if (e.data?.id && simulator.pending.has(e.data.id)) {
        simulator.pending.get(e.data.id)(e.data);
        simulator.pending.delete(e.data.id);
    }
});

async function displayLatestThemes(themes) {
    const themeCardTemplate = document.getElementById("theme-card-template");
    const latestThemesGrid = document.getElementById("latest-themes-grid");

    themes = themes.sort((a, b) => b["creation-date"].localeCompare(a["creation-date"])).slice(0, 4);

    async function setupThemeCard(theme) {
        const themeCardTemplateCopy = themeCardTemplate.content.cloneNode(true);
        const iframe = themeCardTemplateCopy.getElementById("simulator");
        const button = themeCardTemplateCopy.getElementById("button");

        button.addEventListener("click", async () => {
            const size = themeSize(await prepareTheme(theme));
            if (updateThemesInterface(size)) {
                userThemes.push(theme);
                localStorage.setItem("userThemes", JSON.stringify(userThemes));
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

function updateThemesInterface(size) {
    if (totalThemesSize + size > THEMES_MAX_SIZE) {
        themesSizeBar.classList.add("full");
        themesSizeBarContainer.classList.add("full");
        themesSizeText.classList.add("full");
        setTimeout(() => {
            themesSizeBar.classList.remove("full");
            themesSizeBarContainer.classList.remove("full");
            themesSizeText.classList.remove("full");
        }, 300);
        return false;
    } else {
        archiveIconAnimation.setDirection(1);
        archiveIconAnimation.play();
        setTimeout(() => {
            archiveIconAnimation.setDirection(-1);
            archiveIconAnimation.play();
        }, 200);
        counter.increment();
        totalThemesSize += size;

        themesSizeText.innerText = `${(totalThemesSize / 1024).toFixed(1)} / ${THEMES_MAX_SIZE / 1024} KiB`;
        themesSizeBar.style.width = `${(totalThemesSize / THEMES_MAX_SIZE) * 100}%`;
        return true;
    }
}

function registerSimulator(iframe) {
    let resolveReady;
    const ready = new Promise((resolve) => (resolveReady = resolve));
    const simulator = { iframe, ready, resolveReady, pending: new Map() };
    simulators.set(iframe.contentWindow, simulator);
    return simulator;
}

function call(simulator, type, payload) {
    return simulator.ready.then(
        () =>
            new Promise((resolve) => {
                const id = nextId++;
                simulator.pending.set(id, resolve);
                simulator.iframe.contentWindow.postMessage({ type, id, ...payload }, window.location.origin);
            }),
    );
}

function loadThemeArea(simulator, bin) {
    const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
    return call(simulator, "salty:loadThemeArea", { data: buffer }, [buffer]);
}

function selectTheme(simulator, index) {
    call(simulator, "salty:selectTheme", { index });
}

async function startup() {
    const res = await fetch("/api/get-themes");
    if (!res.ok) {
        throw new Error(`unable to fetch themes from server. Status: ${res.status}`);
    }

    const serverThemes = await res.json();
    console.log(serverThemes);

    await Promise.all(
        userThemes.map(async (theme) => {
            updateThemesInterface(themeSize(await prepareTheme(theme)));
        }),
    );

    if (document.getElementById("latest-themes-grid")) {
        await displayLatestThemes(serverThemes);
    }
}

animateGithubIcon("github-icon-1");
animateGithubIcon("github-icon-2");
startup();
