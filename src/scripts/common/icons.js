const motion = matchMedia("(prefers-reduced-motion: reduce)");

const archiveIcon = document.getElementById("archive-icon");
export const archiveIconAnimation = lottie.loadAnimation({ container: archiveIcon, renderer: "svg", loop: false, autoplay: false, path: "https://useanimations.com/icons/archive.json" });
archiveIcon.addEventListener("mouseenter", () => {
    archiveIconAnimation.setDirection(1);
    archiveIconAnimation.play();
});
archiveIcon.addEventListener("mouseleave", () => {
    archiveIconAnimation.setDirection(-1);
    archiveIconAnimation.play();
});

function animateLoopingIcon(element, path) {
    const animation = lottie.loadAnimation({ container: element, renderer: "svg", loop: true, autoplay: false, path });
    let stopAfterCycle = false;
    animation.addEventListener("loopComplete", () => {
        if (stopAfterCycle) {
            stopAfterCycle = false;
            animation.goToAndStop(0, true);
        }
    });
    element.addEventListener("mouseenter", () => {
        stopAfterCycle = false;
        if (!motion.matches) animation.play();
    });
    element.addEventListener("mouseleave", () => {
        stopAfterCycle = !motion.matches && !animation.isPaused;
        if (!stopAfterCycle) animation.goToAndStop(0, true);
    });
}

animateLoopingIcon(document.getElementById("discord-icon"), "https://useanimations.com/icons/discord.json");
animateLoopingIcon(document.getElementById("github-icon-1"), "https://useanimations.com/icons/github.json");
animateLoopingIcon(document.getElementById("github-icon-2"), "https://useanimations.com/icons/github.json");
