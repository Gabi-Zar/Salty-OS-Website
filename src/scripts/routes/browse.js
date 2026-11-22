import { addThemeCards } from "../common/theme-card.js";
import { unregisterSimulator } from "../common/simulator.js";

const PAGE_SIZE = 16;
const SEARCH_DELAY = 500;

export async function initBrowse() {
    const grid = document.getElementById("browse-grid");
    const controls = document.getElementById("browse-controls");
    const searchInput = document.getElementById("browse-search");
    const sortSelect = document.getElementById("browse-sort");
    const orderButton = document.getElementById("browse-order");
    const pages = document.getElementById("browse-pages");
    const prevButton = document.getElementById("browse-prev");
    const nextButton = document.getElementById("browse-next");
    const pageNumber = document.getElementById("browse-page");
    const emptyText = document.getElementById("browse-empty");
    const errorText = document.getElementById("browse-error");

    let search = "";
    let sort = sortSelect.dataset.value;
    let order = "desc";
    let page = readPageFromUrl();
    let generation = 0;

    function readPageFromUrl() {
        const value = new URLSearchParams(window.location.search).get("page");
        return /^[1-9]\d{0,3}$/.test(value ?? "") ? Number(value) : 1;
    }

    function writePageToUrl() {
        const url = new URL(window.location.href);
        if (page > 1) url.searchParams.set("page", page);
        else url.searchParams.delete("page");
        history.replaceState(null, "", url);
    }

    function updateOrderButton() {
        orderButton.textContent = order === "asc" ? "▲" : "▼";
        orderButton.title = orderButton.ariaLabel = orderButton.dataset[order === "asc" ? "labelAsc" : "labelDesc"];
    }

    async function loadPage() {
        const current = ++generation;
        prevButton.disabled = nextButton.disabled = true;
        errorText.classList.add("hidden");
        emptyText.classList.add("hidden");
        for (const iframe of grid.querySelectorAll("iframe")) unregisterSimulator(iframe);
        grid.replaceChildren();

        try {
            const params = new URLSearchParams({ offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE + 1, sort, order });
            if (search) params.set("search", search);

            const res = await fetch(`/api/get-themes?${params}`);
            if (!res.ok) throw new Error(`unable to fetch themes from server. Status: ${res.status}`);
            const themes = await res.json();
            if (current !== generation) return;

            if (themes.length === 0 && page > 1) {
                page = 1;
                return loadPage();
            }

            const hasNext = themes.length > PAGE_SIZE;
            pageNumber.textContent = page;
            writePageToUrl();
            pages.classList.toggle("hidden", page === 1 && !hasNext);
            prevButton.disabled = page === 1;
            nextButton.disabled = !hasNext;
            emptyText.classList.toggle("hidden", themes.length > 0);

            await addThemeCards(grid, themes.slice(0, PAGE_SIZE), () => current === generation);
        } catch (err) {
            console.error(err);
            if (current === generation) errorText.classList.remove("hidden");
        }
    }

    function restart() {
        page = 1;
        loadPage();
    }

    function goToPage(newPage) {
        page = newPage;
        controls.scrollIntoView({ behavior: "smooth" });
        loadPage();
    }

    let timer;
    searchInput.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const value = searchInput.value.trim();
            if (value === search) return;
            search = value;
            restart();
        }, SEARCH_DELAY);
    });
    controls.addEventListener("submit", (e) => e.preventDefault());

    const sortTrigger = sortSelect.querySelector(".install-select-trigger");
    const sortLabel = sortSelect.querySelector(".install-select-label");
    const sortOptions = [...sortSelect.querySelectorAll(".install-select-option")];

    function setSortOpen(open) {
        sortSelect.classList.toggle("open", open);
        sortTrigger.setAttribute("aria-expanded", open);
    }

    sortTrigger.addEventListener("click", () => setSortOpen(!sortSelect.classList.contains("open")));
    document.addEventListener("click", (e) => {
        if (!sortSelect.contains(e.target)) setSortOpen(false);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setSortOpen(false);
    });
    sortSelect.querySelector(".install-select-dropdown").addEventListener("click", (e) => {
        const option = e.target.closest(".install-select-option");
        if (!option) return;
        setSortOpen(false);
        if (option.dataset.value === sort) return;

        sort = sortSelect.dataset.value = option.dataset.value;
        for (const other of sortOptions) other.classList.toggle("selected", other === option);
        sortLabel.textContent = option.textContent;
        order = sort === "date" ? "desc" : "asc";
        updateOrderButton();
        restart();
    });

    orderButton.addEventListener("click", () => {
        order = order === "asc" ? "desc" : "asc";
        updateOrderButton();
        restart();
    });

    prevButton.addEventListener("click", () => goToPage(page - 1));
    nextButton.addEventListener("click", () => goToPage(page + 1));

    updateOrderButton();
    await loadPage();
}
