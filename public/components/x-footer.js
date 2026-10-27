class XFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <footer class="footer">
                <div class="footer-grid">
                    <h1 class="text-logo">SaltyOS</h1>
                    <div class="vertical-div">
                        <a href="https://github.com/SaltyMold/Salty-OS" target="_blank" rel="noreferrer"><div id="github-icon-1" class="logo inverse-color"></div></a>
                        <p class="small-text">Salty OS</p>
                    </div>
                    <div class="vertical-div">
                        <a href="https://github.com/Gabi-Zar/Salty-OS-Website" target="_blank" rel="noreferrer"><div id="github-icon-2" class="logo inverse-color"></div></a>
                        <p class="small-text">Salty OS Website</p>
                    </div>
                </div>
                <div class="vertical-div">
                    <p class="centered-text small-text">
                        NumWorks is a registered trademark of NumWorks SAS, 24 Rue Godot de Mauroy, 75009 Paris, France. NumWorks SAS aren't associated in any shape or form with SaltyOS
                    </p>
                    <p class="small-text">Animated icons by <a class="small-text" href="https://useanimations.com" target="_blank" rel="noreferrer">useAnimations</a></p>
                </div>
            </footer>
        `;
    }
}
customElements.define("x-footer", XFooter);
