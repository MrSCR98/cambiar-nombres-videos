import { readdir, rename } from "node:fs/promises"; 
import readline from "readline";

type Archivo = string;
type NuevosNombres = string[];

/** 1. Leer archivos de la carpeta */
async function listarArchivos(ruta: string): Promise<Archivo[]> {
  try {
    const entries = await readdir(ruta, { withFileTypes: true });
    const archivos = entries.filter(e => e.isFile()).map(e => e.name);
    console.log(`\n📂 Se encontraron ${archivos.length} archivo(s) en la carpeta.`);
    return archivos;
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

/** 3. Limpiar nombre de caracteres inválidos */
function limpiarNombre(nombre: string): string {
  return nombre.replace(/[\\/:*?"<>|]/g, "").trim();
}

/** 🔥 AÑADIDO: Quitar numeración tipo "0000 00 " */
function quitarNumeracion(nombre: string): string {
  return nombre.replace(/^\d{4}\s\d{2}\s+/, "");
}

/** 4. Reemplazar nombres manteniendo extensión */
function reemplazarNombres(originales: Archivo[], nuevos: NuevosNombres): Archivo[] {
  if (originales.length !== nuevos.length) {
    throw new Error("La lista nueva no tiene la misma cantidad de archivos que la original.");
  }
  return originales.map((nombre, i) => {
    const nuevoRaw = nuevos[i];
    if (nuevoRaw === undefined) throw new Error(`El nombre nuevo para "${nombre}" está vacío.`);
    
    const nuevo = limpiarNombre(nuevoRaw);
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
      const contador = parseInt(match[1] || "0", 10);
      const numero = parseInt(match[2] || "0", 10);
      if (!isNaN(contador) && contador > maxContador) {
        maxContador = contador;
        ultimoNum2Cifras = numero;
      }
    }
  });

  return { indicesIgnorar, ultimoContador: maxContador, ultimoNumero: ultimoNum2Cifras };
}

/** 6. Aplicar numeración final con barajado aleatorio de archivos */
function aplicarNumeracionFinal(
  nombres: Archivo[],
  numeros: number[],
  startNumero: number,
  indicesParaNumerar: number[],
  ultimoContador: number
): Archivo[] {
  const resultado = [...nombres];
  
  const indicesAleatorios = [...indicesParaNumerar];
  for (let i = indicesAleatorios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = indicesAleatorios[i]!;
    indicesAleatorios[i] = indicesAleatorios[j]!;
    indicesAleatorios[j] = temp;
  }

  let indexEnLista = numeros.indexOf(startNumero);
  if (indexEnLista === -1) indexEnLista = 0;

  let contador = ultimoContador + 1;

  for (const idx of indicesAleatorios) {
    const num2Cifras = numeros[indexEnLista % numeros.length] ?? 0;
    const pContador = contador.toString().padStart(4, "0");
    const pNumero = num2Cifras.toString().padStart(2, "0");

    resultado[idx] = `${pContador} ${pNumero} ${resultado[idx]}`;
    
    indexEnLista++;
    contador++;
  }

  return resultado;
}

/** 7. Mostrar cambios ORDENADOS por el nuevo número 0000 */
function mostrarSoloCambiosOrdenados(originales: Archivo[], propuestos: Archivo[]): void {
  console.log("\n🔹 Vista previa de archivos que se van a modificar🔹\n");
  
  const cambios: { orig: string, nuevo: string, id: number }[] = [];

  originales.forEach((orig, i) => {
    const nuevo = propuestos[i]!;
    if (orig !== nuevo) {
      // Extraemos el ID (0000) para poder ordenar
      const match = nuevo.match(/^(\d{4})/);
      const id = match ? parseInt(match[1]!, 10) : 0;
      cambios.push({ orig, nuevo, id });
    }
  });

  if (cambios.length === 0) {
    console.log("✅ Todos los archivos están correctos, no hay cambios pendientes.\n");
    return;
  }

  // Ordenamos el array de cambios por el ID numérico
  cambios.sort((a, b) => a.id - b.id);

  cambios.forEach(c => {
    console.log(`${c.orig.padEnd(60)} → ${c.nuevo}`);
  });
}

/** 8. Leer input */
function pregunta(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans ?? ""); }));
}

/** 9. Renombrar físicamente */
async function renombrarFisicamente(ruta: string, originales: Archivo[], nuevos: Archivo[]) {
  const listaParaRenombrar: { orig: string, nuevo: string, id: number }[] = [];

  // Recopilamos los que realmente cambian
  for (let i = 0; i < originales.length; i++) {
    const orig = originales[i]!;
    const nuevo = nuevos[i]!;
    if (orig === nuevo) continue;

    const match = nuevo.match(/^(\d{4})/);
    const id = match ? parseInt(match[1]!, 10) : 0;
    listaParaRenombrar.push({ orig, nuevo, id });
  }

  // Ordenamos por ID antes de ejecutar el rename
  listaParaRenombrar.sort((a, b) => a.id - b.id);

  for (const item of listaParaRenombrar) {
    try {
      await rename(`${ruta}\\${item.orig}`, `${ruta}\\${item.nuevo}`);
      console.log(`✅ "${item.orig}" → "${item.nuevo}"`);
    } catch (err) {
      console.error(`❌ Error al renombrar "${item.orig}":`, err);
    }
  }
}

/** 🔥 Función para limpiar numeración de todos los archivos */
async function preguntarYQuitarNumeracion(ruta: string, archivos: Archivo[]) {
  const limpiarTodo = (await pregunta("\n🧹 ¿Quieres quitar TODA la numeración de TODOS los archivos? (s/n) [n]: ")) || "n";
  
  if (!limpiarTodo.trim().toLowerCase().startsWith("s")) return;

  const sinNumeracion = archivos.map(f => quitarNumeracion(f));

  console.log("\n🔹 Vista previa quitando numeración 🔹\n");
  mostrarSoloCambiosOrdenados(archivos, sinNumeracion);

  const confirmar = (await pregunta("¿Confirmar limpieza total? (s/n) [s]: ")) || "s";

  if (confirmar.trim().toLowerCase().startsWith("s")) {
    await renombrarFisicamente(ruta, archivos, sinNumeracion);
    console.log("\n🎉 Numeración eliminada correctamente!");
  } else {
    console.log("\n❌ Limpieza cancelada.");
  }
}

/** FUNCIÓN PRINCIPAL */
async function principal(): Promise<void> {
  console.log("\n🎬 GESTOR DE RENOMBRADO .SHORTS\n");

  try {
    const ruta = "E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts2";
    const originales = await listarArchivos(ruta);

    if (!originales.length) {
      console.log("⚠️ Carpeta vacía. Coloca archivos dentro y vuelve a ejecutar.");
      return;
    }

    const { indicesIgnorar, ultimoContador, ultimoNumero } = detectarEstadoCarpeta(originales);
    const indicesNuevos = originales.map((_, i) => i).filter(i => !indicesIgnorar.includes(i));
    const originalesNuevos = indicesNuevos.map(i => originales[i]!);

    //if (!originalesNuevos.length) {
    //  console.log("ℹ️ No hay archivos nuevos sin numeración para procesar.");
    //  return;
    //}

    if (!originalesNuevos.length) {
  console.log("ℹ️ No hay archivos nuevos sin numeración para procesar.");
  await preguntarYQuitarNumeracion(ruta, originales);
  return;
}

    console.log("\n📄 Archivos nuevos detectados:");
    console.log(JSON.stringify(nombresSinExtension(originalesNuevos), null, 0));

    let nuevosNombresLimpios: NuevosNombres = [];

    while (true) {
      const resp = await pregunta("\n📌 Pega aquí un array JSON con los nuevos nombres (ej: [\"Video 1\", \"Video 2\"]):\n> ");
      try {
        const parsed: unknown = JSON.parse(resp);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          if (parsed.length !== originalesNuevos.length) {
            console.log(`❌ Debes ingresar exactamente ${originalesNuevos.length} nombres.`);
            continue;
          }
          nuevosNombresLimpios = (parsed as string[]).map(limpiarNombre);
          break;
        } else {
          console.log("❌ Error: Debe ser un array de strings.");
        }
      } catch {
        console.log("❌ JSON inválido. Asegúrate de usar comillas y corchetes correctos.");
      }
    }

    const nuevosConExtension = reemplazarNombres(originalesNuevos, nuevosNombresLimpios);
    let listaEnMemoria: Archivo[] = [...originales];
    let indicesParaNumerar: number[] = [];

    const opcion = (await pregunta("\nOpciones:\n 1. Renombrar todos\n 2. Selección individual\n 3. Cancelar \n[1]: ")) || "1";
    if (opcion === "3") return;

    if (opcion === "2") {
      for (let i = 0; i < originalesNuevos.length; i++) {
        const idxOriginal = indicesNuevos[i]!;
        const confirmar = (await pregunta(`¿Renombrar "${originalesNuevos[i]}" a "${nuevosConExtension[i]}"? (s/n) [s]: `)) || "s";
        if (confirmar.toLowerCase() === "s") {
          listaEnMemoria[idxOriginal] = nuevosConExtension[i]!;
          indicesParaNumerar.push(idxOriginal);
        }
      }
    } else {
      indicesNuevos.forEach((idx, i) => {
        listaEnMemoria[idx] = nuevosConExtension[i]!;
        indicesParaNumerar.push(idx);
      });
    }

    const numerosLista = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    console.log(`\nÚltimo número utilizado: ${ultimoNumero === -1 ? "Ninguno" : ultimoNumero}`);
    const startResp = await pregunta("Número inicial para numerar archivos (00,15,16,17,18,19,20,21,22,23) o 'c' para continuar automáticamente: ");

    let startNumero: number;
    if (startResp.toLowerCase() === "c") {
      const idxActual = numerosLista.indexOf(ultimoNumero);
      startNumero = (idxActual !== -1) ? (numerosLista[(idxActual + 1) % numerosLista.length] ?? numerosLista[0]!) : numerosLista[0]!;
    } else {
      const numEntrada = parseInt(startResp, 10);
      startNumero = (!isNaN(numEntrada) && numerosLista.includes(numEntrada)) ? numEntrada : numerosLista[0]!;
    }

    const nombresPropuestos = aplicarNumeracionFinal([...listaEnMemoria], numerosLista, startNumero, indicesParaNumerar, ultimoContador);

    // VISTA PREVIA ORDENADA
    mostrarSoloCambiosOrdenados(originales, nombresPropuestos);

    const aplicar = (await pregunta("¿Deseas aplicar los cambios físicamente? (s/n) [s]: ")) || "s";
    if (aplicar.toLowerCase() === "s") {
      await renombrarFisicamente(ruta, originales, nombresPropuestos);
      console.log("\n🎉 ¡Archivos actualizados correctamente!");
    } else {
      console.log("\n❌ Operación cancelada por el usuario.");
    }

    // 🔥 OPCIÓN GLOBAL FINAL
    await preguntarYQuitarNumeracion(ruta, originales);

  } catch (err) {
    console.error("❌ Error inesperado:", err);
  }
}

principal();