import { join } from "jsr:@std/path"
 
type Archivo = string
type NuevosNombres = string[]
 
// ─────────────────────────────────────────────────────────────────────────────
// FS — Funciones que tocan el disco
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Lee todos los archivos (no carpetas) de una ruta y devuelve sus nombres.
 * Si la carpeta no existe o no se puede leer, devuelve array vacío.
 */
async function listarArchivos(ruta: string): Promise<Archivo[]> {
  try {
    const archivos: string[] = []
    // Deno.readDir devuelve un async iterator con cada entrada de la carpeta
    for await (const entry of Deno.readDir(ruta)) {
      if (entry.isFile) archivos.push(entry.name) // solo archivos, ignoramos subcarpetas
    }
    console.log(`\n📂 Se encontraron ${archivos.length} archivo(s) en la carpeta.`)
    return archivos
  } catch (err) {
    console.error("❌ Error al leer la carpeta:", err)
    return []
  }
}
 
/**
 * Intenta renombrar un archivo hasta 3 veces antes de rendirse.
 * Útil cuando el archivo está bloqueado momentáneamente por el SO o un antivirus.
 * Espera 300ms entre intentos.
 */
async function renombrarSeguro(
  origen: string,
  destino: string,
  intentos = 3
): Promise<{ ok: boolean; error?: unknown }> {
  for (let i = 0; i < intentos; i++) {
    try {
      await Deno.rename(origen, destino)
      return { ok: true }
    } catch (err) {
      if (i === intentos - 1) return { ok: false, error: err } // último intento → fallo definitivo
      await new Promise((r) => setTimeout(r, 300)) // esperar antes de reintentar
    }
  }
  return { ok: false }
}
 
/**
 * Aplica físicamente en disco todos los renombrados entre dos listas paralelas.
 * originales[i] → nuevos[i]. Si son iguales, se salta ese archivo.
 * Ordena por el número 0000 antes de ejecutar para evitar conflictos de nombres.
 * Al final muestra un resumen de éxitos y fallos.
 */
async function renombrarFisicamente(
  ruta: string,
  originales: Archivo[],
  nuevos: Archivo[]
): Promise<void> {
  // Construimos la lista de cambios reales (descartamos los que no cambian)
  const lista: { orig: string; nuevo: string; id: number }[] = []
 
  for (let i = 0; i < originales.length; i++) {
    const orig = originales[i]!
    const nuevo = nuevos[i]!
    if (orig === nuevo) continue // sin cambio → saltar
 
    // Extraemos el número 0000 para ordenar antes de renombrar
    const match = nuevo.match(/^(\d{4})/)
    const id = match ? parseInt(match[1]!, 10) : 0
    lista.push({ orig, nuevo, id })
  }
 
  if (lista.length === 0) {
    console.log("\nℹ️  No hay cambios que aplicar.")
    return
  }
 
  // Ordenar por ID numérico evita colisiones cuando dos archivos intercambian nombres
  lista.sort((a, b) => a.id - b.id)
 
  const fallos: { archivo: string; error: unknown }[] = []
 
  for (const item of lista) {
    // join() construye la ruta completa respetando separadores de Windows
    const res = await renombrarSeguro(join(ruta, item.orig), join(ruta, item.nuevo))
    if (res.ok) {
      console.log(`✅ "${item.orig}" → "${item.nuevo}"`)
    } else {
      console.log(`⚠️  Falló: "${item.orig}"`)
      fallos.push({ archivo: item.orig, error: res.error })
    }
  }
 
  // Resumen final
  console.log("\n📊 RESUMEN")
  console.log(`✔️  Correctos: ${lista.length - fallos.length}`)
  console.log(`❌ Fallidos:  ${fallos.length}`)
  if (fallos.length > 0) {
    console.log("\n⚠️  Archivos que fallaron:")
    fallos.forEach((f) => console.log(`- ${f.archivo}`))
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// NOMBRES — Funciones que transforman strings
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Quita la extensión (.mp4, .mkv…) de cada nombre de archivo.
 * Busca el último punto y corta ahí. Si no hay punto, devuelve el nombre tal cual.
 */
function nombresSinExtension(archivos: Archivo[]): string[] {
  return archivos.map((f) => {
    const idx = f.lastIndexOf(".")
    return idx !== -1 ? f.slice(0, idx) : f
  })
}
 
/**
 * Elimina caracteres que Windows no permite en nombres de archivo.
 * Los caracteres prohibidos son: \ / : * ? " < > |
 * También recorta espacios al inicio y al final.
 */
function limpiarNombre(nombre: string): string {
  return nombre.replace(/[\\/:*?"<>|]/g, "").trim()
}
 
/**
 * Quita la numeración del estilo "0000 00 " al inicio del nombre.
 * Ejemplo: "0012 15 MI VIDEO.mp4" → "MI VIDEO.mp4"
 */
function quitarNumeracion(nombre: string): string {
  return nombre.replace(/^\d{4}\s\d{2}\s+/, "")
}
 
/**
 * Detecta si un archivo ya tiene el formato de numeración "0000 00 ".
 */
function tieneNumeracion(nombre: string): boolean {
  return /^\d{4}\s\d{2}\s/.test(nombre)
}
 
/**
 * Construye la lista de nuevos nombres combinando el nombre nuevo con la extensión original.
 * Convierte todo a mayúsculas.
 * Lanza error si las dos listas no tienen el mismo tamaño o si algún nombre queda vacío.
 */
function reemplazarNombres(originales: Archivo[], nuevos: NuevosNombres): Archivo[] {
  if (originales.length !== nuevos.length) {
    throw new Error("La lista nueva no tiene la misma cantidad de archivos que la original.")
  }
  return originales.map((nombre, i) => {
    const nuevoRaw = nuevos[i]
    if (nuevoRaw === undefined) throw new Error(`El nombre nuevo para "${nombre}" está vacío.`)
    const nuevo = limpiarNombre(nuevoRaw)
    if (nuevo.length === 0) throw new Error(`El nombre nuevo para "${nombre}" quedó vacío tras limpiar caracteres inválidos.`)
    // Conservamos la extensión original del archivo
    const idx = nombre.lastIndexOf(".")
    const extension = idx !== -1 ? nombre.slice(idx) : ""
    return `${nuevo.toUpperCase()}${extension}`
  })
}
 
// ─────────────────────────────────────────────────────────────────────────────
// ESTADO — Analiza qué hay en la carpeta
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Recorre la lista de archivos y detecta cuáles ya tienen numeración "0000 00 ".
 * Devuelve:
 *   indicesIgnorar  → posiciones de los archivos ya numerados
 *   ultimoContador  → el número 0000 más alto encontrado (para continuar desde ahí)
 *   ultimoNumero    → el número 00 del archivo con el contador más alto
 */
function detectarEstadoCarpeta(archivos: Archivo[]): {
  indicesIgnorar: number[]
  ultimoContador: number
  ultimoNumero: number
} {
  const regex = /^(\d{4}) (\d{2}) /
  const indicesIgnorar: number[] = []
  let maxContador = -1
  let ultimoNum2Cifras = -1
 
  archivos.forEach((f, idx) => {
    const match = f.match(regex)
    if (match) {
      indicesIgnorar.push(idx)
      const contador = parseInt(match[1] || "0", 10) // número de 4 cifras
      const numero = parseInt(match[2] || "0", 10)   // número de 2 cifras
      // Guardamos el máximo contador para saber desde dónde continuar
      if (!isNaN(contador) && contador > maxContador) {
        maxContador = contador
        ultimoNum2Cifras = numero
      }
    }
  })
 
  return { indicesIgnorar, ultimoContador: maxContador, ultimoNumero: ultimoNum2Cifras }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// NUMERACIÓN — Aplica el prefijo "0000 00 " a los archivos seleccionados
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Añade la numeración aleatoria a los archivos seleccionados.
 * El orden aleatorio hace que los vídeos no aparezcan siempre en el mismo orden.
 *
 * nombres            → lista completa de archivos (ya con nuevos nombres aplicados)
 * numeros            → lista de números de 2 cifras disponibles [0,15,16…23]
 * startNumero        → desde qué número de 2 cifras empezar
 * indicesParaNumerar → qué posiciones de la lista hay que numerar
 * ultimoContador     → último número de 4 cifras usado (continuamos desde ultimoContador+1)
 */
function aplicarNumeracionFinal(
  nombres: Archivo[],
  numeros: number[],
  startNumero: number,
  indicesParaNumerar: number[],
  ultimoContador: number
): Archivo[] {
  const resultado = [...nombres] // copia para no mutar el original
 
  // Fisher-Yates shuffle: mezcla aleatoriamente los índices a numerar
  const indicesAleatorios = [...indicesParaNumerar]
  for (let i = indicesAleatorios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = indicesAleatorios[i]!
    indicesAleatorios[i] = indicesAleatorios[j]!
    indicesAleatorios[j] = temp
  }
 
  // Buscamos la posición de inicio en la lista de números de 2 cifras
  let indexEnLista = numeros.indexOf(startNumero)
  if (indexEnLista === -1) indexEnLista = 0
 
  // El contador de 4 cifras siempre continúa desde el último usado + 1
  let contador = ultimoContador + 1
 
  for (const idx of indicesAleatorios) {
    const num2Cifras = numeros[indexEnLista % numeros.length] ?? 0
    const pContador = contador.toString().padStart(4, "0") // ej: 12 → "0012"
    const pNumero = num2Cifras.toString().padStart(2, "0") // ej: 5  → "05"
    resultado[idx] = `${pContador} ${pNumero} ${resultado[idx]}`
    indexEnLista++
    contador++
  }
 
  return resultado
}
 
// ─────────────────────────────────────────────────────────────────────────────
// UI — Interacción con el usuario
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Pregunta genérica con validación opcional de opciones.
 * Si se pasan opciones, repite la pregunta hasta que la respuesta sea válida.
 * Si no se pasan opciones, devuelve lo que escriba el usuario sin validar.
 * Usa prompt() nativo de Deno — implementado en Rust sobre la API del SO,
 * sin capas intermedias, fiable con cualquier carácter UTF-8 incluyendo emojis.
 */
function pregunta(texto: string, opciones?: string[]): string {
  while (true) {
    const resp = (prompt(texto) ?? "").trim()
    if (!opciones) return resp // sin opciones → devolver directamente
    const lower = resp.toLowerCase()
    if (opciones.includes(lower)) return lower // respuesta válida → devolver
    console.log(`⚠️  Respuesta no válida. Opciones: ${opciones.join(" / ")}`)
  }
}
 
/**
 * Pregunta de sí/no con valor por defecto.
 * Si el usuario pulsa Enter sin escribir nada, se usa el defecto.
 * Solo acepta "s", "n" o Enter. Cualquier otra cosa repite la pregunta.
 */
function preguntaSN(texto: string, defecto: "s" | "n"): boolean {
  const etiqueta = defecto === "s" ? "(s/n) [s]" : "(s/n) [n]"
  while (true) {
    const raw = (prompt(`${texto} ${etiqueta}: `) ?? "").trim().toLowerCase()
    if (raw === "") return defecto === "s" // Enter → usar defecto
    if (raw === "s") return true
    if (raw === "n") return false
    console.log('⚠️  Escribe "s" para sí o "n" para no.')
  }
}
 
/**
 * Muestra una vista previa de los cambios pendientes, ordenados por el número 0000.
 * Solo muestra los archivos que realmente van a cambiar de nombre.
 */
function mostrarSoloCambiosOrdenados(originales: Archivo[], propuestos: Archivo[]): void {
  console.log("\n🔹 Vista previa de cambios 🔹\n")
 
  const cambios: { orig: string; nuevo: string; id: number }[] = []
  originales.forEach((orig, i) => {
    const nuevo = propuestos[i]!
    if (orig !== nuevo) {
      const match = nuevo.match(/^(\d{4})/)
      const id = match ? parseInt(match[1]!, 10) : 0
      cambios.push({ orig, nuevo, id })
    }
  })
 
  if (cambios.length === 0) {
    console.log("✅ No hay cambios pendientes.\n")
    return
  }
 
  cambios.sort((a, b) => a.id - b.id)
  cambios.forEach((c) => console.log(`${c.orig.padEnd(60)} → ${c.nuevo}`))
}
 
// ─────────────────────────────────────────────────────────────────────────────
// INPUT — Lectura del array JSON
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * Pide al usuario que pegue el array JSON con los nuevos nombres.
 * Valida exhaustivamente antes de aceptar:
 *   - Que no esté vacío
 *   - Que sea JSON válido
 *   - Que sea un array de strings
 *   - Que tenga exactamente el mismo número de elementos que archivos hay
 *   - Que ningún nombre quede vacío tras limpiar caracteres inválidos
 *
 * Usa prompt() de Deno que lee stdin de forma nativa sin límite de longitud,
 * lo que lo hace fiable incluso con 500+ títulos con emojis.
 */
function pedirNombresNuevos(originalesNuevos: Archivo[]): NuevosNombres {
  const total = originalesNuevos.length
 
  while (true) {
    const resp = pregunta(
      '\n📌 Pega aquí un array JSON con los nuevos nombres (ej: ["Video 1", "Video 2"]):\n> '
    )
 
    if (resp === "") {
      console.log("⚠️  No pegaste nada. Inténtalo de nuevo.")
      continue
    }
 
    let parsed: unknown
    try {
      parsed = JSON.parse(resp)
    } catch {
      console.log("❌ JSON inválido. Usa comillas dobles y corchetes. Ej: [\"Nombre 1\", \"Nombre 2\"]")
      continue
    }
 
    if (!Array.isArray(parsed)) {
      console.log("❌ Debe ser un array. Ej: [\"Nombre 1\", \"Nombre 2\"]")
      continue
    }
 
    if (!parsed.every((item) => typeof item === "string")) {
      console.log("❌ Todos los elementos deben ser strings de texto.")
      continue
    }
 
    const actual = parsed.length
    if (actual !== total) {
      const diff = actual - total
      console.log(
        `❌ Necesito exactamente ${total} nombres.\n` +
          (actual < total
            ? `   Faltan ${Math.abs(diff)} (${actual}/${total}).`
            : `   Sobran ${diff} (${actual}/${total}).`)
      )
      continue
    }
 
    // Validar que ningún nombre quede vacío tras eliminar caracteres inválidos de Windows
    const limpios = (parsed as string[]).map(limpiarNombre)
    const vacios = limpios.map((n, i) => ({ n, i })).filter(({ n }) => n.length === 0)
    if (vacios.length > 0) {
      console.log(
        `❌ Los siguientes nombres quedaron vacíos tras eliminar caracteres inválidos:\n` +
          vacios.map(({ i }) => `   [${i}] "${(parsed as string[])[i]}"`).join("\n")
      )
      continue
    }
 
    return limpios // todo correcto → salir del bucle
  }
}
 
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
 
async function principal(): Promise<void> {
  console.log("\n🎬 GESTOR DE RENOMBRADO .SHORTS\n")
 
  try {
    const ruta = "E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts"
    const originales = await listarArchivos(ruta)
 
    if (!originales.length) {
      console.log("⚠️  Carpeta vacía. Coloca archivos dentro y vuelve a ejecutar.")
      return
    }
 
    // Analizamos qué hay en la carpeta
    const { indicesIgnorar, ultimoContador, ultimoNumero } = detectarEstadoCarpeta(originales)
 
    // Separamos los archivos sin numerar (los nuevos) de los ya numerados
    const indicesNuevos = originales.map((_, i) => i).filter((i) => !indicesIgnorar.includes(i))
    const originalesNuevos = indicesNuevos.map((i) => originales[i]!)
    const hayNuevos = originalesNuevos.length > 0
    const hayNumerados = indicesIgnorar.length > 0
 
    // ── Escenario 3: todos ya numerados ──────────────────────────────────────
    // No hay nada nuevo que procesar, solo ofrecer quitar numeración
    if (!hayNuevos) {
      console.log(`\nℹ️  Todos los archivos (${originales.length}) ya tienen numeración.`)
      if (preguntaSN("\n🧹 ¿Quieres quitarles la numeración?", "s")) {
        const sinNum = originales.map((f) => (tieneNumeracion(f) ? quitarNumeracion(f) : f))
        mostrarSoloCambiosOrdenados(originales, sinNum)
        if (preguntaSN("\n¿Confirmar?", "s")) {
          await renombrarFisicamente(ruta, originales, sinNum)
          console.log("\n🎉 Numeración eliminada correctamente.")
        } else {
          console.log("\n❌ Cancelado.")
        }
      }
      return
    }
 
    // ── Escenarios 1 y 2: hay archivos nuevos ────────────────────────────────
 
    // Pregunta clave: ¿quiere numeración o solo renombrar?
    // Defecto [s] porque lo más habitual es querer numeración
    const quiereNumeracion = preguntaSN(
      "\n🔢 ¿Quieres añadir numeración a los archivos?",
      "s"
    )
 
    // ── Escenario 2 + quiere numeración → ofrecer quitar numeración antes ────
    if (hayNumerados && quiereNumeracion) {
      console.log(`\n📌 Hay ${indicesIgnorar.length} archivo(s) ya numerados.`)
      if (preguntaSN("¿Quieres quitarles la numeración antes de continuar?", "n")) {
        const sinNum = originales.map((f) => (tieneNumeracion(f) ? quitarNumeracion(f) : f))
        mostrarSoloCambiosOrdenados(originales, sinNum)
        if (preguntaSN("\n¿Confirmar?", "s")) {
          await renombrarFisicamente(ruta, originales, sinNum)
          console.log("\n✅ Numeración eliminada. Recargando carpeta...\n")
          // Relanzamos el programa desde el principio con la carpeta limpia
          await principal()
          return
        }
      }
    }
 
    // ── Escenario 2 + NO quiere numeración → avisar que se quitará la existente
    if (hayNumerados && !quiereNumeracion) {
      console.log(
        `\nℹ️  Los ${indicesIgnorar.length} archivo(s) ya numerados perderán su numeración.`
      )
    }
 
    // ── Mostrar archivos nuevos y pedir los nombres corregidos ────────────────
    if (hayNumerados) {
      console.log(`\n📌 ${indicesIgnorar.length} archivo(s) ya numerados — se procesarán también.`)
    }
 
    console.log(`\n📄 ${originalesNuevos.length} archivo(s) nuevo(s) sin numerar:`)
    console.log(
      "\nCorrige las frases en español de España y pon todas las letras en mayúsculas. Si te paso un array devuelve un array en una sola línea.\n"
    )
    // Mostramos los nombres sin extensión para que sea más fácil copiarlos y editarlos
    console.log(JSON.stringify(nombresSinExtension(originalesNuevos), null, 0))
 
    const nuevosNombresLimpios = pedirNombresNuevos(originalesNuevos)
 
    // Combinamos los nuevos nombres con las extensiones originales
    const nuevosConExtension = reemplazarNombres(originalesNuevos, nuevosNombresLimpios)
 
    // listaEnMemoria es una copia de originales que iremos modificando antes de tocar el disco
    const listaEnMemoria: Archivo[] = [...originales]
    const indicesParaNumerar: number[] = []
 
    // ── Selección: renombrar todos o elegir uno a uno ─────────────────────────
    let opcion = "1"
    while (true) {
      opcion = pregunta("\nOpciones:\n 1. Renombrar todos\n 2. Selección individual\n 3. Cancelar\n[1]: ")
      if (opcion === "") { opcion = "1"; break }
      if (["1", "2", "3"].includes(opcion)) break
      console.log("⚠️  Escribe 1, 2 o 3.")
    }
    if (opcion === "3") return
 
    if (opcion === "2") {
      // Preguntamos archivo por archivo
      for (let i = 0; i < originalesNuevos.length; i++) {
        const idxOriginal = indicesNuevos[i]!
        if (preguntaSN(`¿Renombrar "${originalesNuevos[i]}" → "${nuevosConExtension[i]}"?`, "s")) {
          listaEnMemoria[idxOriginal] = nuevosConExtension[i]!
          indicesParaNumerar.push(idxOriginal)
        }
      }
      // Si no eligió ninguno, cancelamos para no hacer nada
      if (indicesParaNumerar.length === 0) {
        console.log("\nℹ️  No seleccionaste ningún archivo. Operación cancelada.")
        return
      }
    } else {
      // Opción 1: todos los nuevos van a la lista
      indicesNuevos.forEach((idx, i) => {
        listaEnMemoria[idx] = nuevosConExtension[i]!
        indicesParaNumerar.push(idx)
      })
    }
 
    // ── Sin numeración: quitamos la existente y renombramos ───────────────────
    if (!quiereNumeracion) {
      // Los ya numerados pierden su prefijo en listaEnMemoria
      for (const idx of indicesIgnorar) {
        listaEnMemoria[idx] = quitarNumeracion(originales[idx]!)
      }
      mostrarSoloCambiosOrdenados(originales, listaEnMemoria)
      if (!preguntaSN("\n¿Aplicar cambios físicamente?", "s")) {
        console.log("\n❌ Operación cancelada.")
        return
      }
      await renombrarFisicamente(ruta, originales, listaEnMemoria)
      console.log("\n🎉 ¡Archivos actualizados correctamente!")
      return // fin, no hay numeración que añadir
    }
 
    // ── Con numeración: elegir el número de 2 cifras inicial ─────────────────
    const numerosLista = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23]
    console.log(`\nÚltimo número utilizado: ${ultimoNumero === -1 ? "Ninguno" : ultimoNumero}`)
 
    let startNumero: number
    while (true) {
      const startResp = pregunta(
        "Número inicial (00,15…23) o 'c' para continuar automáticamente [c]: "
      )
      if (startResp === "" || startResp.toLowerCase() === "c") {
        // Continuar automáticamente: siguiente en la lista circular
        const idxActual = numerosLista.indexOf(ultimoNumero)
        startNumero =
          idxActual !== -1
            ? (numerosLista[(idxActual + 1) % numerosLista.length] ?? numerosLista[0]!)
            : numerosLista[0]!
        break
      }
      const numEntrada = parseInt(startResp, 10)
      if (!isNaN(numEntrada) && numerosLista.includes(numEntrada)) {
        startNumero = numEntrada
        break
      }
      console.log(`⚠️  Número no válido. Opciones: ${numerosLista.join(", ")}`)
    }
 
    // Generamos la lista final con el prefijo "0000 00 " aplicado aleatoriamente
    const nombresPropuestos = aplicarNumeracionFinal(
      [...listaEnMemoria],
      numerosLista,
      startNumero,
      indicesParaNumerar,
      ultimoContador
    )
 
    mostrarSoloCambiosOrdenados(originales, nombresPropuestos)
 
    if (!preguntaSN("\n¿Aplicar cambios físicamente?", "s")) {
      console.log("\n❌ Operación cancelada.")
      return
    }
 
    await renombrarFisicamente(ruta, originales, nombresPropuestos)
    console.log("\n🎉 ¡Archivos actualizados correctamente!")
 
    // ── Opción final: quitar numeración tras haber numerado ───────────────────
    // Recargamos del disco para trabajar con los nombres reales actualizados
    const actualizados = await listarArchivos(ruta)
    const conNum = actualizados.filter(tieneNumeracion)
    if (conNum.length > 0) {
      // Defecto [n] porque lo normal es que acabes de numerar y no quieras quitarlo
      if (preguntaSN(`\n🧹 Hay ${conNum.length} archivo(s) con numeración. ¿Quieres quitarla?`, "n")) {
        const sinNum = actualizados.map((f) => (tieneNumeracion(f) ? quitarNumeracion(f) : f))
        mostrarSoloCambiosOrdenados(actualizados, sinNum)
        if (preguntaSN("\n¿Confirmar?", "s")) {
          await renombrarFisicamente(ruta, actualizados, sinNum)
          console.log("\n🎉 Numeración eliminada correctamente.")
        } else {
          console.log("\n❌ Cancelado.")
        }
      }
    }
  } catch (err) {
    console.error("❌ Error inesperado:", err)
  }
}
 
// Punto de entrada: solo ejecuta si este archivo es el principal (no si es importado)
if (import.meta.main) {
  await principal()
}