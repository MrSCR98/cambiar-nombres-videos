import { readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

type Archivo = string
type NuevosNombres = string[]

// ─────────────────────────────────────────────
// FS
// ─────────────────────────────────────────────

async function listarArchivos(ruta: string): Promise<Archivo[]> {
  try {
    const entries = await readdir(ruta, { withFileTypes: true })
    const archivos = entries.filter((e) => e.isFile()).map((e) => e.name)
    console.log(
      `\n📂 Se encontraron ${archivos.length} archivo(s) en la carpeta.`
    )
    return archivos
  } catch (err) {
    console.error('❌ Error al leer la carpeta:', err)
    return []
  }
}

async function renombrarSeguro(
  origen: string,
  destino: string,
  intentos = 3
): Promise<{ ok: boolean; error?: unknown }> {
  for (let i = 0; i < intentos; i++) {
    try {
      await rename(origen, destino)
      return { ok: true }
    } catch (err) {
      if (i === intentos - 1) return { ok: false, error: err }
      await Bun.sleep(300)
    }
  }
  return { ok: false }
}

async function renombrarFisicamente(
  ruta: string,
  originales: Archivo[],
  nuevos: Archivo[]
): Promise<void> {
  const lista: { orig: string; nuevo: string; id: number }[] = []

  for (let i = 0; i < originales.length; i++) {
    const orig = originales[i]!
    const nuevo = nuevos[i]!
    if (orig === nuevo) continue
    const match = nuevo.match(/^(\d{4})/)
    const id = match ? parseInt(match[1]!, 10) : 0
    lista.push({ orig, nuevo, id })
  }

  if (lista.length === 0) {
    console.log('\nℹ️  No hay cambios que aplicar.')
    return
  }

  lista.sort((a, b) => a.id - b.id)

  const fallos: { archivo: string; error: unknown }[] = []

  for (const item of lista) {
    const res = await renombrarSeguro(
      join(ruta, item.orig),
      join(ruta, item.nuevo)
    )
    if (res.ok) {
      console.log(`✅ "${item.orig}" → "${item.nuevo}"`)
    } else {
      console.log(`⚠️  Falló: "${item.orig}"`)
      fallos.push({ archivo: item.orig, error: res.error })
    }
  }

  console.log('\n📊 RESUMEN')
  console.log(`✔️  Correctos: ${lista.length - fallos.length}`)
  console.log(`❌ Fallidos:  ${fallos.length}`)
  if (fallos.length > 0) {
    console.log('\n⚠️  Archivos que fallaron:')
    fallos.forEach((f) => console.log(`- ${f.archivo}`))
  }
}

// ─────────────────────────────────────────────
// NOMBRES
// ─────────────────────────────────────────────

function nombresSinExtension(archivos: Archivo[]): string[] {
  return archivos.map((f) => {
    const idx = f.lastIndexOf('.')
    return idx !== -1 ? f.slice(0, idx) : f
  })
}

function limpiarNombre(nombre: string): string {
  return nombre.replace(/[\\/:*?"<>|]/g, '').trim()
}

function quitarNumeracion(nombre: string): string {
  return nombre.replace(/^\d{4}\s\d{2}\s+/, '')
}

function tieneNumeracion(nombre: string): boolean {
  return /^\d{4}\s\d{2}\s/.test(nombre)
}

function reemplazarNombres(
  originales: Archivo[],
  nuevos: NuevosNombres
): Archivo[] {
  if (originales.length !== nuevos.length) {
    throw new Error(
      'La lista nueva no tiene la misma cantidad de archivos que la original.'
    )
  }
  return originales.map((nombre, i) => {
    const nuevoRaw = nuevos[i]
    if (nuevoRaw === undefined)
      throw new Error(`El nombre nuevo para "${nombre}" está vacío.`)
    const nuevo = limpiarNombre(nuevoRaw)
    if (nuevo.length === 0)
      throw new Error(
        `El nombre nuevo para "${nombre}" quedó vacío tras limpiar caracteres inválidos.`
      )
    const idx = nombre.lastIndexOf('.')
    const extension = idx !== -1 ? nombre.slice(idx) : ''
    return `${nuevo.toUpperCase()}${extension}`
  })
}

// ─────────────────────────────────────────────
// ESTADO DE LA CARPETA
// ─────────────────────────────────────────────

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
      const contador = parseInt(match[1] || '0', 10)
      const numero = parseInt(match[2] || '0', 10)
      if (!isNaN(contador) && contador > maxContador) {
        maxContador = contador
        ultimoNum2Cifras = numero
      }
    }
  })

  return {
    indicesIgnorar,
    ultimoContador: maxContador,
    ultimoNumero: ultimoNum2Cifras,
  }
}

// ─────────────────────────────────────────────
// NUMERACIÓN
// ─────────────────────────────────────────────

function aplicarNumeracionFinal(
  nombres: Archivo[],
  numeros: number[],
  startNumero: number,
  indicesParaNumerar: number[],
  ultimoContador: number
): Archivo[] {
  const resultado = [...nombres]
  const indicesAleatorios = [...indicesParaNumerar]

  for (let i = indicesAleatorios.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = indicesAleatorios[i]!
    indicesAleatorios[i] = indicesAleatorios[j]!
    indicesAleatorios[j] = temp
  }

  let indexEnLista = numeros.indexOf(startNumero)
  if (indexEnLista === -1) indexEnLista = 0
  let contador = ultimoContador + 1

  for (const idx of indicesAleatorios) {
    const num2Cifras = numeros[indexEnLista % numeros.length] ?? 0
    const pContador = contador.toString().padStart(4, '0')
    const pNumero = num2Cifras.toString().padStart(2, '0')
    resultado[idx] = `${pContador} ${pNumero} ${resultado[idx]}`
    indexEnLista++
    contador++
  }

  return resultado
}

// ─────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────

/**
 * Para preguntas cortas (s/n, opciones 1/2/3, número) → prompt() nativo, rápido.
 * Para el pegado del array JSON largo → readline sobre stdin, sin límite de longitud.
 */

function preguntaSN(texto: string, defecto: 's' | 'n'): boolean {
  const etiqueta = defecto === 's' ? '(s/n) [s]' : '(s/n) [n]'
  while (true) {
    const raw = (prompt(`${texto} ${etiqueta}: `) ?? '').trim().toLowerCase()
    if (raw === '') return defecto === 's'
    if (raw === 's') return true
    if (raw === 'n') return false
    console.log('⚠️  Escribe "s" para sí o "n" para no.')
  }
}

function pregunta(texto: string): string {
  return (prompt(texto) ?? '').trim()
}

/** Lee una línea completa de stdin sin límite de longitud — para el JSON largo */
function leerLineaLarga(promptTexto: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptTexto)
    const rl = createInterface({ input: process.stdin, terminal: false })
    rl.once('line', (line) => {
      rl.close()
      resolve(line.trim())
    })
  })
}

function mostrarSoloCambiosOrdenados(
  originales: Archivo[],
  propuestos: Archivo[]
): void {
  console.log('\n🔹 Vista previa de cambios 🔹\n')

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
    console.log('✅ No hay cambios pendientes.\n')
    return
  }

  cambios.sort((a, b) => a.id - b.id)
  cambios.forEach((c) => console.log(`${c.orig.padEnd(60)} → ${c.nuevo}`))
}

// ─────────────────────────────────────────────
// FLUJO: PEDIR NOMBRES NUEVOS
// ─────────────────────────────────────────────

async function pedirNombresNuevos(
  originalesNuevos: Archivo[]
): Promise<NuevosNombres> {
  const total = originalesNuevos.length

  while (true) {
    // Usamos readline para el JSON — prompt() de Bun trunca textos largos con emojis
    const resp = await leerLineaLarga(
      '\n📌 Pega aquí un array JSON con los nuevos nombres (ej: ["Video 1", "Video 2"]):\n> '
    )

    if (resp === '') {
      console.log('⚠️  No pegaste nada. Inténtalo de nuevo.')
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(resp)
    } catch {
      console.log(
        '❌ JSON inválido. Usa comillas dobles y corchetes. Ej: ["Nombre 1", "Nombre 2"]'
      )
      continue
    }

    if (!Array.isArray(parsed)) {
      console.log('❌ Debe ser un array. Ej: ["Nombre 1", "Nombre 2"]')
      continue
    }

    if (!parsed.every((item) => typeof item === 'string')) {
      console.log('❌ Todos los elementos deben ser strings de texto.')
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

    const limpios = (parsed as string[]).map(limpiarNombre)
    const vacios = limpios
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.length === 0)
    if (vacios.length > 0) {
      console.log(
        `❌ Los siguientes nombres quedaron vacíos tras eliminar caracteres inválidos:\n` +
          vacios
            .map(({ i }) => `   [${i}] "${(parsed as string[])[i]}"`)
            .join('\n')
      )
      continue
    }

    return limpios
  }
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────

async function principal(): Promise<void> {
  console.log('\n🎬 GESTOR DE RENOMBRADO .SHORTS\n')

  try {
    const ruta = 'E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts'
    const originales = await listarArchivos(ruta)

    if (!originales.length) {
      console.log(
        '⚠️  Carpeta vacía. Coloca archivos dentro y vuelve a ejecutar.'
      )
      return
    }

    const { indicesIgnorar, ultimoContador, ultimoNumero } =
      detectarEstadoCarpeta(originales)
    const indicesNuevos = originales
      .map((_, i) => i)
      .filter((i) => !indicesIgnorar.includes(i))
    const originalesNuevos = indicesNuevos.map((i) => originales[i]!)
    const hayNuevos = originalesNuevos.length > 0
    const hayNumerados = indicesIgnorar.length > 0

    // ── Escenario 3: todos ya numerados ──────────────────────────────────────
    if (!hayNuevos) {
      console.log(
        `\nℹ️  Todos los archivos (${originales.length}) ya tienen numeración.`
      )
      if (preguntaSN('\n🧹 ¿Quieres quitarles la numeración?', 's')) {
        const sinNum = originales.map((f) =>
          tieneNumeracion(f) ? quitarNumeracion(f) : f
        )
        mostrarSoloCambiosOrdenados(originales, sinNum)
        if (preguntaSN('\n¿Confirmar?', 's')) {
          await renombrarFisicamente(ruta, originales, sinNum)
          console.log('\n🎉 Numeración eliminada correctamente.')
        } else {
          console.log('\n❌ Cancelado.')
        }
      }
      return
    }

    // ── Escenarios 1 y 2: hay archivos nuevos ────────────────────────────────
    const quiereNumeracion = preguntaSN(
      '\n🔢 ¿Quieres añadir numeración a los archivos?',
      's'
    )

    // ── Escenario 2 + quiere numeración → ofrecer quitar antes ───────────────
    if (hayNumerados && quiereNumeracion) {
      console.log(`\n📌 Hay ${indicesIgnorar.length} archivo(s) ya numerados.`)
      if (
        preguntaSN('¿Quieres quitarles la numeración antes de continuar?', 'n')
      ) {
        const sinNum = originales.map((f) =>
          tieneNumeracion(f) ? quitarNumeracion(f) : f
        )
        mostrarSoloCambiosOrdenados(originales, sinNum)
        if (preguntaSN('\n¿Confirmar?', 's')) {
          await renombrarFisicamente(ruta, originales, sinNum)
          console.log('\n✅ Numeración eliminada. Recargando carpeta...\n')
          await principal()
          return
        }
      }
    }

    // ── Escenario 2 + NO quiere numeración → avisar que se quitará ───────────
    if (hayNumerados && !quiereNumeracion) {
      console.log(
        `\nℹ️  Los ${indicesIgnorar.length} archivo(s) ya numerados perderán su numeración.`
      )
    }

    // ── Pedir nombres nuevos ─────────────────────────────────────────────────
    console.log(
      `\n📄 ${originalesNuevos.length} archivo(s) nuevo(s) sin numerar:`
    )
    console.log(
      '\nCorrige las frases en español de España y pon todas las letras en mayúsculas. Si te paso un array devuelve un array en una sola línea.\n'
    )
    console.log(JSON.stringify(nombresSinExtension(originalesNuevos), null, 0))

    const nuevosNombresLimpios = await pedirNombresNuevos(originalesNuevos)
    const nuevosConExtension = reemplazarNombres(
      originalesNuevos,
      nuevosNombresLimpios
    )

    const listaEnMemoria: Archivo[] = [...originales]
    const indicesParaNumerar: number[] = []

    // ── Selección ────────────────────────────────────────────────────────────
    let opcion = '1'
    while (true) {
      opcion = pregunta(
        '\nOpciones:\n 1. Renombrar todos\n 2. Selección individual\n 3. Cancelar\n[1]: '
      )
      if (opcion === '') {
        opcion = '1'
        break
      }
      if (['1', '2', '3'].includes(opcion)) break
      console.log('⚠️  Escribe 1, 2 o 3.')
    }
    if (opcion === '3') return

    if (opcion === '2') {
      for (let i = 0; i < originalesNuevos.length; i++) {
        const idxOriginal = indicesNuevos[i]!
        if (
          preguntaSN(
            `¿Renombrar "${originalesNuevos[i]}" → "${nuevosConExtension[i]}"?`,
            's'
          )
        ) {
          listaEnMemoria[idxOriginal] = nuevosConExtension[i]!
          indicesParaNumerar.push(idxOriginal)
        }
      }
      if (indicesParaNumerar.length === 0) {
        console.log(
          '\nℹ️  No seleccionaste ningún archivo. Operación cancelada.'
        )
        return
      }
    } else {
      indicesNuevos.forEach((idx, i) => {
        listaEnMemoria[idx] = nuevosConExtension[i]!
        indicesParaNumerar.push(idx)
      })
    }

    // ── Sin numeración ───────────────────────────────────────────────────────
    if (!quiereNumeracion) {
      for (const idx of indicesIgnorar) {
        listaEnMemoria[idx] = quitarNumeracion(originales[idx]!)
      }
      mostrarSoloCambiosOrdenados(originales, listaEnMemoria)
      if (!preguntaSN('\n¿Aplicar cambios físicamente?', 's')) {
        console.log('\n❌ Operación cancelada.')
        return
      }
      await renombrarFisicamente(ruta, originales, listaEnMemoria)
      console.log('\n🎉 ¡Archivos actualizados correctamente!')
      return
    }

    // ── Con numeración: elegir número inicial ────────────────────────────────
    const numerosLista = [0, 15, 16, 17, 18, 19, 20, 21, 22, 23]
    console.log(
      `\nÚltimo número utilizado: ${ultimoNumero === -1 ? 'Ninguno' : ultimoNumero}`
    )

    let startNumero: number
    while (true) {
      const startResp = pregunta(
        "Número inicial (00,15…23) o 'c' para continuar automáticamente [c]: "
      )
      if (startResp === '' || startResp.toLowerCase() === 'c') {
        const idxActual = numerosLista.indexOf(ultimoNumero)
        startNumero =
          idxActual !== -1
            ? (numerosLista[(idxActual + 1) % numerosLista.length] ??
              numerosLista[0]!)
            : numerosLista[0]!
        break
      }
      const numEntrada = parseInt(startResp, 10)
      if (!isNaN(numEntrada) && numerosLista.includes(numEntrada)) {
        startNumero = numEntrada
        break
      }
      console.log(`⚠️  Número no válido. Opciones: ${numerosLista.join(', ')}`)
    }

    const nombresPropuestos = aplicarNumeracionFinal(
      [...listaEnMemoria],
      numerosLista,
      startNumero,
      indicesParaNumerar,
      ultimoContador
    )

    mostrarSoloCambiosOrdenados(originales, nombresPropuestos)

    if (!preguntaSN('\n¿Aplicar cambios físicamente?', 's')) {
      console.log('\n❌ Operación cancelada.')
      return
    }

    await renombrarFisicamente(ruta, originales, nombresPropuestos)
    console.log('\n🎉 ¡Archivos actualizados correctamente!')

    // ── Opción final: quitar numeración ──────────────────────────────────────
    const actualizados = await listarArchivos(ruta)
    const conNum = actualizados.filter(tieneNumeracion)
    if (conNum.length > 0) {
      if (
        preguntaSN(
          `\n🧹 Hay ${conNum.length} archivo(s) con numeración. ¿Quieres quitarla?`,
          'n'
        )
      ) {
        const sinNum = actualizados.map((f) =>
          tieneNumeracion(f) ? quitarNumeracion(f) : f
        )
        mostrarSoloCambiosOrdenados(actualizados, sinNum)
        if (preguntaSN('\n¿Confirmar?', 's')) {
          await renombrarFisicamente(ruta, actualizados, sinNum)
          console.log('\n🎉 Numeración eliminada correctamente.')
        } else {
          console.log('\n❌ Cancelado.')
        }
      }
    }
  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

principal()
