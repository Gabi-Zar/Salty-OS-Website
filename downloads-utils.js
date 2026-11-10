import { writeFile } from "fs/promises";

let downloadedVersion = "";
const epsilonVersions = [{ n0115: "26.4.0" }, { n0110: "26.4.0" }];

async function saltyOSDownload() {
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch("https://api.github.com/repos/SaltyMold/Salty-OS/releases", { headers });

    if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status}`);
    }

    const releases = await res.json();
    const release = releases.find((r) => !r.prerelease && !r.draft);

    if (release.tag_name !== downloadedVersion) {
        for (const asset of release.assets) {
            if (asset.name === "epsilon.js") continue;
            const assetRes = await fetch(asset.browser_download_url);
            if (!assetRes.ok) {
                throw new Error(`GitHub download error: ${assetRes.status}`);
            }

            await writeFile(`./bin/SaltyOS.${asset.name}`, Buffer.from(await assetRes.arrayBuffer()));
            console.log(`downloaded SaltyOS.${asset.name}`);
        }

        downloadedVersion = release.tag_name;
        setTimeout(() => saltyOSDownload(), 24 * 60 * 60 * 1000);
    }
}

async function epsilonDownload() {
    const res = await fetch("https://git.gabizar.top/api/v1/repos/GabiZar/Epsilon-Archive/releases");

    if (!res.ok) {
        throw new Error(`Gitea API error: ${res.status}`);
    }

    const releases = await res.json();

    for (const version of epsilonVersions) {
        const release = releases.find((r) => !r.prerelease && r.tag_name.includes(Object.keys(version)[0]) && r.tag_name.includes(Object.values(version)[0]));
        for (const slot of ["A", "B"]) {
            for (const type of ["Kernel", "Userland"]) {
                for (const asset of release.assets) {
                    if (asset.name.includes(`${type}${slot}`)) {
                        const assetRes = await fetch(asset.browser_download_url);
                        if (!assetRes.ok) {
                            throw new Error(`Gitea download error: ${assetRes.status}`);
                        }

                        await writeFile(`./bin/Epsilon.${type.toLowerCase()}.${slot}.${Object.keys(version)[0]}.bin`, Buffer.from(await assetRes.arrayBuffer()));
                        console.log(`downloaded Epsilon.${type.toLowerCase()}.${slot}.${Object.keys(version)[0]}.bin`);
                    }
                }
            }
        }
    }
    const releaseN0120 = releases.find((r) => !r.prerelease && r.tag_name.includes("26.3.0"));
    for (const slot of ["A", "B"]) {
        for (const type of ["Kernel", "Userland"]) {
            for (const asset of releaseN0120.assets) {
                if (asset.name.includes(`${type}${slot}`)) {
                    const assetRes = await fetch(asset.browser_download_url);
                    if (!assetRes.ok) {
                        throw new Error(`Gitea download error: ${assetRes.status}`);
                    }

                    await writeFile(`./bin/Epsilon.${type.toLowerCase()}.${slot}.n0120.bin`, Buffer.from(await assetRes.arrayBuffer()));
                    console.log(`downloaded Epsilon.${type.toLowerCase()}.${slot}.n0120.bin`);
                }
            }
        }
    }
}

export { saltyOSDownload, epsilonDownload };
