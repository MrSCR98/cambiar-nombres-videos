// cambiar-nombres-videos.ts
import { readdir, rename } from "node:fs/promises";
import readline from "readline";

type Archivo = string;

/** Leer archivos de la carpeta */
async function listarArchivos(ruta: string): Promise<Archivo[]> {
  try {
    const entries = await readdir(ruta, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch (err) {
    console.error("❌ Error al leer la carpeta:", err);
    return [];
  }
}

/** Obtener nombres sin extensión */
function nombresSinExtension(archivos: Archivo[]): string[] {
  return archivos.map(f => {
    const idx = f.lastIndexOf(".");
    return idx !== -1 ? f.slice(0, idx) : f;
  });
}

/** Limpiar nombres de caracteres inválidos */
function limpiarNombre(nombre: string): string {
  return nombre.replace(/[\\/:*?"<>|]/g, "").trim();
}

/** Reemplazar nombres manteniendo extensión */
function reemplazarNombres(originales: Archivo[], nuevos: string[]): Archivo[] {
  if (originales.length !== nuevos.length) {
    throw new Error("La lista nueva no tiene la misma longitud que la original.");
  }

  return originales.map((nombre, i) => {
    const nuevo = limpiarNombre(nuevos[i]);
    if (!nuevo) throw new Error(`El nombre nuevo para "${nombre}" está vacío después de limpiar caracteres inválidos.`);
    const idx = nombre.lastIndexOf(".");
    const extension = idx !== -1 ? nombre.slice(idx) : "";
    return `${nuevo.toUpperCase()}${extension}`;
  });
}

/** Mostrar Antes / Después */
function mostrarAntesDespues(originales: Archivo[], nuevos: Archivo[]): void {
  console.log("\n🔹 Vista previa Antes / Después 🔹\n");
  originales.forEach((o, i) => {
    console.log(`${o.padEnd(30)} → ${nuevos[i]}`);
  });
  console.log("");
}

/** Leer input del usuario */
function pregunta(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans ?? ""); }));
}

/** Detectar archivos numerados */
function detectarArchivosNumerados(archivos: Archivo[]): { indicesIgnorar: number[], ultimoContador: number } {
  const regex = /^(\d{4}) (\d{2}) /;
  const indicesIgnorar: number[] = [];
  let maxContador = -1;

  archivos.forEach((f, idx) => {
    const match = f.match(regex);
    if (match?.[1] !== undefined) {
      indicesIgnorar.push(idx);
      const contador = parseInt(match[1], 10);
      if (!isNaN(contador) && contador > maxContador) maxContador = contador;
    }
  });

  return { indicesIgnorar, ultimoContador: maxContador };
}

/** Asignar contador + números delante */
function asignarContadorYNumeros(
  nombres: Archivo[],
  numeros: number[],
  startNumero: number,
  indicesIgnorar: number[],
  ultimoContador: number
): Archivo[] {
  const nombresAsignados: Archivo[] = [...nombres];
  const disponibles: number[] = nombres.map((_, idx) => idx).filter(idx => !indicesIgnorar.includes(idx));
  let indexNumero = numeros.indexOf(startNumero);
  if (indexNumero === -1) indexNumero = 0;
  let contador = ultimoContador + 1;

  for (const idxArchivo of disponibles) {
    const numero = numeros[indexNumero % numeros.length] ?? 0;
    nombresAsignados[idxArchivo] = `${contador.toString().padStart(4, "0")} ${numero.toString().padStart(2, "0")} ${nombresAsignados[idxArchivo]}`;
    indexNumero++;
    contador++;
  }

  return nombresAsignados;
}

/** Renombrar archivos físicamente */
async function renombrarFisicamente(ruta: string, originales: Archivo[], nuevos: Archivo[]) {
  for (let i = 0; i < originales.length; i++) {
    const orig = originales[i];
    const nuevo = nuevos[i];
    if (!orig || !nuevo) continue;
    try {
      await rename(`${ruta}\\${orig}`, `${ruta}\\${nuevo}`);
    } catch (err) {
      console.error(`❌ Error renombrando "${orig}" a "${nuevo}":`, err);
    }
  }
}

/** Función principal */
async function principal(): Promise<void> {
  console.log("\n🎬 Cambiar Nombres Videos - Gestor Seguro .shorts\n");

  try {
    const ruta = "E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts";
    const originales: string[] = await listarArchivos(ruta);

    if (!originales.length) {
      console.log("No se encontraron archivos en la carpeta.");
      return;
    }

    console.log("Archivos encontrados (sin extensión):");
    const nombresBase: string[] = nombresSinExtension(originales);
    console.log(nombresBase, "\n"); // <-- Array completo devuelto al usuario

    // ✅ Paso 2 – El usuario debe devolver un array con la misma longitud
    let nuevos: string[] = [];
    while (true) {
      const resp = await pregunta("Pega aquí tu array de nuevos nombres separados por comas: ");
      nuevos = resp.split(",").map(n => limpiarNombre(n));
      if (nuevos.length === nombresBase.length) break;
      console.log(`⚠️ La longitud no coincide (${nuevos.length} vs ${nombresBase.length}). Intenta de nuevo.`);
    }

    let renombrados: string[] = reemplazarNombres(originales, nuevos);
    mostrarAntesDespues(originales, renombrados);

    // Opciones: todos / individual / cancelar
    const opcion: string = (await pregunta("Opciones: 1. Cambiar todos  2. Seleccionar individual  3. Cancelar [1]: ")) || "1";
    if (opcion === "3") {
      console.log("Operación cancelada. No se hicieron cambios.");
      return;
    } else if (opcion === "2") {
      for (let i = 0; i < originales.length; i++) {
        const orig = originales[i];
        const ren = renombrados[i];
        if (!orig || !ren) continue;
        const confirmar: string = (await pregunta(`¿Cambiar "${orig}" → "${ren}"? (s/n) [s]: `)) || "s";
        if (confirmar.toLowerCase() !== "s") {
          renombrados[i] = orig;
        }
      }
    }

    // Numeración automática
    const numerosLista: number[] = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const { indicesIgnorar, ultimoContador } = detectarArchivosNumerados(renombrados);

    const startResp: string = await pregunta("Número inicial para añadir delante (00,15,...,23) o ENTER para omitir: ");
    const startNumero: number = parseInt(startResp);
    if (!isNaN(startNumero) && numerosLista.includes(startNumero)) {
      renombrados = asignarContadorYNumeros(renombrados, numerosLista, startNumero, indicesIgnorar, ultimoContador);
      mostrarAntesDespues(originales, renombrados);
    }

    // Preguntar si renombrar físicamente
    const aplicar: string = (await pregunta("¿Renombrar los archivos físicamente en la carpeta? (s/n) [s]: ")) || "s";
    if (aplicar.toLowerCase() === "s") {
      await renombrarFisicamente(ruta, originales, renombrados);
      console.log("\n✅ Archivos renombrados correctamente.");
    } else {
      console.log("\n⚠️ Cambios solo en memoria. No se renombró ningún archivo.");
    }

  } catch (error) {
    console.error("❌ Error inesperado:", error);
  }
}

principal();