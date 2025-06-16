import type { BoardLayer, Point } from "./types"
import type JSZip from "jszip"

/**
 * Парсер слоев платы из ODB++ файла
 */
export async function parseLayersFromODB(zip: JSZip): Promise<BoardLayer[]> {
  const layers: BoardLayer[] = []
  const layerPaths: string[] = []

  console.log("Начинаем поиск слоев в ODB++ файле...")

  // Выведем список всех файлов в архиве для отладки
  console.log("Все файлы в архиве:")
  const allFiles = Object.keys(zip.files)
    .filter((file) => !zip.files[file].dir)
    .slice(0, 50)
  console.log(allFiles)

  try {
    // Ищем директорию steps, которая содержит информацию о шагах сборки
    // Пробуем разные варианты пути
    const possibleStepsPaths = ["steps", "odb/steps", "data/steps"]

    // Выводим список всех директорий для отладки
    const allDirectories = new Set()

    Object.keys(zip.files).forEach((filePath) => {
      // Разбиваем путь на части и собираем все возможные поддиректории
      const parts = filePath.split("/")
      let currentPath = ""

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += parts[i] + "/"
        allDirectories.add(currentPath)
      }
    })

    console.log([...allDirectories]) // Выводим все найденные директории
    //console.log("Все директории в архиве (первые 20):", allDirectories.slice(0, 20))

    // Пробуем найти директорию steps по всем возможным путям
    let stepsDir = null
    for (const path of possibleStepsPaths) {
      stepsDir = findDirectory(zip, path, true)
      if (stepsDir) {
        console.log(`Найдена директория steps по пути: ${stepsDir}`)
        break
      }
    }

    // Если директория steps не найдена, ищем директорию layers напрямую
    if (!stepsDir) {
      console.log("Директория 'steps' не найдена, ищем директорию layers напрямую")

      // Ищем любую директорию, содержащую "layers"
      const layersDir = Array.from(allDirectories).find((dir) => dir.includes("layers/") || dir.endsWith("layers/"))

      if (layersDir) {
        console.log(`Найдена директория layers напрямую: ${layersDir}`)
        // Получаем список всех поддиректорий в директории layers
        const layerDirs = getSubdirectories(zip, layersDir)

        if (layerDirs.length > 0) {
          console.log(`Найдены директории слоев: ${layerDirs.length}`)
          // Продолжаем парсинг с найденными директориями слоев
          // Создаем искусственный stepsDir и stepDir для совместимости с остальным кодом
          stepsDir = layersDir.substring(0, layersDir.lastIndexOf("layers/"))
          const stepDir = stepsDir
          return parseLayersFromDirectories(zip, layerDirs)
        }
      }

      console.warn("Директория 'layers' не найдена")
      return []
    }

    console.log("Найдена директория steps:", stepsDir)

    // Ищем директорию pcb или другую директорию внутри steps
    const stepDirs = getSubdirectories(zip, stepsDir)
    if (stepDirs.length === 0) {
      console.warn("Не найдены шаги внутри директории 'steps'")
      return []
    }

    // Проверяем наличие директории pcb среди шагов
    let stepDir = stepDirs.find((dir) => dir.toLowerCase().includes("pcb"))
    if (!stepDir) {
      // Если pcb не найден, берем первый шаг
      stepDir = stepDirs[0]
    }
    console.log("Найден шаг сборки:", stepDir)

    // Ищем директорию layers, которая содержит информацию о слоях платы
    let layersDir = findDirectory(zip, `${stepDir}layers`)
    if (!layersDir) {
      // Пробуем альтернативные пути
      layersDir = findDirectory(zip, `${stepDir.replace(/\/$/, "")}_layers`)
    }
    if (!layersDir) {
      // Пробуем найти любую директорию, содержащую "layer" в имени внутри шага
      for (const filename in zip.files) {
        if (zip.files[filename].dir && filename.startsWith(stepDir) && filename.toLowerCase().includes("layer")) {
          layersDir = filename
          break
        }
      }
    }

    if (!layersDir) {
      console.warn(`Директория 'layers' не найдена в шаге ${stepDir}`)
      return []
    }

    console.log("Найдена директория с слоями:", layersDir)

    // Получаем список всех поддиректорий в директории layers
    const layerDirs = getSubdirectories(zip, layersDir)
    console.log("Найдены директории слоев:", layerDirs)

    // Если директорий слоев нет, создаем демо-слои
    if (layerDirs.length === 0) {
      console.warn("Директории слоев не найдены")
      return []
    }

    // Обрабатываем каждую директорию слоя
    return parseLayersFromDirectories(zip, layerDirs)

    // Если не нашли ни одного слоя, возвращаем пустой массив
    if (layers.length === 0) {
      console.warn("Не найдено ни одного слоя")
      return []
    }

    console.log(`Всего найдено слоев: ${layers.length}`)
    return layers
  } catch (error) {
    console.error("Ошибка при парсинге слоев:", error)
    return []
  }
}

/**
 * Парсит слои из списка директорий
 */
async function parseLayersFromDirectories(zip: JSZip, layerDirs: string[]): Promise<BoardLayer[]> {
  const layers: BoardLayer[] = []

  // Обрабатываем каждую директорию слоя
  for (const layerDir of layerDirs) {
    try {
      // Получаем имя слоя из пути директории
      const layerName = layerDir.replace(/\/+$/g, "").split("/").pop() || "unknown"
      console.log(`Обработка слоя: ${layerName}`)

      // Определяем тип и сторону слоя по имени
      const { type, side } = determineLayerTypeAndSide(layerName)
      console.log(`Определен тип слоя: ${type}, сторона: ${side}`)

      // Ищем файлы с данными слоя
      const featureFiles = findFilesInDirectory(zip, layerDir, [
        "features",
        "feat",
        "geometry",
        "data",
        "xml",
        "json",
        "txt",
      ])

      if (featureFiles.length === 0) {
        console.warn(`В директории слоя ${layerDir} не найдены файлы с данными`)
        continue
      }

      console.log(`Найдены файлы с данными слоя ${layerName}:`, featureFiles)

      // Создаем слой
      const layer: BoardLayer = {
        name: layerName,
        type,
        side,
        lines: [],
        circles: [],
        polygons: [],
        texts: [],
        color: getLayerColor(type, side),
        visible: true,
      }

      // Парсим файлы с данными слоя
      for (const featureFile of featureFiles) {
        try {
          const content = await zip.files[featureFile].async("string")
          console.log(`Парсинг файла ${featureFile}, размер: ${content.length} байт`)

          // Определяем формат файла и парсим данные
          if (featureFile.endsWith(".xml")) {
            parseXmlFeatures(content, layer)
          } else if (featureFile.endsWith(".json")) {
            parseJsonFeatures(content, layer)
          } else if (featureFile.endsWith(".features") || featureFile.endsWith(".feat")) {
            parseODBFeatures(content, layer)
          } else {
            parseTextFeatures(content, layer)
          }
        } catch (error) {
          console.error(`Ошибка при парсинге файла ${featureFile}:`, error)
        }
      }

      // Добавляем слой в список
      layers.push(layer)
      console.log(`Слой ${layerName} успешно добавлен в список`)
    } catch (error) {
      console.error(`Ошибка при обработке слоя ${layerDir}:`, error)
    }
  }

  // Добавляем отладочную информацию о найденных элементах
  for (const layer of layers) {
    console.log(`Слой ${layer.name} содержит:`)
    console.log(`- ${layer.lines?.length || 0} линий`)
    console.log(`- ${layer.circles?.length || 0} окружностей`)
    console.log(`- ${layer.polygons?.length || 0} полигонов`)
    console.log(`- ${layer.texts?.length || 0} текстов`)

    // Проверяем, есть ли элементы в слое
    if (
      (layer.lines?.length || 0) +
        (layer.circles?.length || 0) +
        (layer.polygons?.length || 0) +
        (layer.texts?.length || 0) ===
      0
    ) {
      console.warn(`ВНИМАНИЕ: Слой ${layer.name} не содержит элементов!`)
    }

    // Выводим первые 5 элементов каждого типа для отладки
    if (layer.lines && layer.lines.length > 0) {
      console.log("Примеры линий:")
      layer.lines.slice(0, 5).forEach((line, i) => {
        console.log(
          `  Линия ${i}: (${line.start.x}, ${line.start.y}) -> (${line.start.x}, ${line.start.y}), ширина: ${line.width}`,
        )
      })
    }

    if (layer.circles && layer.circles.length > 0) {
      console.log("Примеры окружностей:")
      layer.circles.slice(0, 5).forEach((circle, i) => {
        console.log(`  Окружность ${i}: центр (${circle.center.x}, ${circle.center.y}), радиус: ${circle.radius}`)
      })
    }

    if (layer.polygons && layer.polygons.length > 0) {
      console.log("Примеры полигонов:")
      layer.polygons.slice(0, 5).forEach((polygon, i) => {
        console.log(`  Полигон ${i}: ${polygon.points.length} точек`)
        console.log(
          `    Первые 3 точки: (${polygon.points[0].x}, ${polygon.points[0].y}), (${polygon.points[1].x}, ${polygon.points[1].y}), (${polygon.points[2].x}, ${polygon.points[2].y})`,
        )
      })
    }
  }

  return layers
}

/**
 * Определяет тип и сторону слоя по его имени
 */
function determineLayerTypeAndSide(layerName: string): { type: string; side: string } {
  const lowerName = layerName.toLowerCase()

  // Определяем тип слоя
  let type = "other"

  // Проверяем на медные слои
  if (
    lowerName.includes("copper") ||
    lowerName.includes("signal") ||
    lowerName.includes("conductor") ||
    lowerName.includes("cond") ||
    lowerName.includes("cu") ||
    lowerName.match(/l\d+/) || // L1, L2, etc.
    lowerName.match(/layer\d+/) // LAYER1, LAYER2, etc.
  ) {
    type = "copper"
  }
  // Проверяем на маску
  else if (lowerName.includes("mask") || lowerName.includes("solder") || lowerName.includes("sm")) {
    type = "solder_mask"
  }
  // Проверяем на шелкографию
  else if (
    lowerName.includes("silk") ||
    lowerName.includes("legend") ||
    lowerName.includes("overlay") ||
    lowerName.includes("ss")
  ) {
    type = "silkscreen"
  }
  // Проверяем на контур
  else if (
    lowerName.includes("outline") ||
    lowerName.includes("contour") ||
    lowerName.includes("profile") ||
    lowerName.includes("board") ||
    lowerName.includes("pcb") ||
    lowerName.includes("edge")
  ) {
    type = "outline"
  }
  // Проверяем на сверловку
  else if (
    lowerName.includes("drill") ||
    lowerName.includes("hole") ||
    lowerName.includes("via") ||
    lowerName.includes("pth") ||
    lowerName.includes("npth")
  ) {
    type = "drill"
  }
  // Проверяем на пасту
  else if (lowerName.includes("paste") || lowerName.includes("sp")) {
    type = "paste"
  }
  // Проверяем на запретные зоны
  else if (lowerName.includes("keepout") || lowerName.includes("restrict")) {
    type = "keepout"
  }
  // Проверяем на трассировку
  else if (lowerName.includes("route") || lowerName.includes("routing")) {
    type = "route"
  }

  // Определяем сторону слоя
  let side = "BOTH"

  // Проверяем на верхнюю сторону
  if (
    lowerName.includes("top") ||
    lowerName.includes("t$") ||
    lowerName.includes("_t") ||
    lowerName.endsWith("_t") ||
    lowerName.endsWith(".t") ||
    lowerName.includes(".top") ||
    lowerName.includes("-top") ||
    lowerName.includes("_top")
  ) {
    side = "TOP"
  }
  // Проверяем на нижнюю сторону
  else if (
    lowerName.includes("bot") ||
    lowerName.includes("bottom") ||
    lowerName.includes("b$") ||
    lowerName.includes("_b") ||
    lowerName.endsWith("_b") ||
    lowerName.endsWith(".b") ||
    lowerName.includes(".bot") ||
    lowerName.includes("-bot") ||
    lowerName.includes("_bot")
  ) {
    side = "BOT"
  }
  // Проверяем на внутренние слои
  else if (
    lowerName.includes("inner") ||
    lowerName.includes("internal") ||
    lowerName.includes("in") ||
    lowerName.match(/l[2-9]/) || // L2-L9 обычно внутренние слои
    lowerName.match(/layer[2-9]/) // LAYER2-LAYER9 обычно внутренние слои
  ) {
    side = "INTERNAL"
  }

  // Специальная обработка для распространенных имен слоев
  if (lowerName === "l1" || lowerName === "layer1" || lowerName === "signal1" || lowerName === "sig1") {
    type = "copper"
    side = "TOP"
  } else if (lowerName === "l2" || lowerName === "layer2" || lowerName === "signal2" || lowerName === "sig2") {
    type = "copper"
    side = "INTERNAL"
  } else if (lowerName === "l3" || lowerName === "layer3" || lowerName === "signal3" || lowerName === "sig3") {
    type = "copper"
    side = "INTERNAL"
  } else if (lowerName === "l4" || lowerName === "layer4" || lowerName === "signal4" || lowerName === "sig4") {
    type = "copper"
    side = "BOT"
  } else if (lowerName === "topmask" || lowerName === "topsolder" || lowerName === "soldermask_top") {
    type = "solder_mask"
    side = "TOP"
  } else if (lowerName === "botmask" || lowerName === "bottomsolder" || lowerName === "soldermask_bottom") {
    type = "solder_mask"
    side = "BOT"
  } else if (lowerName === "topsilk" || lowerName === "silkscreen_top") {
    type = "silkscreen"
    side = "TOP"
  } else if (lowerName === "botsilk" || lowerName === "silkscreen_bottom") {
    type = "silkscreen"
    side = "BOT"
  } else if (lowerName === "outline" || lowerName === "board" || lowerName === "contour") {
    type = "outline"
    side = "BOTH"
  } else if (lowerName === "drill" || lowerName === "drills" || lowerName === "holes") {
    type = "drill"
    side = "BOTH"
  }

  return { type, side }
}

/**
 * Парсит XML-файл с данными слоя
 */
function parseXmlFeatures(content: string, layer: BoardLayer): void {
  try {
    // Ищем линии
    const lineRegex =
      /<line[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"[^>]*width="([^"]+)"[^>]*\/>/gi
    let lineMatch

    while ((lineMatch = lineRegex.exec(content)) !== null) {
      const x1 = Number.parseFloat(lineMatch[1])
      const y1 = Number.parseFloat(lineMatch[2])
      const x2 = Number.parseFloat(lineMatch[3])
      const y2 = Number.parseFloat(lineMatch[4])
      const width = Number.parseFloat(lineMatch[5])

      const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

      layer.lines.push({
        start: { x: x1 * scaleFactor, y: y1 * scaleFactor },
        end: { x: x2 * scaleFactor, y: y2 * scaleFactor },
        width: width * scaleFactor,
      })
    }

    // Ищем окружности
    const circleRegex = /<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"[^>]*\/>/gi
    let circleMatch

    while ((circleMatch = circleRegex.exec(content)) !== null) {
      const cx = Number.parseFloat(circleMatch[1])
      const cy = Number.parseFloat(circleMatch[2])
      const r = Number.parseFloat(circleMatch[3])

      const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

      layer.circles.push({
        center: { x: cx * scaleFactor, y: cy * scaleFactor },
        radius: r * scaleFactor,
      })
    }

    // Ищем пады (прямоугольные)
    const rectRegex = /<rect[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"[^>]*\/>/gi
    let rectMatch

    while ((rectMatch = rectRegex.exec(content)) !== null) {
      const x = Number.parseFloat(rectMatch[1])
      const y = Number.parseFloat(rectMatch[2])
      const width = Number.parseFloat(rectMatch[3])
      const height = Number.parseFloat(rectMatch[4])

      const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

      // Создаем полигон для прямоугольника
      const halfWidth = width / 2
      const halfHeight = height / 2
      const points: Point[] = [
        { x: (x - halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor },
        { x: (x + halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor },
        { x: (x + halfWidth) * scaleFactor, y: (y + halfHeight) * scaleFactor },
        { x: (x - halfWidth) * scaleFactor, y: (y + halfHeight) * scaleFactor },
      ]
      layer.polygons.push({ points })
    }

    // Ищем полигоны
    const polygonRegex = /<polygon[^>]*points="([^"]+)"[^>]*\/>/gi
    let polygonMatch

    while ((polygonMatch = polygonRegex.exec(content)) !== null) {
      const pointsStr = polygonMatch[1]
      const pointPairs = pointsStr.trim().split(/\s+/)

      const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

      const points: Point[] = pointPairs.map((pair) => {
        const [x, y] = pair.split(",").map(Number.parseFloat)
        return { x: x * scaleFactor, y: y * scaleFactor }
      })

      layer.polygons.push({ points })
    }

    // Ищем пути (path) - могут быть сложные формы, включая полигоны
    const pathRegex = /<path[^>]*d="([^"]+)"[^>]*\/>/gi
    let pathMatch

    while ((pathMatch = pathRegex.exec(content)) !== null) {
      const pathData = pathMatch[1]

      // Простая обработка путей - преобразуем в полигоны
      // Это упрощенная реализация, для полной поддержки SVG path нужен более сложный парсер
      const commands = pathData.match(/[MLHVZmlhvz][^MLHVZmlhvz]*/g)

      if (commands) {
        const points: Point[] = []
        let currentX = 0
        let currentY = 0

        for (const cmd of commands) {
          const type = cmd[0]
          const args = cmd
            .substring(1)
            .trim()
            .split(/[\s,]+/)
            .map(Number.parseFloat)

          switch (type) {
            case "M": // Move to (absolute)
              currentX = args[0]
              currentY = args[1]
              points.push({ x: currentX, y: currentY })
              break
            case "m": // Move to (relative)
              currentX += args[0]
              currentY += args[1]
              points.push({ x: currentX, y: currentY })
              break
            case "L": // Line to (absolute)
              currentX = args[0]
              currentY = args[1]
              points.push({ x: currentX, y: currentY })
              break
            case "l": // Line to (relative)
              currentX += args[0]
              currentY += args[1]
              points.push({ x: currentX, y: currentY })
              break
            case "H": // Horizontal line to (absolute)
              currentX = args[0]
              points.push({ x: currentX, y: currentY })
              break
            case "h": // Horizontal line to (relative)
              currentX += args[0]
              points.push({ x: currentX, y: currentY })
              break
            case "V": // Vertical line to (absolute)
              currentY = args[0]
              points.push({ x: currentX, y: currentY })
              break
            case "v": // Vertical line to (relative)
              currentY += args[0]
              points.push({ x: currentX, y: currentY })
              break
            // Другие команды (C, S, Q, T, A) требуют более сложной обработки
          }
        }

        if (points.length >= 3) {
          layer.polygons.push({ points })
        }
      }
    }

    // Ищем тексты
    const textRegex = /<text[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*>(.*?)<\/text>/gi
    let textMatch

    while ((textMatch = textRegex.exec(content)) !== null) {
      const x = Number.parseFloat(textMatch[1])
      const y = Number.parseFloat(textMatch[2])
      const content = textMatch[3]

      const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

      layer.texts.push({
        position: { x: x * scaleFactor, y: y * scaleFactor },
        content,
        size: 10 * scaleFactor, // Размер по умолчанию
      })
    }
  } catch (error) {
    console.error("Ошибка при парсинге XML-файла с данными слоя:", error)
  }
}

/**
 * Парсит JSON-файл с данными слоя
 */
function parseJsonFeatures(content: string, layer: BoardLayer): void {
  try {
    const data = JSON.parse(content)

    const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

    // Парсим линии
    if (data.lines) {
      for (const line of data.lines) {
        layer.lines.push({
          start: { x: line.x1 * scaleFactor, y: line.y1 * scaleFactor },
          end: { x: line.x2 * scaleFactor, y: line.y2 * scaleFactor },
          width: (line.width || 1) * scaleFactor,
        })
      }
    }

    // Парсим окружности
    if (data.circles) {
      for (const circle of data.circles) {
        layer.circles.push({
          center: { x: circle.cx * scaleFactor, y: circle.cy * scaleFactor },
          radius: circle.r * scaleFactor,
        })
      }
    }

    // Парсим полигоны
    if (data.polygons) {
      for (const polygon of data.polygons) {
        layer.polygons.push({
          points: polygon.points.map((point: any) => ({ x: point.x * scaleFactor, y: point.y * scaleFactor })),
        })
      }
    }

    // Парсим тексты
    if (data.texts) {
      for (const text of data.texts) {
        layer.texts.push({
          position: { x: text.x * scaleFactor, y: text.y * scaleFactor },
          content: text.content,
          size: (text.size || 10) * scaleFactor,
        })
      }
    }
  } catch (error) {
    console.error("Ошибка при парсинге JSON-файла с данными слоя:", error)
  }
}

/**
 * Парсит заголовок файла features и извлекает метаданные
 * @param content Содержимое файла
 * @returns Объект с метаданными
 */
function parseFileHeader(content: string): Record<string, string> {
  const metadata: Record<string, string> = {}
  const lines = content.split(/\r?\n/)

  // Парсим первые 20 строк файла (обычно заголовок не больше)
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim()

    // Пропускаем пустые строки
    if (!line) continue

    // Парсим строки вида KEY=VALUE
    const keyValueMatch = line.match(/^([^=]+)=(.*)$/)
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim()
      const value = keyValueMatch[2].trim()
      metadata[key] = value
      continue
    }

    // Парсим строки вида #Key_Name=Value
    const commentKeyValueMatch = line.match(/^#([^=]+)=(.*)$/)
    if (commentKeyValueMatch) {
      const key = commentKeyValueMatch[1].trim()
      const value = commentKeyValueMatch[2].trim()
      metadata[key] = value
      continue
    }
  }

  return metadata
}

function parseSymbolDefinitions(content: string): Record<string, any> {
  const symbolDefinitions: Record<string, any> = {}
  const lines = content.split(/\r?\n/)

  let inSymbolSection = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Пропускаем пустые строки и комментарии
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      // Проверяем начало секции символов
      if (trimmedLine.includes("Feature symbol names")) {
        inSymbolSection = true
      }
      // Проверяем конец секции символов
      else if (inSymbolSection && trimmedLine.includes("Feature attribute names")) {
        inSymbolSection = false
      }
      continue
    }

    // Парсим определения символов
    if ((inSymbolSection || trimmedLine.startsWith("$")) && trimmedLine.startsWith("$")) {
      const parts = trimmedLine.split(" ")
      const symbolId = parts[0].substring(1) // Убираем $

      if (parts.length >= 2) {
        const symbolValue = parts[1]

        // Парсим разные типы символов
        if (symbolValue.startsWith("r")) {
          // Круглый пад или отверстие
          const radius = Number.parseFloat(symbolValue.substring(1)) / 1000 // Преобразуем из микрон в мм
          symbolDefinitions[symbolId] = {
            type: "circle",
            radius: radius,
            value: radius,
          }
        } else if (symbolValue.startsWith("rect")) {
          // Прямоугольный пад
          const rectPart = symbolValue.substring(4)
          const dimensions = rectPart.split("x")
          if (dimensions.length >= 2) {
            const width = Number.parseFloat(dimensions[0]) / 1000
            const height = Number.parseFloat(dimensions[1]) / 1000
            let cornerRadius = 0

            // Проверяем наличие радиуса скругления
            if (dimensions.length >= 3 && dimensions[2].startsWith("r")) {
              cornerRadius = Number.parseFloat(dimensions[2].substring(1)) / 1000
            }

            symbolDefinitions[symbolId] = {
              type: "rect",
              width,
              height,
              cornerRadius,
              value: Math.max(width, height),
            }
          }
        } else if (symbolValue.startsWith("s")) {
          // Квадратный пад
          const size = Number.parseFloat(symbolValue.substring(1)) / 1000
          symbolDefinitions[symbolId] = {
            type: "square",
            width: size,
            height: size,
            value: size,
          }
        } else if (symbolValue.startsWith("oval")) {
          // Овальный пад
          const ovalPart = symbolValue.substring(4)
          const dimensions = ovalPart.split("x")
          if (dimensions.length >= 2) {
            const width = Number.parseFloat(dimensions[0]) / 1000
            const height = Number.parseFloat(dimensions[1]) / 1000

            symbolDefinitions[symbolId] = {
              type: "oval",
              width,
              height,
              value: Math.max(width, height),
            }
          }
        } else {
          // Другие типы символов
          symbolDefinitions[symbolId] = {
            type: "unknown",
            value: symbolValue,
          }
        }
      }
    }
  }

  console.log(`Parsed ${Object.keys(symbolDefinitions).length} symbol definitions`)
  return symbolDefinitions
}

/**
 * Парсит атрибуты из строки атрибутов
 * @param attributeString Строка атрибутов (например, ";0=58,1=0")
 * @returns Объект с атрибутами
 */
function parseAttributes(attributeString: string): Record<string, string> {
  const attributes: Record<string, string> = {}

  if (!attributeString || !attributeString.startsWith(";")) {
    return attributes
  }

  // Удаляем начальную точку с запятой
  const attrStr = attributeString.substring(1)

  // Разбиваем на отдельные атрибуты
  const attrPairs = attrStr.split(",")

  for (const pair of attrPairs) {
    const parts = pair.split("=")
    if (parts.length === 2) {
      attributes[parts[0].trim()] = parts[1].trim()
    }
  }

  return attributes
}

/**
 * Улучшенная функция парсинга ODB features
 */
function parseODBFeatures(content: string, layer: BoardLayer): void {
  try {
    const lines = content.split(/\r?\n/)
    console.log(`Parsing ODB features, total lines: ${lines.length}`)

    // Добавим отладочную информацию о содержимом файла
    console.log("First 20 lines of content:", lines.slice(0, 20))

    // Поиск специфических типов элементов в файле
    const padLines = lines.filter((line) => line.startsWith("P ")).length
    const circleLines = lines.filter((line) => line.startsWith("C ")).length
    const arcLines = lines.filter((line) => line.startsWith("A ")).length
    const lineLines = lines.filter((line) => line.startsWith("L ")).length
    const textLines = lines.filter((line) => line.startsWith("T ")).length
    const polygonLines = lines.filter(
      (line) => line.startsWith("POLYGON") || line.startsWith("SHAPE") || line.startsWith("AREA"),
    ).length

    console.log(
      `Found in raw file: ${padLines} pads, ${circleLines} circles, ${arcLines} arcs, ${lineLines} lines, ${textLines} texts, ${polygonLines} polygons`,
    )

    // Парсим заголовок файла
    const metadata = parseFileHeader(content)
    console.log("File metadata:", metadata)

    // Парсим определения символов
    const symbolDefinitions = parseSymbolDefinitions(content)
    console.log(`Found ${Object.keys(symbolDefinitions).length} symbol definitions`)

    // Вывести первые 5 определений символов для отладки
    const symbolKeys = Object.keys(symbolDefinitions).slice(0, 5)
    for (const key of symbolKeys) {
      console.log(`Symbol $${key}:`, symbolDefinitions[key])
    }

    // Счетчики для отладки
    let lineCount = 0
    let arcCount = 0
    let circleCount = 0
    let polygonCount = 0
    let padCount = 0
    const viaCount = 0
    const textCount = 0
    let ovalCount = 0
    let complexPolygonCount = 0

    const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

    // Флаги для парсинга сложных структур
    let inComplexStructure = false
    let inPolygon = false
    let currentPolygon: Point[] | null = null
    let currentPolygonPolarity = "P" // P - positive, N - negative

    // Проходим по всем строкам файла
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line || line.startsWith("#")) {
        continue
      }

      // Пропускаем определения символов и атрибутов
      if (line.startsWith("$") || line.startsWith("@") || line.startsWith("&")) {
        continue
      }

      // Начало сложной структуры (SE)
      if (line === "SE") {
        if (inComplexStructure) {
          // Конец сложной структуры
          console.log("Ending complex structure (SE)")
          inComplexStructure = false
          inPolygon = false
          if (currentPolygon && currentPolygon.length >= 3) {
            console.log(`Adding complex polygon with ${currentPolygon.length} points`)
            // Замыкаем полигон, если он не замкнут
            const firstPoint = currentPolygon[0]
            const lastPoint = currentPolygon[currentPolygon.length - 1]
            if (Math.abs(firstPoint.x - lastPoint.x) > 0.001 || Math.abs(firstPoint.y - lastPoint.y) > 0.001) {
              currentPolygon.push({ ...firstPoint })
            }
            layer.polygons.push({ points: currentPolygon })
            polygonCount++
            complexPolygonCount++
          }
          currentPolygon = null
        } else {
          // Начало сложной структуры
          console.log("Starting complex structure (SE)")
          inComplexStructure = true
        }
        continue
      }

      // Начало полигона внутри сложной структуры (S P 0)
      if (inComplexStructure && line.startsWith("S ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 2) {
          inPolygon = true
          currentPolygon = []
          currentPolygonPolarity = parts[1] // P или N
          console.log(`Starting polygon with polarity ${currentPolygonPolarity}`)
        }
        continue
      }

      // Точки полигона внутри сложной структуры (OB, OS, OE)
      if (inComplexStructure && inPolygon && currentPolygon !== null) {
        if (line.startsWith("OB ")) {
          // Начальная точка полигона
          const parts = line.split(/\s+/)
          if (parts.length >= 3) {
            const x = Number.parseFloat(parts[1])
            const y = Number.parseFloat(parts[2])
            console.log(`Adding start point to polygon: (${x}, ${y})`)
            currentPolygon.push({ x: x * scaleFactor, y: y * scaleFactor })
          }
        } else if (line.startsWith("OS ")) {
          // Промежуточная точка полигона
          const parts = line.split(/\s+/)
          if (parts.length >= 3) {
            // Изменено с >= 2 на >= 3
            const x = Number.parseFloat(parts[1])
            const y = Number.parseFloat(parts[2])
            console.log(`Adding segment point to polygon: (${x}, ${y})`)
            currentPolygon.push({ x: x * scaleFactor, y: y * scaleFactor })
          }
        } else if (line === "OE") {
          // Конец полигона
          if (currentPolygon.length >= 3) {
            console.log(`Closing polygon with ${currentPolygon.length} points`)
            // Замыкаем полигон, если он не замкнут
            const firstPoint = currentPolygon[0]
            const lastPoint = currentPolygon[currentPolygon.length - 1]
            if (Math.abs(firstPoint.x - lastPoint.x) > 0.001 || Math.abs(firstPoint.y - lastPoint.y) > 0.001) {
              currentPolygon.push({ ...firstPoint })
            }
            layer.polygons.push({ points: currentPolygon })
            polygonCount++
            complexPolygonCount++
            console.log(`Added polygon to layer. Total polygons: ${layer.polygons.length}`)
          } else {
            console.warn(`Skipping polygon with insufficient points: ${currentPolygon.length}`)
          }
          inPolygon = false
          currentPolygon = null
        }
        continue
      }

      // Парсим пады (P x y symbol_id P polarity [attributes]) - ТОЛЬКО если это не полигон
      if (line.startsWith("P ") && !line.includes(";") && !inComplexStructure) {
        console.log(`Processing pad line: ${line}`)

        // Разделяем строку на основную часть и атрибуты
        const parts = line.split(";")[0].trim().split(/\s+/)

        if (parts.length >= 4) {
          const x = Number.parseFloat(parts[1])
          const y = Number.parseFloat(parts[2])
          console.log(`Pad position: (${x}, ${y})`)

          // Проверяем, есть ли ссылка на символ (может быть как $123, так и просто 123)
          let symbolId = parts[3]
          if (symbolId.startsWith("$")) {
            symbolId = symbolId.substring(1)
          }

          const symbol = symbolDefinitions[symbolId]
          console.log(`Pad uses symbol ${symbolId}:`, symbol)

          if (symbol) {
            if (symbol.type === "circle") {
              // Круглый пад
              console.log(`Adding circle pad with radius ${symbol.radius}`)
              layer.circles.push({
                center: { x: x * scaleFactor, y: y * scaleFactor },
                radius: symbol.radius * scaleFactor,
              })
              circleCount++
            } else if (symbol.type === "rect" || symbol.type === "square") {
              // Прямоугольный или квадратный пад
              const width = symbol.width
              const height = symbol.height
              console.log(`Adding rectangular pad with width=${width}, height=${height}`)

              // Для обычных прямоугольников создаем простой полигон
              const halfWidth = width / 2
              const halfHeight = height / 2

              const points: Point[] = [
                { x: (x - halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor },
                { x: (x + halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor },
                { x: (x + halfWidth) * scaleFactor, y: (y + halfHeight) * scaleFactor },
                { x: (x - halfWidth) * scaleFactor, y: (y + halfHeight) * scaleFactor },
                { x: (x - halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor }, // Замыкаем полигон
              ]

              layer.polygons.push({ points })
              padCount++
            } else if (symbol.type === "oval") {
              // Овальный пад - преобразуем в окружность для простоты
              const radius = Math.max(symbol.width, symbol.height) / 2
              console.log(`Adding oval pad as circle with radius ${radius}`)
              layer.circles.push({
                center: { x: x * scaleFactor, y: y * scaleFactor },
                radius: radius * scaleFactor,
              })
              ovalCount++
            } else {
              console.log(`Unknown symbol type: ${symbol.type}, adding as circle`)
              // Неизвестный тип - добавляем как маленькую окружность
              layer.circles.push({
                center: { x: x * scaleFactor, y: y * scaleFactor },
                radius: 0.5 * scaleFactor,
              })
            }
          } else {
            console.log(`Symbol ${symbolId} not found, adding as default circle`)
            // Символ не найден - добавляем как маленькую окружность
            layer.circles.push({
              center: { x: x * scaleFactor, y: y * scaleFactor },
              radius: 0.5 * scaleFactor,
            })
          }
        }
        continue
      }

      // Парсим пады с атрибутами (P x y symbol_id P polarity [attributes] ;0=58,1=0) - ТОЛЬКО если это не полигон
      if (line.startsWith("P ") && line.includes(";") && !inComplexStructure) {
        const attributeSplit = line.split(";")
        const mainPart = attributeSplit[0].trim()
        const attributePart = ";" + attributeSplit.slice(1).join(";")

        const parts = mainPart.split(/\s+/)
        if (parts.length >= 4) {
          const x = Number.parseFloat(parts[1])
          const y = Number.parseFloat(parts[2])

          // Проверяем, есть ли ссылка на символ (может быть как $123, так и просто 123)
          let symbolId = parts[3]
          if (symbolId.startsWith("$")) {
            symbolId = symbolId.substring(1)
          }

          const symbol = symbolDefinitions[symbolId]

          // Парсим атрибуты
          const attributes = parseAttributes(attributePart)

          if (symbol) {
            if (symbol.type === "circle") {
              // Круглый пад
              layer.circles.push({
                center: { x: x * scaleFactor, y: y * scaleFactor },
                radius: symbol.radius * scaleFactor,
              })
              circleCount++
            } else if (symbol.type === "rect" || symbol.type === "square") {
              // Прямоугольный или квадратный пад
              const width = symbol.width
              const height = symbol.height
              const cornerRadius = symbol.cornerRadius || 0

              if (cornerRadius > 0) {
                // Для скругленных прямоугольников создаем более сложную форму
                // Это упрощенная реализация - для полной поддержки нужно больше кода
                const halfWidth = width / 2
                const halfHeight = height / 2

                const points: Point[] = [
                  { x: (x - halfWidth + cornerRadius) * scaleFactor, y: (y - halfHeight) * scaleFactor },
                  { x: (x + halfWidth - cornerRadius) * scaleFactor, y: (y - halfHeight) * scaleFactor },
                  { x: (x + halfWidth) * scaleFactor, y: (y - halfHeight + cornerRadius) * scaleFactor },
                  { x: (x + halfWidth) * scaleFactor, y: (y + halfHeight - cornerRadius) * scaleFactor },
                  { x: (x + halfWidth - cornerRadius) * scaleFactor, y: (y + halfHeight) * scaleFactor },
                  { x: (x - halfWidth + cornerRadius) * scaleFactor, y: (y + halfHeight) * scaleFactor },
                  { x: (x - halfWidth) * scaleFactor, y: (y + halfHeight - cornerRadius) * scaleFactor },
                  { x: (x - halfWidth) * scaleFactor, y: (y - halfHeight + cornerRadius) * scaleFactor },
                ]

                layer.polygons.push({ points })
              } else {
                // Для обычных прямоугольников создаем простой полигон
                const halfWidth = width / 2
                const halfHeight = height / 2

                const points: Point[] = [
                  { x: (x - halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor },
                  { x: (x + halfWidth) * scaleFactor, y: (y - halfHeight) * scaleFactor },
                  { x: (x + halfWidth) * scaleFactor, y: (y + halfHeight) * scaleFactor },
                  { x: (x - halfWidth) * scaleFactor, y: (y + halfHeight) * scaleFactor },
                ]

                layer.polygons.push({ points })
              }
              padCount++
            } else if (symbol.type === "oval") {
              // Овальный пад - представляем как окружность для простоты
              const radius = Math.max(symbol.width || symbol.value, symbol.height || symbol.value) / 2
              layer.circles.push({
                center: { x: x * scaleFactor, y: y * scaleFactor },
                radius: radius * scaleFactor,
              })
              ovalCount++
            }
          } else {
            // Символ не найден - добавляем как маленькую окружность
            layer.circles.push({
              center: { x: x * scaleFactor, y: y * scaleFactor },
              radius: 0.5 * scaleFactor,
            })
          }
        }
        continue
      }

      // Парсим дуги (A x1 y1 x2 y2 xc yc width P polarity)
      if (line.startsWith("A ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 7) {
          const x1 = Number.parseFloat(parts[1])
          const y1 = Number.parseFloat(parts[2])
          const x2 = Number.parseFloat(parts[3])
          const y2 = Number.parseFloat(parts[4])
          const xc = Number.parseFloat(parts[5])
          const yc = Number.parseFloat(parts[6])

          // Определяем ширину линии и полярность
          let width = 0.1 // Значение по умолчанию
          let polarity = "P" // Positive по умолчанию

          // Обрабатываем дополнительные параметры
          for (let j = 7; j < parts.length; j++) {
            if (parts[j] === "P" || parts[j] === "N") {
              polarity = parts[j]
            } else if (!isNaN(Number.parseFloat(parts[j]))) {
              // Если это число, это может быть ширина
              const numValue = Number.parseFloat(parts[j])
              if (numValue > 0 && numValue < 1000) {
                // Если значение разумное для ширины линии
                width = numValue / 1000 // Преобразуем из микрон в мм
              }
            }
          }

          console.log(`Parsing arc: (${x1},${y1}) to (${x2},${y2}) center (${xc},${yc}) width=${width}`)

          // Аппроксимируем дугу линиями
          const radius = Math.sqrt(Math.pow(x1 - xc, 2) + Math.pow(y1 - yc, 2))
          const startAngle = Math.atan2(y1 - yc, x1 - xc)
          const endAngle = Math.atan2(y2 - yc, x2 - xc)

          // Определяем направление дуги
          let sweepAngle = endAngle - startAngle
          if (Math.abs(sweepAngle) > Math.PI) {
            if (sweepAngle > 0) {
              sweepAngle -= 2 * Math.PI
            } else {
              sweepAngle += 2 * Math.PI
            }
          }

          // Аппроксимируем дугу 16 сегментами для лучшего качества
          const segments = 16
          for (let j = 0; j < segments; j++) {
            const angle1 = startAngle + (sweepAngle * j) / segments
            const angle2 = startAngle + (sweepAngle * (j + 1)) / segments

            const x1Seg = xc + radius * Math.cos(angle1)
            const y1Seg = yc + radius * Math.sin(angle1)
            const x2Seg = xc + radius * Math.cos(angle2)
            const y2Seg = yc + radius * Math.sin(angle2)

            layer.lines.push({
              start: { x: x1Seg * scaleFactor, y: y1Seg * scaleFactor },
              end: { x: x2Seg * scaleFactor, y: y2Seg * scaleFactor },
              width: Math.max(0.1, width) * scaleFactor,
            })
          }

          arcCount++
          console.log(`Added arc ${arcCount}. Total lines in layer: ${layer.lines.length}`)
        }
        continue
      }

      // Парсим линии (L x1 y1 x2 y2 width P polarity)
      if (line.startsWith("L ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 5) {
          const x1 = Number.parseFloat(parts[1])
          const y1 = Number.parseFloat(parts[2])
          const x2 = Number.parseFloat(parts[3])
          const y2 = Number.parseFloat(parts[4])

          // Определяем ширину линии и полярность
          let width = 0.1 // Значение по умолчанию
          let polarity = "P" // Positive по умолчанию

          for (let j = 5; j < parts.length; j++) {
            if (parts[j] === "P" || parts[j] === "N") {
              polarity = parts[j]
            } else if (parts[j].startsWith("$")) {
              // Ссылка на символ
              const symbolId = parts[j].substring(1)
              const symbol = symbolDefinitions[symbolId]
              if (symbol && symbol.type === "circle") {
                width = symbol.radius * 2
              }
            } else if (!isNaN(Number.parseFloat(parts[j]))) {
              width = Number.parseFloat(parts[j]) / 1000
            }
          }

          layer.lines.push({
            start: { x: x1 * scaleFactor, y: y1 * scaleFactor },
            end: { x: x2 * scaleFactor, y: y2 * scaleFactor },
            width: Math.max(0.1, width) * scaleFactor,
          })

          lineCount++
        }
        continue
      }
    }

    console.log(
      `Parsed ODB features: ${lineCount} lines, ${arcCount} arcs, ${circleCount} circles, ${padCount} pads, ${ovalCount} ovals, ${viaCount} vias, ${polygonCount} polygons (${complexPolygonCount} complex), ${textCount} texts`,
    )

    // Проверяем, что элементы были добавлены в слой
    console.log(
      `Layer now contains: ${layer.lines.length} lines, ${layer.circles.length} circles, ${layer.polygons.length} polygons, ${layer.texts.length} texts`,
    )

    // Выводим информацию о полигонах для отладки
    if (layer.polygons.length > 0) {
      console.log("Polygon details:")
      layer.polygons.slice(0, 3).forEach((polygon, i) => {
        console.log(`  Polygon ${i}: ${polygon.points.length} points`)
        console.log(
          `    First 3 points: ${polygon.points
            .slice(0, 3)
            .map((p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`)
            .join(", ")}`,
        )
      })
    } else {
      console.warn("NO POLYGONS FOUND IN LAYER!")
    }

    // Выводим информацию о дугах для отладки
    if (arcCount > 0) {
      console.log(`Successfully parsed ${arcCount} arcs into line segments`)
    } else {
      console.warn("NO ARCS FOUND IN FILE!")
    }

    // Выводим информацию о структурах SE
    const seLines = content.split(/\r?\n/).filter((line) => line.trim() === "SE").length
    console.log(`Found ${seLines} SE structure markers in file`)

    // Выводим информацию о командах полигонов
    const obLines = content.split(/\r?\n/).filter((line) => line.trim().startsWith("OB ")).length
    const osLines = content.split(/\r?\n/).filter((line) => line.trim().startsWith("OS ")).length
    const oeLines = content.split(/\r?\n/).filter((line) => line.trim() === "OE").length
    console.log(`Found polygon commands: ${obLines} OB, ${osLines} OS, ${oeLines} OE`)

    // Выводим информацию о дугах
    const arcLinesInFile = content.split(/\r?\n/).filter((line) => line.trim().startsWith("A ")).length
    console.log(`Found ${arcLinesInFile} arc commands in file`)
  } catch (error) {
    console.error("Error parsing ODB features:", error)
  }
}

/**
 * Парсит текстовый файл с данными слоя
 */
function parseTextFeatures(content: string, layer: BoardLayer): void {
  const lines = content.split(/\r?\n/)
  // Выводим строки, которые могут содержать определения падов
  const padLines = lines.filter((line) => line.startsWith("P ")).slice(0, 10)
  if (padLines.length > 0) {
    console.log("Pad lines examples:", padLines)
  }

  try {
    const lines = content.split(/\r?\n/)
    console.log(`Parsing text features, total lines: ${lines.length}`)

    // Добавим отладочную информацию о содержимом файла
    console.log(
      "First 10 lines of content:",
      lines
        .slice(0, 10)
        .map((line) => `"${line}"`)
        .join("\n"),
    )

    // Словарь для хранения определений символов (ширин линий, радиусов и т.д.)
    const symbolDefinitions: Record<string, number> = {}

    // Счетчики для отладки
    let lineCount = 0
    let circleCount = 0
    let polygonCount = 0
    let padCount = 0
    let textCount = 0
    let symbolDefCount = 0

    const scaleFactor = 1 // Не масштабируем здесь, масштабирование будет в svg-generator.ts

    // Текущий полигон (для многострочных определений)
    let currentPolygon: Point[] | null = null
    let inPolygonDefinition = false

    // Проходим по всем строкам файла
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line || line.startsWith("#")) {
        continue
      }

      // Парсим определения символов (например, $37 r149.9997)
      if (line.startsWith("$")) {
        const match = line.match(/\$(\d+)\s+([a-zA-Z])(\d+\.?\d*)/)
        if (match) {
          const symbolId = match[1]
          const symbolType = match[2] // r - радиус, w - ширина и т.д.
          const value = Number.parseFloat(match[3]) / 1000 // Преобразуем из микрон в мм
          symbolDefinitions[symbolId] = value
          console.log(`Symbol definition: $${symbolId} ${symbolType}${match[3]} = ${value}`)
          symbolDefCount++
        }
        continue
      }

      // Начало определения полигона
      if (line.startsWith("POLYGON") || line.startsWith("SHAPE") || line.startsWith("AREA")) {
        inPolygonDefinition = true
        currentPolygon = []
        continue
      }

      // Конец определения полигона
      if ((line.startsWith("END") || line === ".") && inPolygonDefinition && currentPolygon) {
        if (currentPolygon.length >= 3) {
          layer.polygons.push({ points: currentPolygon })
          polygonCount++
        }
        inPolygonDefinition = false
        currentPolygon = null
        continue
      }

      // Точки полигона
      if (inPolygonDefinition && currentPolygon) {
        const parts = line.split(/\s+/)
        if (parts.length >= 2) {
          const x = Number.parseFloat(parts[0])
          const y = Number.parseFloat(parts[1])
          if (!isNaN(x) && !isNaN(y)) {
            currentPolygon.push({ x: x * scaleFactor, y: y * scaleFactor })
          }
        }
        continue
      }

      // Парсим линии (L x1 y1 x2 y2 width P 0)
      if (line.startsWith("L ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 5) {
          const x1 = Number.parseFloat(parts[1])
          const y1 = Number.parseFloat(parts[2])
          const x2 = Number.parseFloat(parts[3])
          const y2 = Number.parseFloat(parts[4])
          let width = 0.5 // Значение по умолчанию

          // Пытаемся получить ширину линии
          if (parts.length > 5) {
            const widthSymbol = parts[5]
            if (symbolDefinitions[widthSymbol]) {
              width = symbolDefinitions[widthSymbol]
            } else if (!isNaN(Number.parseFloat(widthSymbol))) {
              width = Number.parseFloat(widthSymbol) / 1000 // Преобразуем из микрон в мм
            }
          }

          layer.lines.push({
            start: { x: x1 * scaleFactor, y: y1 * scaleFactor },
            end: { x: x2 * scaleFactor, y: y2 * scaleFactor },
            width: Math.max(0.5, width * scaleFactor), // Минимальная ширина для видимости
          })

          lineCount++

          // Логируем каждую 100-ю линию для отладки
          if (lineCount % 100 === 0 || lineCount < 5) {
            console.log(`Line ${lineCount}: (${x1},${y1}) to (${x2},${y2}) width=${width}`)
          }
        }
        continue
      }

      // Парсим окружности (C cx cy r)
      if (line.startsWith("C ") || line.startsWith("PAD ") || line.startsWith("VIA ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 4) {
          const cx = Number.parseFloat(parts[1])
          const cy = Number.parseFloat(parts[2])
          let r = 0.5 // Значение по умолчанию

          // Пытаемся получить радиус
          if (parts.length > 3) {
            const radiusSymbol = parts[3]
            if (symbolDefinitions[radiusSymbol]) {
              r = symbolDefinitions[radiusSymbol]
            } else if (!isNaN(Number.parseFloat(radiusSymbol))) {
              r = Number.parseFloat(radiusSymbol) / 1000 // Преобразуем из микрон в мм
            }
          }

          // Для PAD проверяем, есть ли дополнительные параметры (ширина/высота)
          if (line.startsWith("PAD ") && parts.length >= 5) {
            let width = r * 2
            let height = r * 2

            // Если указаны ширина и высота, создаем прямоугольный пад
            if (!isNaN(Number.parseFloat(parts[4]))) {
              width = Number.parseFloat(parts[3]) / 1000
              height = Number.parseFloat(parts[4]) / 1000

              // Если ширина и высота различаются, создаем полигон
              if (Math.abs(width - height) > 0.001) {
                const halfWidth = width / 2
                const halfHeight = height / 2
                const points: Point[] = [
                  { x: (cx - halfWidth) * scaleFactor, y: (cy - halfHeight) * scaleFactor },
                  { x: (cx + halfWidth) * scaleFactor, y: (cy - halfHeight) * scaleFactor },
                  { x: (cx + halfWidth) * scaleFactor, y: (cy + halfHeight) * scaleFactor },
                  { x: (cx - halfWidth) * scaleFactor, y: (cy + halfHeight) * scaleFactor },
                ]
                layer.polygons.push({ points })
                padCount++
                continue
              }
            }
          }

          layer.circles.push({
            center: { x: cx * scaleFactor, y: cy * scaleFactor },
            radius: Math.max(0.5, r * scaleFactor), // Минимальный радиус для видимости
          })

          circleCount++

          // Логируем каждую 100-ю окружность для отладки
          if (circleCount % 100 === 0 || circleCount < 5) {
            console.log(`Circle ${circleCount}: center=(${cx},${cy}) radius=${r}`)
          }
        }
        continue
      }

      // Парсим прямоугольные пады (RECT x y width height [rotation])
      if (line.startsWith("RECT ") || line.startsWith("R ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 5) {
          const x = Number.parseFloat(parts[1])
          const y = Number.parseFloat(parts[2])
          const width = Number.parseFloat(parts[3]) / 1000
          const height = Number.parseFloat(parts[4]) / 1000
          let rotation = 0

          // Проверяем наличие угла поворота
          if (parts.length > 5) {
            rotation = Number.parseFloat(parts[5])
          }

          // Вычисляем координаты углов с учетом поворота
          const cos = Math.cos((rotation * Math.PI) / 180)
          const sin = Math.sin((rotation * Math.PI) / 180)
          const halfWidth = width / 2
          const halfHeight = height / 2

          const points: Point[] = [
            {
              x: (x + halfWidth * cos - halfHeight * sin) * scaleFactor,
              y: (y + halfWidth * sin + halfHeight * cos) * scaleFactor,
            },
            {
              x: (x - halfWidth * cos - halfHeight * sin) * scaleFactor,
              y: (y - halfWidth * sin + halfHeight * cos) * scaleFactor,
            },
            {
              x: (x - halfWidth * cos + halfHeight * sin) * scaleFactor,
              y: (y - halfWidth * sin - halfHeight * cos) * scaleFactor,
            },
            {
              x: (x + halfWidth * cos + halfHeight * sin) * scaleFactor,
              y: (y + halfWidth * sin - halfHeight * cos) * scaleFactor,
            },
          ]

          layer.polygons.push({ points })
          padCount++
        }
        continue
      }

      // Парсим полигоны (P x1 y1 x2 y2 ... xn yn)
      if (line.startsWith("P ")) {
        const parts = line.split(/\s+/)
        if (parts.length >= 5) {
          // Минимум 2 точки (4 координаты) + P
          const points: Point[] = []

          for (let i = 1; i < parts.length - 1; i += 2) {
            if (i + 1 < parts.length) {
              const x = Number.parseFloat(parts[i])
              const y = Number.parseFloat(parts[i + 1])
              if (!isNaN(x) && !isNaN(y)) {
                points.push({ x: x * scaleFactor, y: y * scaleFactor })
              }
            }
          }

          if (points.length >= 3) {
            // Минимум 3 точки для полигона
            layer.polygons.push({ points })
            polygonCount++

            // Логируем каждый 50-й полигон для отладки
            if (polygonCount % 50 === 0 || polygonCount < 5) {
              console.log(
                `Polygon ${polygonCount}: ${points.length} points, first point=(${points[0].x / scaleFactor},${points[0].y / scaleFactor})`,
              )
            }
          }
        }
        continue
      }

      // Парсим текст (T x y text)
      if (line.startsWith("T ")) {
        const match = line.match(/T\s+(\S+)\s+(\S+)\s+(.+)/)
        if (match) {
          const x = Number.parseFloat(match[1])
          const y = Number.parseFloat(match[2])
          const content = match[3]

          layer.texts.push({
            position: { x: x * scaleFactor, y: y * scaleFactor },
            content,
            size: 8 * scaleFactor, // Размер по умолчанию
          })

          textCount++

          // Логируем каждый 20-й текст для отладки
          if (textCount % 20 === 0 || textCount < 5) {
            console.log(`Text ${textCount}: position=(${x},${y}) content="${content}"`)
          }
        }
        continue
      }

      // Парсим пады (P x y symbol_id P polarity)
      if (line.startsWith("P ")) {
        console.log(`Processing pad line: ${line}`)

        const parts = line.split(/\s+/)
        if (parts.length >= 4) {
          const x = Number.parseFloat(parts[1])
          const y = Number.parseFloat(parts[2])

          // Проверяем, есть ли ссылка на символ
          if (parts[3].startsWith("$")) {
            const symbolId = parts[3].substring(1)
            console.log(`Pad uses symbol $${symbolId}`)

            // Ищем символ в определениях
            if (symbolDefinitions[symbolId]) {
              const symbolValue = symbolDefinitions[symbolId]
              console.log(`Found symbol definition, value = ${symbolValue}`)

              // Определяем тип символа по первой букве в определении
              // Ищем соответствующую строку определения символа
              const symbolLine = lines.find((l) => l.trim().startsWith(`$${symbolId} `))
              if (symbolLine) {
                console.log(`Symbol definition line: ${symbolLine}`)

                if (symbolLine.includes(" r")) {
                  // Круглый пад
                  const radius = symbolValue
                  console.log(`Adding circle pad at (${x}, ${y}) with radius ${radius}`)

                  layer.circles.push({
                    center: { x: x * scaleFactor, y: y * scaleFactor },
                    radius: radius * scaleFactor,
                  })
                  circleCount++
                } else if (symbolLine.includes(" s")) {
                  // Квадратный пад
                  const size = symbolValue
                  console.log(`Adding square pad at (${x}, ${y}) with size ${size}`)

                  const halfSize = size / 2
                  const points: Point[] = [
                    { x: (x - halfSize) * scaleFactor, y: (y - halfSize) * scaleFactor },
                    { x: (x + halfSize) * scaleFactor, y: (y - halfSize) * scaleFactor },
                    { x: (x + halfSize) * scaleFactor, y: (y + halfSize) * scaleFactor },
                    { x: (x - halfSize) * scaleFactor, y: (y + halfSize) * scaleFactor },
                    { x: (x - halfSize) * scaleFactor, y: (y - halfSize) * scaleFactor }, // Замыкаем полигон
                  ]

                  layer.polygons.push({ points })
                  padCount++
                } else {
                  // Неизвестный тип - добавляем как маленькую окружность
                  console.log(`Unknown symbol type, adding as default circle`)
                  layer.circles.push({
                    center: { x: x * scaleFactor, y: y * scaleFactor },
                    radius: 0.5 * scaleFactor,
                  })
                  circleCount++
                }
              } else {
                // Если не нашли строку определения, используем значение как радиус
                console.log(`Symbol definition line not found, using value as radius`)
                layer.circles.push({
                  center: { x: x * scaleFactor, y: y * scaleFactor },
                  radius: symbolValue * scaleFactor,
                })
                circleCount++
              }
            } else {
              // Символ не найден - добавляем как маленькую окружность
              console.log(`Symbol $${symbolId} not found, adding as default circle`)
              layer.circles.push({
                center: { x: x * scaleFactor, y: y * scaleFactor },
                radius: 0.5 * scaleFactor,
              })
              circleCount++
            }
          } else {
            // Нет ссылки на символ - добавляем как маленькую окружность
            console.log(`Pad without symbol reference, adding as default circle`)
            layer.circles.push({
              center: { x: x * scaleFactor, y: y * scaleFactor },
              radius: 0.5 * scaleFactor,
            })
            circleCount++
          }
        }
        continue
      }
    }

    // Завершаем текущий полигон, если он есть
    if (inPolygonDefinition && currentPolygon && currentPolygon.length >= 3) {
      layer.polygons.push({ points: currentPolygon })
      polygonCount++
    }

    console.log(
      `Parsed layer data: ${lineCount} lines, ${circleCount} circles, ${padCount} pads, ${polygonCount} polygons, ${textCount} texts, ${symbolDefCount} symbol definitions`,
    )

    // Если не нашли никаких элементов, выводим предупреждение
    if (lineCount === 0 && circleCount === 0 && polygonCount === 0 && padCount === 0 && textCount === 0) {
      console.warn("No features found in the layer. Check if the format is correct.")

      // Выводим больше информации о содержимом файла для отладки
      const contentSample = content.substring(0, 500) + (content.length > 500 ? "..." : "")
      console.log("Content sample:", contentSample)
    }
  } catch (error) {
    console.error("Error parsing text features:", error)
  }
}

/**
 * Возвращает цвет слоя в зависимости от его типа и стороны
 */
function getLayerColor(layerType: string, layerSide: string): string {
  const colorMap: Record<string, Record<string, string>> = {
    copper: {
      TOP: "#c87137",
      BOT: "#b36530",
      INTERNAL: "#a35a2a",
      BOTH: "#c87137",
    },
    solder_mask: {
      TOP: "#0f766e",
      BOT: "#0e7490",
      INTERNAL: "#0c4a6e",
      BOTH: "#0f766e",
    },
    silkscreen: {
      TOP: "#ffffff",
      BOT: "#e5e5e5",
      INTERNAL: "#d4d4d4",
      BOTH: "#ffffff",
    },
    drill: {
      TOP: "#000000",
      BOT: "#1a1a1a",
      INTERNAL: "#333333",
      BOTH: "#000000",
    },
    outline: {
      TOP: "#0c4a6e",
      BOT: "#0c4a6e",
      INTERNAL: "#0c4a6e",
      BOTH: "#0c4a6e",
    },
    paste: {
      TOP: "#c0c0c0",
      BOT: "#a0a0a0",
      INTERNAL: "#808080",
      BOTH: "#c0c0c0",
    },
    keepout: {
      TOP: "#ff69b4",
      BOT: "#ff1493",
      INTERNAL: "#c71585",
      BOTH: "#ff69b4",
    },
    route: {
      TOP: "#9932cc",
      BOT: "#8a2be2",
      INTERNAL: "#9400d3",
      BOTH: "#9932cc",
    },
    other: {
      TOP: "#888888",
      BOT: "#666666",
      INTERNAL: "#444444",
      BOTH: "#888888",
    },
  }

  // Получаем цвет для типа слоя
  const typeColors = colorMap[layerType.toLowerCase()] || colorMap.other

  // Получаем цвет для стороны слоя
  return typeColors[layerSide] || typeColors.BOTH
}

/**
 * Ищет директорию в архиве по пути
 */
function findDirectory(zip: JSZip, path: string, partialMatch = false): string | null {
  // Нормализуем путь поиска
  const normalizedSearchPath = path.replace(/\\/g, "/")
  const searchPathWithSlash = normalizedSearchPath.endsWith("/") ? normalizedSearchPath : normalizedSearchPath + "/"

  console.log(`Ищем директорию: ${searchPathWithSlash}`)

  // Получаем список всех файлов и директорий в архиве
  const allPaths = Object.keys(zip.files)

  // Выводим первые 10 путей для отладки
  console.log("Первые 10 путей в архиве:", allPaths.slice(0, 10))

  // Создаем список всех директорий в архиве
  // Директория определяется как путь, который является префиксом для других путей
  const directories = new Set<string>()

  // Сначала добавляем все пути, которые явно помечены как директории
  allPaths.forEach((path) => {
    if (zip.files[path].dir || path.endsWith("/")) {
      directories.add(path)
    }
  })

  // Затем добавляем все родительские директории для всех путей
  allPaths.forEach((path) => {
    const parts = path.split("/")
    let currentPath = ""

    // Для каждой части пути создаем промежуточную директорию
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += parts[i] + "/"
      directories.add(currentPath)
    }
  })

  const directoriesArray = Array.from(directories)
  console.log(`Найдено директорий в архиве: ${directoriesArray.length}`)
  console.log("Первые 10 директорий:", directoriesArray.slice(0, 10))

  // 1. Сначала ищем точное совпадение
  const exactMatch = directoriesArray.find((dir) => dir === searchPathWithSlash)
  if (exactMatch) {
    console.log(`Найдена директория (точное совпадение): ${exactMatch}`)
    return exactMatch
  }

  if (partialMatch) {
    // 2. Ищем директорию, которая заканчивается на искомый путь
    // Например, если ищем "steps/", найдем "odb/steps/"
    const endsWith = directoriesArray.find((dir) => dir.toLowerCase().endsWith(searchPathWithSlash.toLowerCase()))
    if (endsWith) {
      console.log(`Найдена директория (совпадение по окончанию): ${endsWith}`)
      return endsWith
    }

    // 3. Ищем директорию, которая содержит искомый путь
    const contains = directoriesArray.find((dir) => {
      const lowerDir = dir.toLowerCase()
      const lowerSearch = searchPathWithSlash.toLowerCase()
      return lowerDir.includes(lowerSearch)
    })
    if (contains) {
      console.log(`Найдена директория (содержит искомый путь): ${contains}`)
      return contains
    }

    // 4. Ищем директорию по последней части пути
    const lastPart = normalizedSearchPath.split("/").filter(Boolean).pop()
    if (lastPart) {
      const lastPartMatch = directoriesArray.find((dir) => {
        const dirParts = dir.split("/").filter(Boolean)
        return dirParts.some((part) => part.toLowerCase() === lastPart.toLowerCase())
      })
      if (lastPartMatch) {
        console.log(`Найдена директория (по последней части пути "${lastPart}"): ${lastPartMatch}`)
        return lastPartMatch
      }
    }
  }

  console.log(`Директория не найдена: ${searchPathWithSlash}`)
  return null
}

// Заменим функцию getSubdirectories на более надежную версию
function getSubdirectories(zip: JSZip, directory: string): string[] {
  const normalizedDir = directory.endsWith("/") ? directory : directory + "/"
  console.log(`Ищем поддиректории в директории ${normalizedDir}`)

  // Создаем множество для хранения уникальных поддиректорий
  const subdirs = new Set<string>()

  // Получаем все пути в архиве
  const allPaths = Object.keys(zip.files)

  // Выводим все пути, начинающиеся с указанной директории для отладки
  const relevantPaths = allPaths.filter((path) => path.startsWith(normalizedDir) && path !== normalizedDir)
  console.log(`Пути, начинающиеся с ${normalizedDir}:`, relevantPaths.slice(0, 10))

  // Для каждого пути, начинающегося с указанной директории
  for (const path of relevantPaths) {
    // Получаем относительный путь
    const relativePath = path.substring(normalizedDir.length)
    // Разбиваем относительный путь на части
    const parts = relativePath.split("/")

    // Если есть хотя бы одна часть, добавляем первую часть как поддиректорию
    if (parts.length > 0 && parts[0]) {
      subdirs.add(normalizedDir + parts[0] + "/")
    }
  }

  const result = Array.from(subdirs)
  console.log(`Найдено поддиректорий: ${result.length}`)
  console.log(`Поддиректории:`, result)
  return result
}

/**
 * Ищет файлы в директории по ключевым словам
 */
function findFilesInDirectory(zip: JSZip, directory: string, keywords: string[]): string[] {
  const normalizedDir = directory.replace(/\\/g, "/").endsWith("/")
    ? directory.replace(/\\/g, "/")
    : directory.replace(/\\/g, "/") + "/"
  const files: string[] = []

  console.log(`Ищем файлы в директории ${normalizedDir} по ключевым словам:`, keywords)

  // Сначала ищем файлы непосредственно в указанной директории
  for (const filename in zip.files) {
    if (filename.startsWith(normalizedDir) && !zip.files[filename].dir) {
      const lowerFilename = filename.toLowerCase()

      // Проверяем, содержит ли имя файла хотя бы одно ключевое слово
      if (keywords.some((keyword) => lowerFilename.includes(keyword.toLowerCase()))) {
        files.push(filename)
      }
    }
  }

  // Если файлы не найдены, ищем во всех поддиректориях
  if (files.length === 0) {
    for (const filename in zip.files) {
      if (filename.startsWith(normalizedDir) && !zip.files[filename].dir) {
        // Добавляем все файлы из директории
        files.push(filename)
      }
    }
  }

  // Если файлы все еще не найдены, ищем по частичному совпадению пути
  if (files.length === 0) {
    const dirParts = normalizedDir.split("/").filter(Boolean)
    if (dirParts.length > 0) {
      const lastPart = dirParts[dirParts.length - 1].toLowerCase()

      for (const filename in zip.files) {
        if (!zip.files[filename].dir && filename.toLowerCase().includes(lastPart)) {
          files.push(filename)
        }
      }
    }
  }

  console.log(`Найдено файлов: ${files.length}`)
  return files
}
