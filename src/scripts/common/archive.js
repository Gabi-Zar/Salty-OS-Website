import { HEADER_SIZE, THEMES_MAX_SIZE } from "./themes-utils.js";
import { archiveIconAnimation } from "./icons.js";

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

export const userThemes = localStorage.getItem("userThemes") ? JSON.parse(localStorage.getItem("userThemes")) : [];
let totalThemesSize = HEADER_SIZE;
themesSizeText.innerText = `${(totalThemesSize / 1024).toFixed(1)} / ${THEMES_MAX_SIZE / 1024} KiB`;

export function saveUserThemes() {
    localStorage.setItem("userThemes", JSON.stringify(userThemes));
}

export function updateThemesInterface(size) {
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
