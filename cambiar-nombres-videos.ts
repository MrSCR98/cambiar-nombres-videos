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
        ultimoNum2Cifras = numero;
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
    
    resultado[idx] = `${pContador} ${pNumero} ${resultado[idx]}`;
    
    indexEnLista++;
    contador++;
  }

  return resultado;
}

/** 7. Mostrar SOLO los que han cambiado */
function mostrarSoloCambios(originales: Archivo[], propuestos: Archivo[]): void {
  console.log("\n🔹 Vista previa de ARCHIVOS A MODIFICAR 🔹\n");
  let hayCambios = false;

  originales.forEach((orig, i) => {
    const nuevo = propuestos[i]!;
    if (orig !== nuevo) {
      console.log(`${orig.padEnd(45)} → ${nuevo}`);
      hayCambios = true;
    }
  });

  if (!hayCambios) {
    console.log("No hay cambios detectados.");
  }
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

    console.log("Nombres actuales (Nuevos):");
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
    
    let listaEnMemoria: string[] = [...originales];
    let indicesParaNumerar: number[] = [];

    const opcion = (await pregunta("\nOpciones: 1. Todo  2. Selección individual  3. Cancelar [1]: ")) || "1";
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
    console.log(`\nÚltimo número de 2 cifras: ${ultimoNumero === -1 ? "Ninguno" : ultimoNumero}`);
    const startResp = await pregunta("Número inicial o 'c' para continuar: ");
    
    let startNumero: number;
    if (startResp.toLowerCase() === "c") {
      const idxActual = numerosLista.indexOf(ultimoNumero);
      startNumero = (idxActual !== -1) ? (numerosLista[(idxActual + 1) % numerosLista.length]!) : numerosLista[0]!;
    } else {
      const num = parseInt(startResp);
      startNumero = (!isNaN(num) && numerosLista.includes(num)) ? num : numerosLista[0]!;
    }

    const nombresPropuestos = aplicarNumeracionFinal([...listaEnMemoria], numerosLista, startNumero, indicesParaNumerar, ultimoContador);

    // --- AQUÍ ESTÁ EL CAMBIO: SOLO MUESTRA LOS QUE VAN A CAMBIAR ---
    mostrarSoloCambios(originales, nombresPropuestos);

    const aplicar = (await pregunta("¿Aplicar cambios físicamente? (s/n) [s]: ")) || "s";
    if (aplicar.toLowerCase() === "s") {
      await renombrarFisicamente(ruta, originales, nombresPropuestos);
      console.log("\n✅ ¡Archivos actualizados!");
    } else {
      console.log("\n❌ Operación cancelada.");
    }

  } catch (err) {
    console.error("❌ Error:", err);
  }
}

principal();