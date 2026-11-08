import { buildThemesBinary, themeSize, prepareTheme, HEADER_SIZE, THEMES_MAX_SIZE } from "./themes-utils.js";
import Cookies from "js-cookie";
import Numworks from "salty-os.js";

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
            if (option.classList.contains("selected")) {
                if (text === document.getElementById("selected-lang").textContent) {
                    toggleDropdown();
                    return;
                }
                option.classList.remove("selected");
            }
        }
        option.classList.add("selected");
        document.getElementById("selected-lang").textContent = text;

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

async function wait(ms) {
    await new Promise((r) => setTimeout(r, ms));
}
function hex(number) {
    if (!Number.isFinite(number)) return;
    return "0x" + number.toString(16).toUpperCase();
}

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

async function startInstallSection() {
    const root = document.getElementById("install");
    const i18n = document.getElementById("install-i18n").dataset;

    function setState(state) {
        root.dataset.state = state;
    }
    function setInfo(key, value, status) {
        const element = document.querySelector(`[data-info="${key}"]`);
        if (!element) return;
        element.textContent = value ?? "—";
        if (status) element.dataset.status = status;
    }
    function parseOS(slot) {
        if (slot.saltyOS?.installed) return "SaltyOS";
        if (slot.upsilon?.installed) return "Upsilon";
        if (slot.omega?.installed) return "Omega";
        if ("epsilon" in slot) return "Epsilon";
    }
    function parseVersion(slot) {
        if (slot.saltyOS?.installed) return `${slot.saltyOS.version} - ${slot.saltyOS.commit}`;
        if (slot.upsilon?.installed) return slot.upsilon.version;
        if (slot.omega?.installed) return slot.omega.version;
        return slot.version;
    }
    function isUnlocked(info, calculator) {
        if (
            ["Upsilon Bootloader", "Upsilon Calculator"].includes(calculator.device.device_.productName) ||
            parseOS(info.slotA) !== "Epsilon" ||
            ["Omega", "Upsilon"].includes(parseOS(info.slotB) || info.slot.name === "Bootloader")
        ) {
            return true;
        }
        return false;
    }
    function parseUsername(slot) {
        if (slot.omega?.user) return slot.omega.user;
        if (slot.epsilon?.username) return slot.epsilon.username;
        return "";
    }
    function parseDfuFile(buffer) {
        const dv = new DataView(buffer);

        if (dv.getUint32(0) !== 0x44667553) {
            throw new Error("Not a valid DfuSe file");
        }

        let offset = 11;
        const targets = dv.getUint8(10);
        const elements = [];

        for (let t = 0; t < targets; t++) {
            const sig = new TextDecoder().decode(new Uint8Array(buffer.slice(offset, offset + 6)));
            if (sig !== "Target") {
                throw new Error(`Invalid target signature: ${sig}`);
            }

            const targetSize = dv.getUint32(offset + 266, true);
            const nbElements = dv.getUint32(offset + 270, true);

            let pos = offset + 274;

            for (let e = 0; e < nbElements; e++) {
                const address = dv.getUint32(pos, true);
                const size = dv.getUint32(pos + 4, true);

                if (pos + 8 + size > buffer.byteLength) {
                    throw new Error(`Element ${e} exceeds file bounds`);
                }

                elements.push({
                    address,
                    buffer: buffer.slice(pos + 8, pos + 8 + size),
                });
                pos += 8 + size;
            }

            offset += 274 + targetSize;
        }

        return elements;
    }

    function buildFlashLayout(info) {
        function toMiB(bites) {
            return bites / (1024 * 1024);
        }

        const segments = [];

        const extappsAMax = info.slotB.saltyOS?.installed ? 2.5 - toMiB(info.slotB.saltyOS.themesArea.B.size) : info.slotB.valid ? 2.5 : info.slotA.saltyOS?.installed ? 5 : 6.5;
        const extappsASize = Math.min(toMiB(info.slotA.external?.flashSize).toFixed(1), extappsAMax);
        const extappsBMax = info.slotA.saltyOS?.installed ? 2.5 - toMiB(info.slotA.saltyOS.themesArea.A.size) : info.slotA.valid ? 2.5 : info.slotB.saltyOS?.installed ? 5 : 6.5;
        const extappsBSize = Math.min(toMiB(info.slotB.external?.flashSize).toFixed(1), extappsBMax);

        if (info.slotA.valid) segments.push({ type: parseOS(info.slotA).toLowerCase(), name: `A-${parseOS(info.slotA)}`, sizeMB: 1.5 });
        else segments.push({ type: "free", name: i18n.segFree, sizeMB: 1.5 });
        if (info.slotA.external?.flashSize > 0) {
            segments.push({ type: "extapps", name: `A-${i18n.segExtapps}`, sizeMB: extappsASize });
            if (extappsASize < extappsAMax) segments.push({ type: "free", name: i18n.segFree, sizeMB: extappsAMax - extappsASize });
        } else segments.push({ type: "free", name: i18n.segFree, sizeMB: extappsAMax });
        if (info.slotB.saltyOS?.installed) segments.push({ type: "themes", name: `B-${i18n.segThemes}`, sizeMB: toMiB(info.slotB.saltyOS.themesArea.B.size) });

        if (info.slotB.valid) segments.push({ type: parseOS(info.slotB).toLowerCase(), name: `B-${parseOS(info.slotB)}`, sizeMB: 1.5 });
        else segments.push({ type: "free", name: i18n.segFree, sizeMB: extappsAMax > 2.5 ? 0 : 1.5 });
        if (info.slotB.external?.flashSize > 0) {
            segments.push({ type: "extapps", name: `B-${i18n.segExtapps}`, sizeMB: extappsBSize });
            if (extappsBSize < extappsBMax) segments.push({ type: "free", name: i18n.segFree, sizeMB: extappsBMax - extappsBSize });
        } else segments.push({ type: "free", name: i18n.segFree, sizeMB: extappsAMax > 2.5 ? 0 : extappsBMax });
        if (info.slotA.saltyOS?.installed) segments.push({ type: "themes", name: `A-${i18n.segThemes}`, sizeMB: toMiB(info.slotA.saltyOS.themesArea.A.size) });

        const bar = document.getElementById("flash-bar");
        const template = document.getElementById("flash-seg-template");
        bar.replaceChildren();

        for (let i = 0; i < segments.length; i++) {
            while (segments[i].type === segments[i + 1]?.type) {
                segments[i].sizeMB += segments[i + 1].sizeMB;
                segments.splice(i + 1, 1);
            }
            const node = template.content.firstElementChild.cloneNode(true);
            node.classList.add(`seg--${segments[i].type}`);
            node.classList.toggle("is-tiny", segments[i].sizeMB.toFixed(1) <= 0.2);
            node.style.setProperty("--seg-size", segments[i].sizeMB.toFixed(1));
            node.querySelector(".flash-seg-size").textContent = `${segments[i].sizeMB.toFixed(1)}MiB`;
            node.querySelector(".flash-seg-name").textContent = segments[i].name;
            bar.append(node);
        }
    }

    function updateInstallInterface(model, info) {
        const state = isUnlocked(info, calculator);

        const connectButton = document.getElementById("install-connect");
        if (!state && info.slot.name === "A") connectButton.classList.add("hidden");
        else connectButton.classList.remove("hidden");

        setInfo("model", `N${model} - ${state ? i18n.unlocked : i18n.locked}`);
        setInfo("activeSlot", info.slot.name);
        for (const slotID of ["slotA", "slotB"]) {
            const slot = info[slotID];
            const slotChar = slotID.charAt(4);
            setInfo(`${slotID}.valid`, slot.valid ? i18n.valid : i18n.invalid);
            setInfo(`${slotID}.os`, parseOS(slot));
            setInfo(`${slotID}.kernelVersion`, slot.version);
            setInfo(`${slotID}.patch`, slot.commit);
            setInfo(`${slotID}.kernelAddress`, hex(slot.kernelHeaderAddress));
            setInfo(`${slotID}.userlandVersion`, parseVersion(slot));
            setInfo(`${slotID}.userlandAddress`, hex(slot.userlandHeaderAddress));
            setInfo(`${slotID}.storageAddress`, hex(slot.storage?.address));
            if (slot.storage?.size > 0) {
                setInfo(`${slotID}.storageSize`, `${(slot.storage?.size / 1024).toFixed(0)}KiB`);
            } else {
                setInfo(`${slotID}.storageSize`, undefined);
            }
            if (slot.external?.flashSize > 0) {
                setInfo(`${slotID}.range.extapps`, `${hex(slot.external.flashStart)}-${hex(slot.external.flashEnd)}`);
                setInfo(`${slotID}.size.extapps`, `${(slot.external.flashSize / 1024).toFixed(0)}KiB`);
            } else {
                setInfo(`${slotID}.range.extapps`, undefined);
                setInfo(`${slotID}.size.extapps`, undefined);
            }
            if (slot.external?.ramSize > 0) {
                setInfo(`${slotID}.range.ram`, `${hex(slot.external.ramStart)}-${hex(slot.external.ramEnd)}`);
                setInfo(`${slotID}.size.ram`, `${(slot.external.ramSize / 1024).toFixed(0)}KiB`);
            } else {
                setInfo(`${slotID}.range.ram`, undefined);
                setInfo(`${slotID}.size.ram`, undefined);
            }
            if ("epsilon" in slot) {
                setInfo(`${slotID}.range.username`, `${hex(slot.epsilon.usernameStart)}-${hex(slot.epsilon.usernameEnd)}`);
                setInfo(`${slotID}.size.username`, `${(slot.epsilon.usernameSize / 1024).toFixed(0)}KiB`);
            } else {
                setInfo(`${slotID}.range.username`, undefined);
                setInfo(`${slotID}.size.username`, undefined);
            }
            if (slot.saltyOS?.installed) {
                setInfo(`${slotID}.range.themes`, `${hex(slot.saltyOS.themesArea[slotChar].start)}-${hex(slot.saltyOS.themesArea[slotChar].end)}`);
                setInfo(`${slotID}.size.themes`, `${(slot.saltyOS.themesArea[slotChar].size / 1024).toFixed(0)}KiB`);
            } else {
                setInfo(`${slotID}.range.themes`, undefined);
                setInfo(`${slotID}.size.themes`, undefined);
            }

            const card = document.querySelector(`.install-slot[data-slot="${slotChar}"]`);
            card.classList.toggle("is-active", slotID.includes(info.slot.name));
            card.classList.toggle("is-invalid", !slot.valid);
            document.querySelector(`[data-info="${slotID}.active"]`).classList.toggle("hidden", !slotID.includes(info.slot.name));

            const usernameInput = document.getElementById(`install-username-${slotChar}`);
            usernameInput.disabled = false;
            usernameInput.value = parseUsername(slot);
            const usernameButton = document.getElementById(`install-username-button-${slotChar}`);
            usernameButton.disabled = false;
            usernameButton.title = "";
            usernameButton.addEventListener("click", async () => {
                await calculator.writeUsername(slotChar, usernameInput.value);
                updateInstallInterface(model, await calculator.getPlatformInfo());
            });

            const versionMajor = Number(slot.version?.slice(0, 2)) || 0;
            if (versionMajor < 22) {
                usernameInput.disabled = true;
                usernameButton.disabled = true;
                usernameButton.title = i18n.noUsername;
                if (slot.omega?.installed) {
                    usernameButton.title = i18n.noOmegaUsername;
                }
            }

            buildFlashLayout(info);

            const select = document.getElementById(`install-select-${slotChar}`);
            const trigger = select.querySelector(".install-select-trigger");
            const dropdown = select.querySelector(".install-select-dropdown");
            const options = [...dropdown.querySelectorAll(".install-select-option")];
            const installButton = document.getElementById(`install-button-${slotChar}`);

            const reasons = { salty: null, ablauncher: null, saltyKernel: null, saltyBig: null, epsilon: null, uninstall: null, erase: null };

            if (slotChar === "A" && !state) {
                reasons.salty = i18n.saltyLocked;
                reasons.uninstall = i18n.saltyLocked;
                reasons.erase = i18n.saltyLocked;
                reasons.epsilon = i18n.saltyLocked;
            } else if (info.slot.name === slotChar) {
                reasons.salty = i18n.saltyBadslot;
                reasons.saltyKernel = i18n.saltyBadslot;
                reasons.saltyBig = i18n.saltyBadslot;
                reasons.erase = i18n.saltyBadslot;
                reasons.uninstall = i18n.saltyBadslot;
                reasons.epsilon = i18n.saltyBadslot;
            }
            if (!state || model !== "0110") {
                reasons.saltyKernel = i18n.kernelLocked;
                reasons.saltyBig = i18n.kernelLocked;
            }
            if (slotChar === "B") reasons.saltyBig = i18n.wrongSlot;

            reasons.ablauncher = "Not implemented now";
            if (versionMajor < 20) reasons.ablauncher = i18n.noExtApps;

            function refreshInstallControls() {
                for (const option of options) {
                    const reason = reasons[option.dataset.value];
                    option.classList.toggle("disabled", reason !== null);
                    option.classList.toggle("selected", option.dataset.value === select.dataset.value);
                    option.setAttribute("aria-disabled", String(reason !== null));
                    option.title = reason ?? "";
                }
                const current = options.find((option) => option.dataset.value === select.dataset.value);
                trigger.querySelector(".install-select-label").textContent = current.textContent;

                const reason = reasons[select.dataset.value];
                installButton.disabled = reason !== null;
                installButton.title = reason ?? "";
            }

            const firstAvailable = options.find((option) => reasons[option.dataset.value] === null);
            if (reasons[select.dataset.value] !== null && firstAvailable) {
                select.dataset.value = firstAvailable.dataset.value;
            }
            refreshInstallControls();

            const slotAddress = slotChar === "A" ? 0x90000000 : 0x90400000;
            const userlandAddress = slotChar === "A" ? 0x90020000 : 0x90420000;

            async function flash(plan) {
                showFlash();
                const previous = calculator.device.logProgress;
                let newInfo;
                let shown = 0;
                const show = (ratio) => {
                    shown = Math.max(shown, ratio);
                    setFlashProgress(shown);
                };
                try {
                    const steps = await plan();

                    const total = steps.reduce((n, s) => n + s.buffer.byteLength, 0) || 1;
                    let before = 0;

                    for (const step of steps) {
                        const size = step.buffer.byteLength;

                        let phase = 0;
                        let last = 0;
                        calculator.device.logProgress = (done, expected) => {
                            if (done < last) phase = 1;
                            last = done;
                            const inStep = (phase + (expected ? done / expected : 0)) / 2;
                            show((before + inStep * size) / total);
                        };
                        show(before / total);

                        calculator.device.startAddress = step.address;
                        await calculator.device.do_download(calculator.transferSize, step.buffer, false);

                        before += size;
                        show(before / total);
                    }
                    newInfo = await calculator.getPlatformInfo();
                } catch (error) {
                    showFlashError();
                    throw error;
                } finally {
                    calculator.device.logProgress = previous;
                }
                hideFlash();
                updateInstallInterface(model, newInfo);
            }

            const installers = {
                salty: () =>
                    flash(async () => [
                        ...(await dfuSteps(`/bin/SaltyOS.userland.onboarding.allow3rdparty.${slotChar}.n${model}.dfu`)),
                        await binStep(`/bin/Epsilon.kernel.${slotChar}.n${model}.bin`, slotAddress),
                    ]),
                saltyKernel: () =>
                    flash(async () => [
                        ...(await dfuSteps(`/bin/SaltyOS.userland.onboarding.allow3rdparty.${slotChar}.custom_kernel.n${model}.dfu`)),
                        await binStep(`/bin/SaltyOS.kernel.${slotChar}.n${model}.bin`, slotAddress),
                    ]),
                saltyBig: () =>
                    flash(async () => [
                        ...(await dfuSteps(`/bin/SaltyOS.userland.onboarding.allow3rdparty.${slotChar}.custom_kernel.big_userland.n${model}.dfu`)),
                        await binStep(`/bin/SaltyOS.kernel.${slotChar}.n${model}.bin`, slotAddress),
                    ]),
                epsilon: () =>
                    flash(async () => [await binStep(`/bin/Epsilon.userland.${slotChar}.n${model}.bin`, userlandAddress), await binStep(`/bin/Epsilon.kernel.${slotChar}.n${model}.bin`, slotAddress)]),
                ablauncher: async () => {},
                uninstall: () => flash(async () => [{ address: slotAddress, buffer: new Uint8Array(0x40000).fill(0xff) }]),
                erase: () => flash(async () => [{ address: slotAddress, buffer: new Uint8Array(0x400000).fill(0xff) }]),
            };

            trigger.onclick = () => {
                if (select.classList.contains("open")) closeSelect(select);
                else openSelect(select);
            };

            dropdown.onclick = (e) => {
                const option = e.target.closest(".install-select-option");
                if (!option || reasons[option.dataset.value] !== null) return;
                select.dataset.value = option.dataset.value;
                refreshInstallControls();
                closeSelect(select);
            };

            installButton.onclick = async () => {
                installButton.disabled = true;
                closeSelect(select);
                try {
                    await installers[select.dataset.value]();
                } catch (error) {
                    console.error(error);
                }
            };
        }
    }

    let calculator = new Numworks();

    async function connectCalculator() {
        calculator.stopAutoConnect();

        setState("connected");
        await wait(1000);
        const model = calculator.getModel();
        if (!["0110", "0115", "0120"].includes(model)) {
            setState("scan-error");
            return;
        }
        setState("scanning");
        const [info] = await Promise.all([calculator.getPlatformInfo(), wait(2000)]); //4000
        if (info.mode === "legacy") {
            setState("scan-error");
            return;
        }
        setState("done");
        updateInstallInterface(model, info);
    }

    calculator.autoConnect(connectCalculator);

    document.getElementById("install-connect").addEventListener("click", () => {
        try {
            const model = calculator.getModel();
            calculator.crash();
            return;
        } catch {}

        calculator.detect(connectCalculator, () => {
            setState("connect-error");
        });
    });

    navigator.usb.addEventListener("disconnect", function (e) {
        calculator.onUnexpectedDisconnect(e, function () {
            setState("idle");
            calculator.autoConnect(connectCalculator);
        });
    });

    function openSelect(select) {
        document.querySelectorAll(".install-select.open").forEach(closeSelect);
        select.classList.add("open");
        select.querySelector(".install-select-trigger").setAttribute("aria-expanded", "true");
    }

    function closeSelect(select) {
        select.classList.remove("open");
        select.querySelector(".install-select-trigger").setAttribute("aria-expanded", "false");
    }

    document.addEventListener("click", (event) => {
        document.querySelectorAll(".install-select.open").forEach((select) => {
            if (!select.contains(event.target)) closeSelect(select);
        });
    });

    const flashEl = {
        overlay: document.getElementById("flash-overlay"),
        fill: document.getElementById("flash-progress-fill"),
        percent: document.getElementById("flash-progress-percent"),
        close: document.getElementById("flash-progress-close"),
    };

    function setFlashProgress(ratio) {
        const pct = Math.round(Math.min(1, Math.max(0, ratio || 0)) * 100);
        flashEl.fill.style.width = `${pct}%`;
        flashEl.percent.textContent = `${pct}%`;
    }

    function blockUnload(event) {
        event.preventDefault();
        event.returnValue = "";
    }

    function showFlash() {
        flashEl.overlay.classList.remove("hidden", "is-error");
        setFlashProgress(0);
        window.addEventListener("beforeunload", blockUnload);
    }

    function hideFlash() {
        flashEl.overlay.classList.add("hidden");
        window.removeEventListener("beforeunload", blockUnload);
    }

    function showFlashError() {
        flashEl.overlay.classList.add("is-error");
        window.removeEventListener("beforeunload", blockUnload);
    }

    flashEl.close.onclick = hideFlash;

    async function fetchBuffer(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return res.arrayBuffer();
    }
    async function dfuSteps(url) {
        return parseDfuFile(await fetchBuffer(url)).map((b) => ({ address: b.address, buffer: b.buffer }));
    }
    async function binStep(url, address) {
        return { address, buffer: await fetchBuffer(url) };
    }
}

async function startup() {
    const res = await fetch("/api/get-themes");
    if (!res.ok) {
        throw new Error(`unable to fetch themes from server. Status: ${res.status}`);
    }

    const serverThemes = await res.json();

    await Promise.all(
        userThemes.map(async (theme) => {
            updateThemesInterface(themeSize(await prepareTheme(theme)));
        }),
    );

    if (document.getElementById("latest-themes-grid")) {
        await displayLatestThemes(serverThemes);
    }

    if (window.location.pathname.includes("install")) {
        if (!("usb" in navigator)) {
            const webUSBErrorPopUpOverlay = document.getElementById("webusb-error-overlay");
            webUSBErrorPopUpOverlay.classList.remove("hidden");
            return;
        }

        await startInstallSection();
    }
}

animateGithubIcon("github-icon-1");
animateGithubIcon("github-icon-2");
startup();
