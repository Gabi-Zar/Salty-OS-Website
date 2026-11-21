/*
 * LZ4 Library - Copyright (c) Yann Collet, BSD 2-Clause License (https://github.com/lz4/lz4).
 */
const { default: WASM_BASE64 } = await import("./lz4hc-wasm.js");

const { instance } = await WebAssembly.instantiate(Uint8Array.from(atob(WASM_BASE64), (c) => c.charCodeAt(0)));
const wasm = instance.exports;
const MAX_INPUT = wasm.salty_max_input();
const MAX_OUTPUT = wasm.salty_max_output();

const view = (address, length) => new Uint8Array(wasm.memory.buffer, address, length);

export const compressBound = (size) => size + Math.floor(size / 255) + 16;

export function compressHC(data, level = 12) {
    if (!(data instanceof Uint8Array)) throw new TypeError("data must be a Uint8Array");
    if (data.length === 0 || data.length > MAX_INPUT) throw new RangeError(`data must be 1 to ${MAX_INPUT} bytes (got ${data.length})`);
    if (!Number.isInteger(level) || level < 1 || level > 12) throw new RangeError("level must be an integer from 1 to 12");

    view(wasm.salty_src(), data.length).set(data);
    const size = wasm.salty_compress_hc(data.length, level);
    if (size <= 0 || size > MAX_OUTPUT) throw new Error("LZ4 compression failed");
    return view(wasm.salty_dst(), size).slice();
}

export function decompress(block, size) {
    if (!(block instanceof Uint8Array)) throw new TypeError("block must be a Uint8Array");
    if (block.length === 0 || block.length > MAX_INPUT) throw new RangeError(`block must be 1 to ${MAX_INPUT} bytes (got ${block.length})`);
    if (!Number.isInteger(size) || size < 1 || size > MAX_OUTPUT) throw new RangeError(`size must be 1 to ${MAX_OUTPUT}`);

    view(wasm.salty_src(), block.length).set(block);
    if (wasm.salty_decompress(block.length, size) !== size) throw new Error("invalid LZ4 block");
    return view(wasm.salty_dst(), size).slice();
}
