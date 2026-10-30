import { cpSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(frontendRoot, "dist");

mkdirSync(outputRoot, { recursive: true });

for (const directory of ["assets", "maqueta3d"]) {
    const source = resolve(frontendRoot, directory);
    const destination = resolve(outputRoot, directory);

    if (existsSync(source)) {
        cpSync(source, destination, { recursive: true, force: true });
    }
}

for (const page of ["privacidad.html", "eliminacion-de-datos.html"]) {
    const source = resolve(frontendRoot, page);
    if (existsSync(source)) {
        copyFileSync(source, resolve(outputRoot, page));
    }
}

