import createLd from "./toolchain/ld.js";
import createObjcopy from "./toolchain/objcopy.js";

const APP_SECTOR_SIZE = 0x10000;

const linkerScript = ({ flashStart, flashLength, ramStart, ramLength, trampolineStart }) => `MEMORY {
  FLASH (rx) : ORIGIN = ${flashStart}, LENGTH = ${flashLength}
  RAM (rwx) : ORIGIN = ${ramStart}, LENGTH = ${ramLength}
}

ENTRY(_start);

_userland_trampoline_address = ${trampolineStart};

SECTIONS {
  .eadk_app_info ORIGIN(FLASH) : {
    LONG(0xDEC0BEBA);
    KEEP(*(.rodata.eadk_api_level))
    LONG(ADDR(.rodata.eadk_app_name) - ORIGIN(FLASH));
    LONG(SIZEOF(.rodata.eadk_app_icon));
    LONG(ADDR(.rodata.eadk_app_icon) - ORIGIN(FLASH));
    LONG(_start - ORIGIN(FLASH));
    LONG(_eadk_app_end - ORIGIN(FLASH));
    LONG(0xDEC0BEBA);
  } >FLASH

  .rodata.eadk_app_name : {
    KEEP(*(.rodata.eadk_app_name))
  } >FLASH

  .rodata.eadk_app_icon : {
    KEEP(*(.rodata.eadk_app_icon))
  } >FLASH

  .text : {
    . = ALIGN(4);
    *(.text)
    *(.text.*)
  } >FLASH

  .rodata : {
    *(.rodata)
    *(.rodata.*)
    _eadk_app_end = .;
  } >FLASH

  .data : {
    . = ALIGN(4);
    _data_section_start_flash = LOADADDR(.data);
    _data_section_start_ram = .;
    *(.data)
    *(.data.*)
    _data_section_end_ram = .;
  } >RAM AT >FLASH

  .bss : {
    . = ALIGN(4);
    _bss_section_start_ram = .;
    *(.bss)
    *(.bss.*)
    _bss_section_end_ram = .;
  } >RAM

  .heap : {
    _heap_start = .;
    . = (ORIGIN(RAM) + LENGTH(RAM));
    _heap_end = .;
  } >RAM
}

ASSERT(SIZEOF(.eadk_app_info) == 32, "Missing api level. Please define a .rodata.eadk_api_level section.");
ASSERT(SIZEOF(.rodata.eadk_app_name) > 0, "Missing app name. Please define a .rodata.eadk_app_name section.");
ASSERT(SIZEOF(.rodata.eadk_app_icon) > 0, "Missing app icon. Please define a .rodata.eadk_app_icon section.");
`;

async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

function run(create, wasmBinary, args, files, output) {
    return new Promise((resolve, reject) => {
        let status = 0;
        let stderr = "";
        const module = {
            wasmBinary,
            arguments: [...args],
            preRun: () => {
                for (const [name, bytes] of Object.entries(files)) module.FS.writeFile(name, bytes);
            },
            print: () => {},
            printErr: (line) => (stderr += `${line}\n`),
            quit: (code, exit) => {
                status = code;
                throw exit;
            },
            onAbort: reject,
            postRun: () => {
                if (status !== 0) return reject(new Error(stderr || `exit code ${status}`));
                try {
                    resolve(module.FS.readFile(output));
                } catch (error) {
                    reject(new Error(stderr || error.message));
                }
            },
        };
        create(module).catch(reject);
    });
}

export async function linkNwa(nwa, layout) {
    const [ldWasm, objcopyWasm, eadk] = await Promise.all([fetchBytes("/toolchain/ld.wasm"), fetchBytes("/toolchain/objcopy.wasm"), fetchBytes("/toolchain/eadk.o")]);

    const elf = await run(
        createLd,
        ldWasm,
        ["--script", "linker.ld", "--gc-sections", "--allow-multiple-definition", "eadk.o", "app.nwa", "--output", "output.elf"],
        { "linker.ld": linkerScript(layout), "eadk.o": eadk, "app.nwa": nwa },
        "output.elf",
    );
    const bin = await run(createObjcopy, objcopyWasm, ["--output-target", "binary", "input.dat", "output.dat"], { "input.dat": elf }, "output.dat");

    const padded = Math.ceil(bin.length / APP_SECTOR_SIZE) * APP_SECTOR_SIZE;
    const out = new Uint8Array(padded < layout.flashLength ? padded + APP_SECTOR_SIZE : padded).fill(0xff);
    out.set(bin);
    return out;
}
