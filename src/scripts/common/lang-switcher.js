import Cookies from "js-cookie";

export function initLangSwitcher() {
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
}
