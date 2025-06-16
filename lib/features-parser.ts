import fs from "fs"
import path from "path"
import { parseStringPromise } from "xml2js"

// Типы элементов, которые могут быть в файле features
export type FeatureType =
  | "line"
  | "pad"
  | "arc"
  | "surface"
  | "text"
  | "barcode"
  | "hole"
  | "slot"
  | "fiducial"
  | "unknown"

// Интерфейс для элемента на слое
export interface LayerFeature {
  type: FeatureType
  x: number
  y: number
  width?: number
  height?: number
  diameter?: number
  rotation?: number
  thickness?: number
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  centerX?: number
  centerY?: number
  radius?: number
  startAngle?: number
  endAngle?: number
  points?: { x: number; y: number }[]
  text?: string
  polarity?: "positive" | "negative"
  shape?: string
  plated?: boolean
}

// Интерфейсы для парсера features

export interface Point {
  x: number
  y: number
}

export interface Feature {
  type: string
  x: number
  y: number
  [key: string]: any // Дополнительные свойства в зависимости от типа
}

// Интерфейс для определения символа
interface SymbolDefinition {
  id: string
  type: "r" | "s" | "o" | string // r - круглый, s - квадратный, o - овальный
  value: number
  width?: number
  height?: number
}

/**
 * Находит все файлы features в структуре ODB++
 * @param odbPath Путь к распакованному архиву ODB++
 * @returns Массив путей к файлам features
 */
export async function findFeaturesFiles(
  odbPath: string,
): Promise<{ layerName: string; layerType: string; filePath: string }[]> {
  console.log(`Поиск файлов features в ${odbPath}`)
  const featuresFiles: { layerName: string; layerType: string; filePath: string }[] = []

  try {
    // Проверяем наличие директории steps/pcb/layers
    const layersPath = path.join(odbPath, "steps", "pcb", "layers")
    if (!fs.existsSync(layersPath)) {
      console.log(`Директория ${layersPath} не найдена`)
      return featuresFiles
    }

    // Получаем список директорий слоев
    const layerDirs = fs
      .readdirSync(layersPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)

    console.log(`Найдено ${layerDirs.length} директорий слоев: ${layerDirs.join(", ")}`)

    // Для каждой директории слоя ищем файл features
    for (const layerDir of layerDirs) {
      const featuresPath = path.join(layersPath, layerDir, "features")
      if (fs.existsSync(featuresPath)) {
        // Определяем тип слоя на основе имени директории
        let layerType = "unknown"
        if (layerDir.toLowerCase().includes("top")) {
          layerType = "top"
        } else if (layerDir.toLowerCase().includes("bottom")) {
          layerType = "bottom"
        } else if (layerDir.toLowerCase().includes("drill")) {
          layerType = "drill"
        } else if (layerDir.toLowerCase().includes("silk")) {
          layerType = "silkscreen"
        } else if (layerDir.toLowerCase().includes("mask")) {
          layerType = "soldermask"
        } else if (layerDir.toLowerCase().includes("paste")) {
          layerType = "solderpaste"
        } else if (layerDir.toLowerCase().includes("copper")) {
          layerType = "copper"
        }

        featuresFiles.push({
          layerName: layerDir,
          layerType,
          filePath: featuresPath,
        })
        console.log(`Найден файл features для слоя ${layerDir} (тип: ${layerType})`)
      }
    }
  } catch (error) {
    console.error("Ошибка при поиске файлов features:", error)
  }

  return featuresFiles
}

/**
 * Парсит файл features в формате XML
 * @param filePath Путь к файлу features
 * @returns Массив элементов слоя
 */
async function parseXmlFeatures(filePath: string): Promise<LayerFeature[]> {
  console.log(`Парсинг XML файла features: ${filePath}`)
  const features: LayerFeature[] = []

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8")
    const result = await parseStringPromise(fileContent, { explicitArray: false })

    if (!result.features || !result.features.feature) {
      console.log("XML файл не содержит элементов")
      return features
    }

    const featureArray = Array.isArray(result.features.feature) ? result.features.feature : [result.features.feature]

    for (const feature of featureArray) {
      const featureType = (feature.$.type as FeatureType) || "unknown"
      const x = Number.parseFloat(feature.$.x || "0")
      const y = Number.parseFloat(feature.$.y || "0")

      const baseFeature: LayerFeature = {
        type: featureType,
        x,
        y,
        polarity: feature.$.polarity === "negative" ? "negative" : "positive",
      }

      switch (featureType) {
        case "line":
          features.push({
            ...baseFeature,
            width: Number.parseFloat(feature.$.width || "0"),
            startX: x,
            startY: y,
            endX: Number.parseFloat(feature.$.endX || "0"),
            endY: Number.parseFloat(feature.$.endY || "0"),
            thickness: Number.parseFloat(feature.$.thickness || "0"),
          })
          break

        case "pad":
          features.push({
            ...baseFeature,
            width: Number.parseFloat(feature.$.width || "0"),
            height: Number.parseFloat(feature.$.height || "0"),
            diameter: Number.parseFloat(feature.$.diameter || "0"),
            rotation: Number.parseFloat(feature.$.rotation || "0"),
            shape: feature.$.shape || "round",
            plated: feature.$.plated === "yes",
          })
          break

        case "arc":
          features.push({
            ...baseFeature,
            centerX: Number.parseFloat(feature.$.centerX || "0"),
            centerY: Number.parseFloat(feature.$.centerY || "0"),
            radius: Number.parseFloat(feature.$.radius || "0"),
            startAngle: Number.parseFloat(feature.$.startAngle || "0"),
            endAngle: Number.parseFloat(feature.$.endAngle || "0"),
            thickness: Number.parseFloat(feature.$.thickness || "0"),
          })
          break

        case "surface":
          const points: { x: number; y: number }[] = []
          if (feature.contour && feature.contour.point) {
            const pointArray = Array.isArray(feature.contour.point) ? feature.contour.point : [feature.contour.point]

            for (const point of pointArray) {
              points.push({
                x: Number.parseFloat(point.$.x || "0"),
                y: Number.parseFloat(point.$.y || "0"),
              })
            }
          }

          features.push({
            ...baseFeature,
            points,
          })
          break

        case "text":
          features.push({
            ...baseFeature,
            text: feature.$.text || "",
            rotation: Number.parseFloat(feature.$.rotation || "0"),
            height: Number.parseFloat(feature.$.height || "0"),
          })
          break

        default:
          features.push(baseFeature)
      }
    }

    console.log(`Распарсено ${features.length} элементов из XML файла`)
  } catch (error) {
    console.error("Ошибка при парсинге XML файла features:", error)
  }

  return features
}

/**
 * Парсит определения символов из текстового файла
 * @param content Содержимое файла
 * @returns Объект с определениями символов
 */
function parseSymbolDefinitions(content: string): Record<string, SymbolDefinition> {
  console.log("Парсинг определений символов...")
  const symbols: Record<string, SymbolDefinition> = {}

  // Регулярное выражение для поиска определений символов
  const symbolRegex = /\$(\d+)\s+([a-z])(\d+\.?\d*)\s*=\s*(\d+\.?\d*)/i

  // Разбиваем содержимое на строки
  const lines = content.split(/\r?\n/)

  // Ищем определения символов
  for (const line of lines) {
    const trimmedLine = line.trim()

    // Пропускаем пустые строки и комментарии
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue
    }

    // Проверяем, является ли строка определением символа
    if (trimmedLine.startsWith("$")) {
      const match = trimmedLine.match(symbolRegex)
      if (match) {
        const id = match[1]
        const type = match[2].toLowerCase()
        const rawValue = match[3]
        const value = Number.parseFloat(match[4])

        console.log(`Symbol definition: $${id} ${type}${rawValue} = ${value}`)

        symbols[id] = {
          id,
          type,
          value,
        }

        // Для прямоугольных падов пытаемся найти ширину и высоту
        if (type === "s" || type === "o") {
          // Ищем дополнительные параметры
          const paramsMatch = trimmedLine.match(/x(\d+\.?\d*)/i)
          if (paramsMatch) {
            const height = Number.parseFloat(paramsMatch[1])
            symbols[id].width = value
            symbols[id].height = height
            console.log(`  Rectangular pad: width=${value}, height=${height}`)
          }
        }
      }
    }
  }

  console.log(`Найдено ${Object.keys(symbols).length} определений символов`)
  return symbols
}

/**
 * Парсит файл features в текстовом формате ODB++
 * @param filePath Путь к файлу features
 * @returns Массив элементов слоя
 */
function parseTextFeatures(filePath: string): LayerFeature[] {
  console.log(`Парсинг текстового файла features: ${filePath}`)
  const features: LayerFeature[] = []
  const padFeatures: LayerFeature[] = []
  const lineFeatures: LayerFeature[] = []
  const circleFeatures: LayerFeature[] = []
  const polygonFeatures: LayerFeature[] = []
  const textFeatures: LayerFeature[] = []

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8")

    // Парсим определения символов
    const symbols = parseSymbolDefinitions(fileContent)

    const lines = fileContent.split(/\r?\n/)

    let currentFeature: Partial<LayerFeature> | null = null
    let currentPolygon: { points: Point[] } | null = null

    // Первый проход - ищем линии, пады и другие элементы
    for (const line of lines) {
      const trimmedLine = line.trim()

      // Пропускаем пустые строки и комментарии
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue
      }

      // Обработка падов (P x y $symbol)
      if (trimmedLine.startsWith("P ")) {
        console.log(`Processing pad line: ${trimmedLine}`)

        // Формат: P x y $symbol [rotation]
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 4 && parts[3].startsWith("$")) {
          const x = Number.parseFloat(parts[1])
          const y = Number.parseFloat(parts[2])
          const symbolId = parts[3].substring(1) // Убираем $
          const rotation = parts.length >= 5 ? Number.parseFloat(parts[4]) : 0

          // Проверяем, есть ли такой символ
          if (symbols[symbolId]) {
            const symbol = symbols[symbolId]
            console.log(`  Found symbol $${symbolId}: type=${symbol.type}, value=${symbol.value}`)

            // Создаем пад в зависимости от типа символа
            if (symbol.type === "r") {
              // Круглый пад
              const pad: LayerFeature = {
                type: "pad",
                x,
                y,
                diameter: symbol.value * 2, // Диаметр = 2 * радиус
                radius: symbol.value,
                shape: "round",
                polarity: "positive",
                rotation: rotation,
              }
              padFeatures.push(pad)
              console.log(`  Added round pad at (${x}, ${y}) with diameter ${pad.diameter}`)
            } else if (symbol.type === "s") {
              // Квадратный/прямоугольный пад
              const width = symbol.width || symbol.value
              const height = symbol.height || symbol.value

              const pad: LayerFeature = {
                type: "pad",
                x,
                y,
                width,
                height,
                shape: "rectangular",
                polarity: "positive",
                rotation: rotation,
              }
              padFeatures.push(pad)
              console.log(`  Added rectangular pad at (${x}, ${y}) with width=${width}, height=${height}`)
            } else if (symbol.type === "o") {
              // Овальный пад
              const width = symbol.width || symbol.value * 2
              const height = symbol.height || symbol.value

              const pad: LayerFeature = {
                type: "pad",
                x,
                y,
                width,
                height,
                shape: "oval",
                polarity: "positive",
                rotation: rotation,
              }
              padFeatures.push(pad)
              console.log(`  Added oval pad at (${x}, ${y}) with width=${width}, height=${height}`)
            }
          } else {
            console.log(`  Symbol $${symbolId} not found in definitions`)
          }
        }
        continue
      }

      // Обработка линий (L x1 y1 x2 y2 width)
      if (trimmedLine.startsWith("L ")) {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 6) {
          const startX = Number.parseFloat(parts[1])
          const startY = Number.parseFloat(parts[2])
          const endX = Number.parseFloat(parts[3])
          const endY = Number.parseFloat(parts[4])
          const width = Number.parseFloat(parts[5])

          const line: LayerFeature = {
            type: "line",
            x: startX,
            y: startY,
            startX,
            startY,
            endX,
            endY,
            width,
            thickness: width,
            polarity: "positive",
          }
          lineFeatures.push(line)
          console.log(`Line ${lineFeatures.length}: (${startX},${startY}) to (${endX},${endY}) width=${width}`)
        }
        continue
      }

      // Обработка окружностей (C x y radius)
      if (trimmedLine.startsWith("C ")) {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 4) {
          const centerX = Number.parseFloat(parts[1])
          const centerY = Number.parseFloat(parts[2])
          const radius = Number.parseFloat(parts[3])

          const circle: LayerFeature = {
            type: "arc",
            x: centerX,
            y: centerY,
            centerX,
            centerY,
            radius,
            polarity: "positive",
          }
          circleFeatures.push(circle)
          console.log(`Circle ${circleFeatures.length}: center=(${centerX},${centerY}) radius=${radius}`)
        }
        continue
      }

      // Начало нового элемента
      if (trimmedLine.startsWith("S")) {
        // Если был предыдущий элемент, добавляем его в массив
        if (currentFeature && currentFeature.type) {
          features.push(currentFeature as LayerFeature)
        }

        // Создаем новый элемент
        currentFeature = {
          type: "unknown",
          x: 0,
          y: 0,
          polarity: "positive",
        }

        // Определяем тип элемента
        if (trimmedLine.includes("P")) {
          currentFeature.type = "pad"
        } else if (trimmedLine.includes("L")) {
          currentFeature.type = "line"
        } else if (trimmedLine.includes("A")) {
          currentFeature.type = "arc"
        } else if (trimmedLine.includes("T")) {
          currentFeature.type = "text"
        } else if (trimmedLine.includes("S")) {
          currentFeature.type = "surface"
          // Начинаем новый полигон
          currentPolygon = { points: [] }
        }

        // Определяем полярность
        if (trimmedLine.includes("N")) {
          currentFeature.polarity = "negative"
        }
      }
      // Координаты
      else if (trimmedLine.startsWith("OB") && currentFeature) {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 3) {
          currentFeature.x = Number.parseFloat(parts[1])
          currentFeature.y = Number.parseFloat(parts[2])

          // Если это полигон, добавляем точку
          if (currentFeature.type === "surface" && currentPolygon) {
            currentPolygon.points.push({
              x: currentFeature.x,
              y: currentFeature.y,
            })
          }
        }
      }
      // Размеры для pad
      else if (trimmedLine.startsWith("OS") && currentFeature && currentFeature.type === "pad") {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 3) {
          currentFeature.width = Number.parseFloat(parts[1])
          currentFeature.height = Number.parseFloat(parts[2])
        }
      }
      // Диаметр для круглого pad
      else if (trimmedLine.startsWith("OC") && currentFeature && currentFeature.type === "pad") {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 2) {
          currentFeature.diameter = Number.parseFloat(parts[1])
          currentFeature.radius = currentFeature.diameter / 2
        }
      }
      // Толщина линии
      else if (
        trimmedLine.startsWith("OW") &&
        currentFeature &&
        (currentFeature.type === "line" || currentFeature.type === "arc")
      ) {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 2) {
          currentFeature.thickness = Number.parseFloat(parts[1])
          currentFeature.width = currentFeature.thickness
        }
      }
      // Конечные координаты для линии
      else if (trimmedLine.startsWith("OE") && currentFeature && currentFeature.type === "line") {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 3) {
          currentFeature.endX = Number.parseFloat(parts[1])
          currentFeature.endY = Number.parseFloat(parts[2])
        }
      }
      // Параметры дуги
      else if (trimmedLine.startsWith("OA") && currentFeature && currentFeature.type === "arc") {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 5) {
          currentFeature.centerX = Number.parseFloat(parts[1])
          currentFeature.centerY = Number.parseFloat(parts[2])
          currentFeature.startAngle = Number.parseFloat(parts[3])
          currentFeature.endAngle = Number.parseFloat(parts[4])
        }
      }
      // Текст
      else if (trimmedLine.startsWith("OT") && currentFeature && currentFeature.type === "text") {
        const textMatch = trimmedLine.match(/OT\s+(.+)/)
        if (textMatch && textMatch[1]) {
          currentFeature.text = textMatch[1]
        }
      }
      // Точки для поверхности
      else if (trimmedLine.startsWith("OV") && currentFeature && currentFeature.type === "surface") {
        const parts = trimmedLine.split(/\s+/)
        if (parts.length >= 3) {
          if (!currentFeature.points) {
            currentFeature.points = []
          }
          const x = Number.parseFloat(parts[1])
          const y = Number.parseFloat(parts[2])
          currentFeature.points.push({ x, y })

          // Если это полигон, добавляем точку
          if (currentPolygon) {
            currentPolygon.points.push({ x, y })
          }
        }
      }
      // Конец полигона
      else if (trimmedLine === "SE" && currentFeature && currentFeature.type === "surface" && currentPolygon) {
        // Замыкаем полигон, если он не замкнут
        const points = currentPolygon.points
        if (points.length >= 3) {
          const firstPoint = points[0]
          const lastPoint = points[points.length - 1]

          if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
            points.push({ ...firstPoint })
          }

          const polygon: LayerFeature = {
            type: "surface",
            x: points[0].x,
            y: points[0].y,
            points,
            polarity: currentFeature.polarity,
          }

          polygonFeatures.push(polygon)
          console.log(
            `Polygon ${polygonFeatures.length}: ${points.length} points, starting at (${points[0].x},${points[0].y})`,
          )
        }

        // Сбрасываем текущий полигон
        currentPolygon = null
      }
    }

    // Добавляем последний элемент
    if (currentFeature && currentFeature.type) {
      features.push(currentFeature as LayerFeature)
    }

    // Объединяем все найденные элементы
    features.push(...padFeatures, ...lineFeatures, ...circleFeatures, ...polygonFeatures, ...textFeatures)

    console.log(`Распарсено ${features.length} элементов из текстового файла:`)
    console.log(`- ${padFeatures.length} падов`)
    console.log(`- ${lineFeatures.length} линий`)
    console.log(`- ${circleFeatures.length} окружностей`)
    console.log(`- ${polygonFeatures.length} полигонов`)
    console.log(`- ${textFeatures.length} текстов`)
    console.log(`- ${Object.keys(symbols).length} определений символов`)
  } catch (error) {
    console.error("Ошибка при парсинге текстового файла features:", error)
  }

  return features
}

/**
 * Определяет формат файла features и вызывает соответствующий парсер
 * @param filePath Путь к файлу features
 * @returns Массив элементов слоя
 */
export async function parseFeatures(filePath: string): Promise<LayerFeature[]> {
  console.log(`Парсинг файла features: ${filePath}`)

  try {
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.error(`Файл не существует: ${filePath}`)
      return []
    }

    // Проверяем, является ли путь директорией
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      console.log(`${filePath} является директорией, ищем файл features внутри`)
      // Ищем файл features внутри директории
      const files = fs.readdirSync(filePath)
      console.log(`Найдены файлы в директории: ${files.join(", ")}`)

      // Проверяем наличие файла features
      if (files.includes("features")) {
        const featuresFilePath = path.join(filePath, "features")
        console.log(`Найден файл features: ${featuresFilePath}`)
        return parseFeatures(featuresFilePath)
      }

      // Если файл features не найден, ищем XML файлы
      const xmlFiles = files.filter((file) => file.endsWith(".xml"))
      if (xmlFiles.length > 0) {
        console.log(`Найдены XML файлы: ${xmlFiles.join(", ")}`)
        const xmlFilePath = path.join(filePath, xmlFiles[0])
        return parseXmlFeatures(xmlFilePath)
      }

      console.error(`Файл features не найден в директории: ${filePath}`)
      return []
    }

    // Читаем начало файла для определения формата
    const buffer = Buffer.alloc(100)
    const fd = fs.openSync(filePath, "r")
    fs.readSync(fd, buffer, 0, 100, 0)
    fs.closeSync(fd)

    const fileStart = buffer.toString("utf-8", 0, 100)

    // Определяем формат файла
    if (fileStart.includes("<?xml") || fileStart.includes("<features>")) {
      return await parseXmlFeatures(filePath)
    } else {
      return parseTextFeatures(filePath)
    }
  } catch (error) {
    console.error("Ошибка при определении формата файла features:", error)
    return []
  }
}

/**
 * Парсит данные features из файла
 */
export function parseFeaturesContent(content: string, layerName: string, layerType: string): LayerFeatures {
  console.log(`Парсинг features для слоя ${layerName} (тип: ${layerType})`)

  const features: Feature[] = []

  // Здесь будет логика парсинга features
  // Пока возвращаем пустой массив

  return {
    layerName,
    layerType,
    features,
  }
}

/**
 * Парсит все файлы features в структуре ODB++
 * @param odbPath Путь к распакованному архиву ODB++
 * @returns Массив слоев с элементами
 */
export async function parseAllFeatures(odbPath: string): Promise<LayerFeatures[]> {
  console.log(`Парсинг всех файлов features в ${odbPath}`)
  const allLayerFeatures: LayerFeatures[] = []

  try {
    const featuresFiles = await findFeaturesFiles(odbPath)
    console.log(`Найдено ${featuresFiles.length} файлов features`)

    for (const { layerName, layerType, filePath } of featuresFiles) {
      console.log(`Парсинг файла features для слоя ${layerName} (тип: ${layerType}): ${filePath}`)
      const features = await parseFeatures(filePath)

      allLayerFeatures.push({
        layerName,
        layerType,
        features,
      })

      console.log(`Распарсен слой ${layerName} (тип: ${layerType}), найдено ${features.length} элементов`)
    }
  } catch (error) {
    console.error("Ошибка при парсинге всех файлов features:", error)
  }

  return allLayerFeatures
}

// Создадим новый файл для преобразования данных из парсера в формат для визуализации

import type { BoardLayer } from "./types"

/**
 * Преобразует данные из парсера в формат для визуализации
 * @param layerName Имя слоя
 * @param layerType Тип слоя
 * @param layerSide Сторона слоя
 * @param features Элементы слоя
 * @returns Слой в формате для визуализации
 */
export interface LayerFeatures {
  layerName: string
  layerType: string
  features: any[]
}

/**
 * Преобразует данные из парсера в формат для визуализации
 * @param parsedLayer Слой из парсера
 * @returns Слой в формате для визуализации
 */
export function convertParsedLayerToBoardLayer(parsedLayer: BoardLayer): BoardLayer {
  console.log(`Converting parsed layer ${parsedLayer.name} to board layer`)

  // Создаем копию слоя
  const boardLayer: BoardLayer = {
    name: parsedLayer.name,
    type: parsedLayer.type,
    side: parsedLayer.side,
    lines: [],
    circles: [],
    polygons: [],
    texts: [],
    color: parsedLayer.color,
    visible: parsedLayer.visible,
  }

  // Копируем линии
  if (parsedLayer.lines && parsedLayer.lines.length > 0) {
    console.log(`Copying ${parsedLayer.lines.length} lines`)
    boardLayer.lines = [...parsedLayer.lines]
  }

  // Копируем окружности
  if (parsedLayer.circles && parsedLayer.circles.length > 0) {
    console.log(`Copying ${parsedLayer.circles.length} circles`)
    boardLayer.circles = [...parsedLayer.circles]
  }

  // Копируем полигоны
  if (parsedLayer.polygons && parsedLayer.polygons.length > 0) {
    console.log(`Copying ${parsedLayer.polygons.length} polygons`)
    boardLayer.polygons = [...parsedLayer.polygons]
  }

  // Копируем тексты
  if (parsedLayer.texts && parsedLayer.texts.length > 0) {
    console.log(`Copying ${parsedLayer.texts.length} texts`)
    boardLayer.texts = [...parsedLayer.texts]
  }

  return boardLayer
}

/**
 * Преобразует данные из парсера в формат для визуализации
 * @param parsedLayers Слои из парсера
 * @returns Слои в формате для визуализации
 */
export function convertParsedLayersToBoardLayers(parsedLayers: BoardLayer[]): BoardLayer[] {
  console.log(`Converting ${parsedLayers.length} parsed layers to board layers`)

  return parsedLayers.map(convertParsedLayerToBoardLayer)
}

/**
 * Преобразует LayerFeature в формат для визуализации
 * @param features Массив элементов слоя
 * @param layerName Имя слоя
 * @param layerType Тип слоя
 * @returns Слой в формате для визуализации
 */
export function convertFeaturesToBoardLayer(
  features: LayerFeature[],
  layerName: string,
  layerType: string,
  layerSide = "TOP",
): BoardLayer {
  console.log(`Converting ${features.length} features to board layer ${layerName}`)

  // Определяем цвет слоя на основе типа
  let color = "#c87137" // Медь по умолчанию
  if (layerType === "silkscreen") {
    color = "#ffffff"
  } else if (layerType === "soldermask") {
    color = layerSide === "TOP" ? "#006600" : "#660000"
  } else if (layerType === "solderpaste") {
    color = "#aaaaaa"
  } else if (layerType === "drill") {
    color = "#333333"
  }

  // Создаем слой
  const boardLayer: BoardLayer = {
    name: layerName,
    type: layerType,
    side: layerSide,
    lines: [],
    circles: [],
    polygons: [],
    texts: [],
    color,
    visible: true,
  }

  // Преобразуем элементы
  for (const feature of features) {
    switch (feature.type) {
      case "line":
        if (
          feature.startX !== undefined &&
          feature.startY !== undefined &&
          feature.endX !== undefined &&
          feature.endY !== undefined
        ) {
          boardLayer.lines.push({
            start: { x: feature.startX, y: feature.startY },
            end: { x: feature.endX, y: feature.endY },
            width: feature.width || feature.thickness || 0.1,
          })
        }
        break

      case "arc":
        if (feature.centerX !== undefined && feature.centerY !== undefined && feature.radius !== undefined) {
          boardLayer.circles.push({
            center: { x: feature.centerX, y: feature.centerY },
            radius: feature.radius,
          })
        } else if (feature.x !== undefined && feature.y !== undefined && feature.radius !== undefined) {
          boardLayer.circles.push({
            center: { x: feature.x, y: feature.y },
            radius: feature.radius,
          })
        }
        break

      case "pad":
        if (feature.x !== undefined && feature.y !== undefined) {
          if (feature.diameter || feature.radius) {
            // Круглый пад
            const radius = feature.radius || (feature.diameter ? feature.diameter / 2 : 0)
            boardLayer.circles.push({
              center: { x: feature.x, y: feature.y },
              radius,
            })
          } else if (feature.width && feature.height) {
            // Прямоугольный пад - представляем как полигон
            const width = feature.width / 2
            const height = feature.height / 2

            // Создаем точки прямоугольника
            const points = [
              { x: feature.x - width, y: feature.y - height },
              { x: feature.x + width, y: feature.y - height },
              { x: feature.x + width, y: feature.y + height },
              { x: feature.x - width, y: feature.y + height },
              { x: feature.x - width, y: feature.y - height }, // Замыкаем полигон
            ]

            boardLayer.polygons.push({ points })
          }
        }
        break

      case "surface":
        if (feature.points && feature.points.length >= 3) {
          // Копируем точки полигона
          const points = [...feature.points]

          // Замыкаем полигон, если он не замкнут
          const firstPoint = points[0]
          const lastPoint = points[points.length - 1]
          if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
            points.push({ ...firstPoint })
          }

          boardLayer.polygons.push({ points })
        }
        break

      case "text":
        if (feature.x !== undefined && feature.y !== undefined && feature.text) {
          boardLayer.texts.push({
            position: { x: feature.x, y: feature.y },
            content: feature.text,
            size: feature.height || 1,
          })
        }
        break
    }
  }

  console.log(
    `Converted to board layer: ${boardLayer.lines.length} lines, ${boardLayer.circles.length} circles, ${boardLayer.polygons.length} polygons, ${boardLayer.texts.length} texts`,
  )

  return boardLayer
}
