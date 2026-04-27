# 🎬 Gestor de Renombrado de Vídeos .SHORTS

Este programa te ayuda a renombrar automáticamente tus vídeos en la carpeta .shorts.  
Incluye limpieza de nombres, eliminación de caracteres inválidos, numeración automática y opción de quitar numeración existente.

> [!TIP]  
> Si quieres un .exe para Windows, puedes crear uno usando **Deno**. Esto se explica más abajo.

---

## ⚡ Cómo funciona el programa (explicado para principiantes)

El código está dividido en varias funciones que hacen cosas específicas:

---

1️⃣ Abrir la carpeta donde están tus vídeos

- Asegúrate de que todos los vídeos que quieres renombrar estén en la carpeta ".shorts".
- Cambia la ruta dentro del archivo si es necesario:
  const ruta = 'E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts'

---

2️⃣ Ejecutar el programa

> deno task dev o el .exe

- La consola mostrará algo como:
- 📂 Se encontraron 5 archivos en la carpeta
  - vídeo01.mp4
  - vídeo02.mp4
  - vídeo03.mp4
  - 0001 15 VIEJO.MP4
  - 0002 16 OTRO.MP4

---

3️⃣ Ver archivos nuevos (sin numeración)

- Te mostrará solo los archivos que no tienen numeración.
- Ejemplo:
  Archivos nuevos detectados: ["VIDEO01", "VIDEO02", "VIDEO03"]

---

4️⃣ Pegar nuevos nombres

- Te pedirá un array JSON con los nuevos nombres de tus vídeos:
  > ["MI PRIMER VIDEO", "MI SEGUNDO VIDEO", "MI TERCER VIDEO"]
- ⚠️ Debes poner **exactamente la misma cantidad de nombres** que de archivos nuevos.
- Usa **mayúsculas** y evita caracteres raros como \\/:\*?"<>|

---

5️⃣ Elegir cómo renombrar

- Opciones que verás en pantalla:
  1. Renombrar todos (aplica a todos los archivos nuevos)
  2. Selección individual (elige archivo por archivo)
  3. Cancelar (no hace nada)
- Ejemplo: para renombrar todos, escribe:
  > 1

---

6️⃣ Elegir si quieres numeración

- El programa te preguntará primero si quieres añadir numeración a los archivos.
- Si eliges que sí, seguirá este flujo:
  - detecta si ya hay archivos numerados
  - te ofrece quitar la numeración antes de continuar
  - te deja elegir el número inicial

---

7️⃣ Elegir número inicial

- El programa te mostrará el último número usado y te preguntará desde dónde empezar:
  Número inicial para numerar archivos (00,15,16,17,18,19,20,21,22,23) o 'c' para continuar automáticamente [c]:
- Puedes escribir un número de la lista o simplemente:
  > c

---

8️⃣ Vista previa de cambios

- Antes de renombrar, verás algo como:
  vídeo01.mp4 → 0003 17 MI PRIMER VÍDEO.MP4
  vídeo02.mp4 → 0004 18 MI SEGUNDO VÍDEO.MP4
  vídeo03.mp4 → 0005 19 MI TERCER VÍDEO.MP4
- ⚠️ Aquí puedes revisar que todo esté correcto.

---

9️⃣ Confirmar cambios

- El programa te preguntará si quieres aplicarlos:
  ¿Aplicar cambios físicamente? (s/n) [s]:
- Para aplicar:
  > s

---

🔟 Quitar numeración (opcional)

- Al final te preguntará si quieres quitar la numeración de todos los archivos:
  🧹 Hay X archivo(s) con numeración. ¿Quieres quitarla? (s/n) [n]:
- Para cancelar:
  > n

---

🎉 Resultado final

- Todos tus archivos nuevos estarán renombrados con numeración y nombres limpios.
- Verás mensajes como:
  ✅ "vídeo01.mp4" → "0003 17 MI PRIMER VÍDEO.MP4"
- Y listo, ya puedes subir tus vídeos sin problemas.

---

## 🖥️ Uso rápido

1. Instala Deno: [https://deno.com](https://deno.com)

2. Cambia la ruta de la carpeta:

```ts
const ruta = 'E:\\SERGIPC\\Action Videos\\VIDEOS PARA SUBIR\\.shorts'
```

3. Ejecuta el programa:

```bash
deno task dev
```

4. Sigue las instrucciones en pantalla:
   - Pega un array JSON con los nuevos nombres.
   - Decide si quieres renombrar todos o individualmente.
   - Confirma los cambios.

---

## 💻 Crear un ejecutable (.exe) con Deno

1. Asegúrate de tener este `deno.json`:

```json
{
  "tasks": {
    "dev": "deno run --watch --allow-read=\\"E:\\\\SERGIPC\\\\Action Videos\\\\VIDEOS PARA SUBIR\\\\.shorts\\" --allow-write=\\"E:\\\\SERGIPC\\\\Action Videos\\\\VIDEOS PARA SUBIR\\\\.shorts\\" cambiar-nombres-videos.ts",
    "exe": "deno compile --allow-read=\\"E:\\\\SERGIPC\\\\Action Videos\\\\VIDEOS PARA SUBIR\\\\.shorts\\" --allow-write=\\"E:\\\\SERGIPC\\\\Action Videos\\\\VIDEOS PARA SUBIR\\\\.shorts\\" --icon .icono\\\\favicon_256x256.ico -o exe/cambiar-nombres.exe cambiar-nombres-videos.ts"
  },
  "imports": {}
}
```

2. Ejecuta:

```bash
deno task exe
```

3. Obtendrás exe/cambiar-nombres.exe listo para usar en Windows.

---

## ⚠️ Consejos

- Revisa siempre la **vista previa** antes de aplicar cambios.
- Los nombres deben estar en **mayúsculas** y sin caracteres inválidos.
- Puedes usar la opción de quitar numeración para limpiar archivos antiguos.
- Si un archivo falla al renombrar, el programa reintenta varias veces antes de marcarlo como fallo.

---

## 🤝 Contribuciones

Puedes ayudar a mejorar la herramienta:

- Mejorando el flujo de numeración y barajado de archivos.
- Mejorando los mensajes de la consola para principiantes.
- Añadiendo soporte para otros formatos de archivos o reglas de limpieza.
