import { readdir, rename } from "node:fs/promises";
import readline from "readline";

type Archivo = string;

/** 1. Leer archivos de la carpeta */
async function listarArchivos(ruta: string): Promise<Archivo[]> {
  try {
    const entries = await readdir(ruta, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch (err) {
    console.error("❌ Error al leer la carpeta:", err);
    return [];
  }
}

/** 2. Obtener nombres sin extensión */
function nombresSinExtension(archivos: Archivo[]): string[] {
  return archivos.map(f => {
    const idx = f.lastIndexOf(".");
    return idx !== -1 ? f.slice(0, idx) : f;
  });
}

/** 3. Limpiar nombres de caracteres inválidos */
function limpiarNombre(nombre: string | undefined): string {
  if (!nombre) return "";
  return nombre.replace(/[\\/:*?"<>|]/g, "").trim();
}

/** 4. Reemplazar nombres manteniendo extensión */
function reemplazarNombres(originales: Archivo[], nuevos: string[]): Archivo[] {
  if (originales.length !== nuevos.length) {
    throw new Error("La lista nueva no tiene la misma longitud que la original.");
  }
  return originales.map((nombre, i) => {
    const nuevoRaw = nuevos[i];
    const nuevo = limpiarNombre(nuevoRaw);
    if (!nuevo) throw new Error(`El nombre nuevo para "${nombre}" está vacío.`);
    const idx = nombre.lastIndexOf(".");
    const extension = idx !== -1 ? nombre.slice(idx) : "";
    return `${nuevo.toUpperCase()}${extension}`;
  });
}

/** 5. Detectar archivos ya numerados y el último estado */
function detectarEstadoCarpeta(archivos: Archivo[]): { indicesIgnorar: number[], ultimoContador: number, ultimoNumero: number } {
  const regex = /^(\d{4}) (\d{2}) /;
  const indicesIgnorar: number[] = [];
  let maxContador = -1;
  let ultimoNum2Cifras = -1;

  archivos.forEach((f, idx) => {
    const match = f.match(regex);
    if (match) {
      indicesIgnorar.push(idx);
      const contador = parseInt(match[1]!, 10);
      const numero = parseInt(match[2]!, 10);
      if (!isNaN(contador) && contador > maxContador) {
        maxContador = contador;
        ultimoNum2Cifras = numero; // Guardamos el número del archivo con el contador más alto
      }
    }
  });

  return { indicesIgnorar, ultimoContador: maxContador, ultimoNumero: ultimoNum2Cifras };
}

/** 6. Aplicar numeración final solo a los seleccionados */
function aplicarNumeracionFinal(
  nombres: Archivo[],
  numeros: number[],
  startNumero: number,
  indicesParaNumerar: number[],
  ultimoContador: number
): Archivo[] {
  const resultado = [...nombres];
  let indexEnLista = numeros.indexOf(startNumero);
  if (indexEnLista === -1) indexEnLista = 0;
  
  let contador = ultimoContador + 1;

  for (const idx of indicesParaNumerar) {
    const num2Cifras = numeros[indexEnLista % numeros.length] ?? 0;
    const pContador = contador.toString().padStart(4, "0");
    const pNumero = num2Cifras.toString().padStart(2, "0");
    
    // Añadimos el prefijo al nombre actual (que puede ser el nuevo o el original)
    resultado[idx] = `${pContador} ${pNumero} ${resultado[idx]}`;
    
    indexEnLista++;
    contador++;
  }

  return resultado;
}

/** 7. Mostrar Antes / Después */
function mostrarAntesDespues(originales: Archivo[], nuevos: Archivo[]): void {
  console.log("\n🔹 Vista previa de cambios 🔹\n");
  originales.forEach((o, i) => {
    console.log(`${o.padEnd(40)} → ${nuevos[i]}`);
  });
  console.log("");
}

/** 8. Leer input del usuario */
function pregunta(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans ?? ""); }));
}

/** 9. Renombrar físicamente */
async function renombrarFisicamente(ruta: string, originales: Archivo[], nuevos: Archivo[]) {
  for (let i = 0; i < originales.length; i++) {
    const orig = originales[i]!;
    const nuevo = nuevos[i]!;
    if (orig === nuevo) continue;
    try {
      await rename(`${ruta}\\${orig}`, `${ruta}\\${nuevo}`);
    } catch (err) {
      console.error(`❌ Error con "${orig}":`, err);
    }
  }
}

/** FUNCIÓN PRINCIPAL */
async function principal(): Promise<void> {
  console.log("\n🎬 GESTOR DE RENOMBRADO .SHORTS\n");

  try {
    const ruta = "E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts2";
    const originales = await listarArchivos(ruta);

    if (!originales.length) {
      console.log("Carpeta vacía.");
      return;
    }

    const { indicesIgnorar, ultimoContador, ultimoNumero } = detectarEstadoCarpeta(originales);
    const indicesNuevos = originales.map((_, i) => i).filter(i => !indicesIgnorar.includes(i));
    const originalesNuevos = indicesNuevos.map(i => originales[i]!);

    if (!originalesNuevos.length) {
      console.log("No hay archivos nuevos (sin numeración) para procesar.");
      return;
    }

    // --- Bloque de Input JSON ---
    console.log("Nombres actuales encontrados:");
    console.log(JSON.stringify(nombresSinExtension(originalesNuevos), null, 0));

    let nuevosNombresLimpios: string[] = [];
    while (true) {
      const resp = await pregunta("\nPega el array JSON con los nuevos nombres: ");
      try {
        const parsed = JSON.parse(resp);
        if (!Array.isArray(parsed) || parsed.length !== originalesNuevos.length) {
          console.log(`❌ Error: Se esperan ${originalesNuevos.length} nombres.`);
          continue;
        }
        nuevosNombresLimpios = parsed.map(n => limpiarNombre(String(n)));
        break;
      } catch { console.log("❌ JSON inválido."); }
    }

    const nuevosConExtension = reemplazarNombres(originalesNuevos, nuevosNombresLimpios);
    
    // --- Selección de archivos ---
    let listaFinalNombres: string[] = [...originales];
    let indicesParaNumerar: number[] = [];

    const opcion = (await pregunta("\nOpciones: 1. Todo  2. Selección individual  3. Cancelar [1]: ")) || "1";
    
    if (opcion === "3") return;

    if (opcion === "2") {
      for (let i = 0; i < originalesNuevos.length; i++) {
        const idxOriginal = indicesNuevos[i]!;
        const confirmar = (await pregunta(`¿Renombrar "${originalesNuevos[i]}" a "${nuevosConExtension[i]}"? (s/n) [s]: `)) || "s";
        
        if (confirmar.toLowerCase() === "s") {
          listaFinalNombres[idxOriginal] = nuevosConExtension[i]!;
          indicesParaNumerar.push(idxOriginal);
        }
        // Si es "n", listaFinalNombres[idxOriginal] ya contiene el nombre original y no se añade a numeración
      }
    } else {
      indicesNuevos.forEach((idx, i) => {
        listaFinalNombres[idx] = nuevosConExtension[i]!;
        indicesParaNumerar.push(idx);
      });
    }

    // --- Lógica de Numeración ---
    const numerosLista = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    console.log(`\nÚltimo número de 2 cifras detectado: ${ultimoNumero === -1 ? "Ninguno" : ultimoNumero}`);
    const startResp = await pregunta("Número inicial (0, 15... 23) o 'c' para continuar: ");
    
    let startNumero: number;
    if (startResp.toLowerCase() === "c") {
      const idxActual = numerosLista.indexOf(ultimoNumero);
      startNumero = (idxActual !== -1) ? (numerosLista[(idxActual + 1) % numerosLista.length]!) : numerosLista[0]!;
    } else {
      const num = parseInt(startResp);
      startNumero = (!isNaN(num) && numerosLista.includes(num)) ? num : numerosLista[0]!;
    }

    const nombresPropuestos = aplicarNumeracionFinal([...listaFinalNombres], numerosLista, startNumero, indicesParaNumerar, ultimoContador);

    // --- Confirmación Final ---
    mostrarAntesDespues(originales, nombresPropuestos);
    const aplicar = (await pregunta("¿Aplicar cambios físicamente? (s/n) [s]: ")) || "s";

    if (aplicar.toLowerCase() === "s") {
      await renombrarFisicamente(ruta, originales, nombresPropuestos);
      console.log("\n✅ ¡Hecho!");
    } else {
      console.log("\n❌ Operación cancelada.");
    }

  } catch (err) {
    console.error("❌ Error crítico:", err);
  }
}

principal();