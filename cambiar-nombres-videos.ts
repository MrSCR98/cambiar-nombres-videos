// cambiar-nombres-videos.ts
import { readdir } from "node:fs/promises";
import readline from "readline";

/**
 * Leer archivos de la carpeta
 */
async function listarArchivos(ruta: string): Promise<string[]> {
  const archivos = await readdir(ruta);
  // Filtrar solo archivos (no carpetas) y ordenar
  return archivos.filter(f => f.isFile).map(f => f.name);
}

/**
 * Función de reemplazo segura con mayúsculas
 */
function reemplazarNombres(originales: string[], nuevos: string[]): string[] {
  if (originales.length !== nuevos.length) {
    throw new Error("La lista nueva no tiene la misma longitud que la original.");
  }

  for (let n of nuevos) {
    if (typeof n !== "string") {
      throw new Error("Todos los elementos de la lista nueva deben ser strings.");
    }
  }

  return originales.map((nombre, i) => {
    const extension = nombre.slice(nombre.lastIndexOf("."));
    return nuevos[i].toUpperCase() + extension;
  });
}

/**
 * Mostrar tabla Antes → Después
 */
function mostrarAntesDespues(originales: string[], nuevos: string[]) {
  console.log("\n🔹 Vista previa Antes / Después 🔹\n");
  originales.forEach((o, i) => {
    console.log(`${o.padEnd(30)} → ${nuevos[i]}`);
  });
  console.log("");
}

/**
 * Leer input del usuario
 */
function pregunta(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans); }));
}

/**
 * Asignar números aleatorios delante de los nombres (opción segura)
 */
function asignarNumerosAleatorios(nombres: string[], numeros: number[], startNumero: number): string[] {
  const nombresAsignados = [...nombres];
  const disponibles = nombres.map((_, idx) => idx); // indices disponibles
  let indexNumero = numeros.indexOf(startNumero);
  if (indexNumero === -1) indexNumero = 0; // si no existe, empezar por el primero

  for (let i = 0; i < nombres.length; i++) {
    if (disponibles.length === 0) break;

    // Elegir un índice aleatorio de los disponibles
    const randIdx = Math.floor(Math.random() * disponibles.length);
    const archivoIdx = disponibles.splice(randIdx, 1)[0];

    // Asignar número actual delante del nombre
    const numero = numeros[indexNumero % numeros.length];
    nombresAsignados[archivoIdx] = `${numero.toString().padStart(2, "0")} ${nombresAsignados[archivoIdx]}`;

    indexNumero++;
  }

  return nombresAsignados;
}

/**
 * Función principal
 */
async function principal() {
  console.log("\n🎬 Cambiar Nombres Videos - Gestor Seguro .shorts\n");

  try {
    const ruta = "E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts";
    const originales = await listarArchivos(ruta);
    if (originales.length === 0) {
      console.log("No se encontraron archivos en la carpeta.");
      return;
    }

    console.log("Archivos encontrados:", originales.length);

    // 1️⃣ Pedir nuevos nombres
    const nuevos: string[] = [];
    for (let i = 0; i < originales.length; i++) {
      const resp = await pregunta(`Nuevo nombre para "${originales[i]}" (sin extensión): `);
      nuevos.push(resp.toUpperCase());
    }

    const renombrados = reemplazarNombres(originales, nuevos);

    // 2️⃣ Mostrar vista previa
    mostrarAntesDespues(originales, renombrados);

    // 3️⃣ Opciones: todos / individual / cancelar
    const opcion = await pregunta("Opciones: 1. Cambiar todos  2. Seleccionar individual  3. Cancelar [1]: ");
    if (opcion === "3") {
      console.log("Operación cancelada. No se hicieron cambios.");
      return;
    } else if (opcion === "2") {
      for (let i = 0; i < originales.length; i++) {
        const confirmar = await pregunta(`¿Cambiar "${originales[i]}" → "${renombrados[i]}"? (s/n) [s]: `);
        if (confirmar.toLowerCase() !== "s" && confirmar !== "") {
          renombrados[i] = originales[i]; // no cambiar
        }
      }
    }

    // 4️⃣ Pedir número inicial para añadir delante
    const numeros = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const startResp = await pregunta("Número inicial para añadir delante (00,15,16...,23) o ENTER para omitir: ");
    let startNumero = parseInt(startResp);
    if (!isNaN(startNumero) && numeros.includes(startNumero)) {
      const conNumeros = asignarNumerosAleatorios(renombrados, numeros, startNumero);
      mostrarAntesDespues(renombrados, conNumeros);
      // Aquí podrías renombrar archivos físicamente si quieres
    }

    console.log("\n✅ Operación finalizada. Lista lista para renombrar o usar en otro paso.");
  } catch (error) {
    console.log("❌ Error inesperado");
    console.error(error);
  }
}

// Ejecutar
principal();