class XHeader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <header class="header separated-div">
                <input type="checkbox" id="nav-toggle" class="nav-toggle" hidden />

                <div class="horizontal-div nav-group">
                    <a href="/#">
                        <img class="logo" src="assets/logo.png" />
                    </a>

                    <label for="nav-toggle" class="burger"> <span></span><span></span><span></span> </label>

                    <nav class="nav-links">
                        <a href="/#features">Features</a>
                        <a href="/install">Install</a>
                        <a href="/browse">Browse Themes</a>
                        <a href="/new">New Theme</a>
                    </nav>
                </div>
                <div class="horizontal-div small-gap">
                    <div class="vertical-div">
                        <div class="separated-div">
                            <p class="small-text">Space used:</p>
                            <p id="themes-size-text" class="themes-size-text"></p>
                        </div>
                        <div id="themes-size-bar-container" class="themes-size-bar-container">
                            <div id="themes-size-bar" class="themes-size-bar"></div>
                        </div>
                    </div>
                    <a href="/package" class="archive">
                        <div id="archive-icon" class="inverse-color logo">
                            <span class="tooltiptext inverse-color">Your themes pack</span>
                        </div>
                        <span id="archive-counter" class="badge hidden">0</span>
                    </a>
                </div>
            </header>
        `;
    }
}
customElements.define("x-header", XHeader);
