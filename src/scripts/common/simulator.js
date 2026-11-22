const simulators = new Map();
let nextId = 1;

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

export function registerSimulator(iframe) {
    let resolveReady;
    const ready = new Promise((resolve) => (resolveReady = resolve));
    const simulator = { iframe, ready, resolveReady, pending: new Map() };
    simulators.set(iframe.contentWindow, simulator);
    return simulator;
}

export function unregisterSimulator(iframe) {
    for (const [source, simulator] of simulators) if (simulator.iframe === iframe) simulators.delete(source);
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

export function loadThemeArea(simulator, bin) {
    const buffer = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
    return call(simulator, "salty:loadThemeArea", { data: buffer }, [buffer]);
}

export function selectTheme(simulator, index) {
    call(simulator, "salty:selectTheme", { index });
}
