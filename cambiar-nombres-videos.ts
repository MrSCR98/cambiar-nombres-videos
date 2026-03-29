// cambiar-nombres-videos.ts
import { readdir } from "node:fs/promises";
import readline from "readline";

/** Tipo para archivos */
type Archivo = string;

/** Leer archivos de la carpeta de forma segura */
async function listarArchivos(ruta: string): Promise<Archivo[]> {
  try {
    const entries = await readdir(ruta, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch (err) {
    console.error("❌ Error al leer la carpeta:", err);
    return [];
  }
}

/** Obtener solo nombres sin extensión */
function nombresSinExtension(archivos: string[]): string[] {
  return archivos.map(f => {
    const idx = f.lastIndexOf(".");
    return idx !== -1 ? f.slice(0, idx) : f;
  });
}

/** Reemplazar nombres de forma segura, manteniendo extensión */
function reemplazarNombres(originales: Archivo[], nuevos: (string | undefined)[]): Archivo[] {
  if (originales.length !== nuevos.length) {
    throw new Error("La lista nueva no tiene la misma longitud que la original.");
  }

  return originales.map((nombre, i) => {
    const nuevo: string | undefined = nuevos[i];
    if (!nuevo || !nuevo.trim()) {
      throw new Error(`El nombre nuevo para "${nombre}" está vacío o es undefined.`);
    }

    const idx: number = nombre.lastIndexOf(".");
    const extension: string = idx !== -1 ? nombre.slice(idx) : "";
    return `${nuevo.toUpperCase()}${extension}`;
  });
}

/** Mostrar tabla Antes → Después */
function mostrarAntesDespues(originales: Archivo[], nuevos: Archivo[]): void {
  console.log("\n🔹 Vista previa Antes / Después 🔹\n");
  originales.forEach((o, i) => {
    console.log(`${o.padEnd(30)} → ${nuevos[i]}`);
  });
  console.log("");
}

/** Leer input del usuario de forma segura */
function pregunta(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans); }));
}

/** Asignar números aleatorios delante de los nombres de forma segura */
function asignarNumerosAleatorios(
  nombres: Archivo[],
  numeros: number[],
  startNumero: number
): Archivo[] {
  if (nombres.length === 0 || numeros.length === 0) return [...nombres];

  const nombresAsignados: Archivo[] = [...nombres];
  const disponibles: number[] = nombres.map((_, idx) => idx);
  let indexNumero: number = numeros.indexOf(startNumero);
  if (indexNumero === -1) indexNumero = 0;

  for (let i = 0; i < nombres.length; i++) {
    if (disponibles.length === 0) break;

    const randIdx: number = Math.floor(Math.random() * disponibles.length);
    const archivoIdx: number | undefined = disponibles.splice(randIdx, 1)[0];
    if (archivoIdx === undefined) continue;

    const numero: number = numeros[indexNumero % numeros.length]!;
    nombresAsignados[archivoIdx] = `${numero.toString().padStart(2, "0")} ${nombresAsignados[archivoIdx]}`;
    indexNumero++;
  }

  return nombresAsignados;
}

/** Función principal, con control de errores completo */
async function principal(): Promise<void> {
  console.log("\n🎬 Cambiar Nombres Videos - Gestor Seguro .shorts\n");

  try {
    const ruta: string = "E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts";
    const originales: Archivo[] = await listarArchivos(ruta);

    if (!originales.length) {
      console.log("No se encontraron archivos en la carpeta.");
      return;
    }

    console.log(`Archivos encontrados: ${originales.length}\n`);

    // Mostrar nombres sin extensión al usuario
    const nombresBase: string[] = nombresSinExtension(originales);

    // Pedir nuevos nombres
    const nuevos: string[] = [];
    for (const nombre of nombresBase) {
      let resp: string = "";
      while (!resp.trim()) {
        resp = await pregunta(`Nuevo nombre para "${nombre}" (sin extensión, obligatorio): `);
      }
      nuevos.push(resp.toUpperCase());
    }

    // Generar array final con extensión
    const renombrados: Archivo[] = reemplazarNombres(originales, nuevos);

    // Vista previa
    mostrarAntesDespues(originales, renombrados);

    // Opciones: todos / individual / cancelar
    const opcion: string = (await pregunta("Opciones: 1. Cambiar todos  2. Seleccionar individual  3. Cancelar [1]: ")) || "1";
    if (opcion === "3") {
      console.log("Operación cancelada. No se hicieron cambios.");
      return;
    } else if (opcion === "2") {
      for (let i = 0; i < originales.length; i++) {
        const confirmar: string = (await pregunta(`¿Cambiar "${originales[i]}" → "${renombrados[i]}"? (s/n) [s]: `)) || "s";
        if (confirmar.toLowerCase() !== "s") {
          renombrados[i] = originales[i]!; // seguro que no es undefined
        }
      }
    }

    // Pedir número inicial para añadir delante
    const numeros: number[] = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const startResp: string = await pregunta("Número inicial para añadir delante (00,15,...,23) o ENTER para omitir: ");
    const startNumero: number = parseInt(startResp);
    if (!isNaN(startNumero) && numeros.includes(startNumero)) {
      const conNumeros: Archivo[] = asignarNumerosAleatorios(renombrados, numeros, startNumero);
      mostrarAntesDespues(renombrados, conNumeros);
      // Aquí podrías renombrar físicamente los archivos si quieres
    }

    console.log("\n✅ Operación finalizada. Lista lista para renombrar o usar en otro paso.");
  } catch (error) {
    console.error("❌ Error inesperado:", error);
  }
}

// Ejecutar
principal();