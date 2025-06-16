import { type NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { parseODBFile } from "@/lib/odb-parser"
import { parseLayersFromODB } from "@/lib/layer-parser"
import JSZip from "jszip"
import fs from "fs"
import os from "os"
// Добавим импорт нового генератора SVG
import { generateAllLayersSvg } from "@/lib/svg-generator"

// Директория для хранения распакованных ODB++ файлов
const EXTRACT_DIR = path.join(os.tmpdir(), "pcb-assembly-app", "uploads", "extracted")

export async function POST(request: NextRequest) {
  try {
    console.log("Начало обработки запроса на загрузку ODB++ файла")

    // Получаем файл из запроса
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.error("Файл не найден в запросе")
      return NextResponse.json({ error: "Файл не найден" }, { status: 400 })
    }

    console.log(`Получен файл: ${file.name}, размер: ${file.size} байт, тип: ${file.type}`)

    // Проверяем тип файла
    if (
      !file.name.endsWith(".zip") &&
      !file.name.endsWith(".tgz") &&
      !file.name.endsWith(".tar.gz") &&
      !file.name.endsWith(".odb")
    ) {
      console.error(`Неподдерживаемый тип файла: ${file.type}`)
      return NextResponse.json({ error: "Поддерживаются только ZIP, TGZ и ODB файлы" }, { status: 400 })
    }

    // Генерируем уникальный ID для платы
    const boardId = uuidv4()
    console.log(`Сгенерирован ID платы: ${boardId}`)

    // Создаем директорию для распаковки, если она не существует
    const extractPath = path.join(EXTRACT_DIR, boardId)
    try {
      await mkdir(extractPath, { recursive: true })
      console.log(`Создана директория для распаковки: ${extractPath}`)
    } catch (error) {
      console.error(`Ошибка при создании директории ${extractPath}:`, error)
      // Пробуем использовать другую директорию
      const extractPathAlt = path.join(os.tmpdir(), boardId)
      await mkdir(extractPathAlt, { recursive: true })
      console.log(`Создана альтернативная директория для распаковки: ${extractPathAlt}`)
    }

    // Сохраняем оригинальный файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const originalFilePath = path.join(extractPath, file.name)
    await writeFile(originalFilePath, buffer)
    console.log(`Оригинальный файл сохранен: ${originalFilePath}`)

    // Распаковываем архив
    const zip = new JSZip()
    const zipContents = await zip.loadAsync(buffer)

    // Распаковываем все файлы
    const extractPromises = []
    for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async("nodebuffer")
        const filePath = path.join(extractPath, filename)

        // Создаем директории, если они не существуют
        const dirname = path.dirname(filePath)
        try {
          await mkdir(dirname, { recursive: true })
        } catch (error) {
          console.warn(`Не удалось создать директорию ${dirname}:`, error)
          // Пропускаем этот файл
          continue
        }

        // Сохраняем файл
        extractPromises.push(writeFile(filePath, content))
      }
    }

    await Promise.all(extractPromises)
    console.log("Архив успешно распакован")

    // Парсим ODB++ файл
    console.log("Начинаем парсинг ODB++ файла...")
    const boardData = await parseODBFile(file)
    console.log(`Парсинг завершен, найдено компонентов: ${boardData.components.length}`)

    // Добавляем информацию о пути к распакованному архиву
    boardData.extractPath = extractPath
    boardData.originalFilePath = originalFilePath
    boardData.id = boardId

    // Парсим слои из ODB++ файла
    console.log("Парсим слои из ODB++ файла...")

    // Создаем объект JSZip для имитации работы с архивом из файловой системы
    const layersZip = new JSZip()

    // Рекурсивно добавляем файлы из директории в zip
    const addFilesToZip = (dirPath: string, zipFolder: JSZip) => {
      const files = fs.readdirSync(dirPath)

      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const stats = fs.statSync(filePath)

        if (stats.isDirectory()) {
          const newFolder = zipFolder.folder(file)
          if (newFolder) {
            addFilesToZip(filePath, newFolder)
          }
        } else {
          try {
            const fileData = fs.readFileSync(filePath)
            zipFolder.file(file, fileData)
          } catch (error) {
            console.warn(`Не удалось прочитать файл ${filePath}:`, error)
          }
        }
      }
    }

    // Добавляем файлы из директории в zip
    try {
      addFilesToZip(extractPath, layersZip)
      console.log(`Файлы из директории ${extractPath} добавлены в zip для парсинга слоев`)
    } catch (error) {
      console.error(`Ошибка при добавлении файлов в zip для парсинга слоев:`, error)
    }

    // Парсим слои
    const layers = await parseLayersFromODB(layersZip)
    console.log(`Найдено ${layers.length} слоев`)

    // Добавляем слои в данные платы
    boardData.layers = layers.map((layer) => ({
      name: layer.name,
      type: layer.type,
      side: layer.side,
      color: layer.color,
      visible: layer.visible,
      linesCount: layer.lines.length,
      circlesCount: layer.circles.length,
      polygonsCount: layer.polygons.length,
      textsCount: layer.texts.length,
      lines: layer.lines,
      circles: layer.circles,
      polygons: layer.polygons,
      texts: layer.texts,
    }))

    // Преобразуем слои в формат, подходящий для нового генератора SVG
    const layersFeatures = layers.map((layer) => ({
      layerName: layer.name,
      layerType: layer.type,
      features: [
        // Преобразуем линии
        ...layer.lines.map((line) => ({
          type: "line",
          x: line.start.x,
          y: line.start.y,
          endX: line.end.x,
          endY: line.end.y,
          thickness: line.width,
        })),
        // Преобразуем окружности
        ...layer.circles.map((circle) => ({
          type: "pad",
          x: circle.center.x,
          y: circle.center.y,
          diameter: circle.radius * 2,
          shape: "round",
        })),
        // Преобразуем полигоны
        ...layer.polygons.map((polygon) => ({
          type: "surface",
          x: polygon.points[0]?.x || 0,
          y: polygon.points[0]?.y || 0,
          points: polygon.points,
        })),
        // Преобразуем тексты
        ...layer.texts.map((text) => ({
          type: "text",
          x: text.position.x,
          y: text.position.y,
          text: text.content,
          height: text.size,
        })),
      ],
    }))

    // Генерируем SVG для всех слоев
    let layersSvgResult: Record<string, string> = {}
    try {
      layersSvgResult = generateAllLayersSvg(layersFeatures, 800, 600, 1)

      // Добавляем комбинированный SVG
      try {
        // Создаем комбинированный слой
        const combinedFeatures = {
          layerName: "all",
          layerType: "combined",
          features: layersFeatures.flatMap((layer) =>
            layer.features.map((feature) => ({
              ...feature,
              layerName: layer.layerName,
            })),
          ),
        }

        layersSvgResult["all"] = generateLayerSvg(combinedFeatures, 800, 600, 1)
      } catch (error) {
        console.error("Ошибка при генерации комбинированного SVG:", error)
      }
    } catch (error) {
      console.error("Ошибка при генерации SVG для слоев:", error)

      // Если новый генератор не сработал, используем старый
      layersSvgResult = {}
      layers.forEach((layer) => {
        try {
          const svg = generateLayerSvg(layer)
          layersSvgResult[layer.name] = svg
        } catch (error) {
          console.error(`Ошибка при генерации SVG для слоя ${layer.name}:`, error)
        }
      })

      try {
        layersSvgResult["all"] = generateCombinedLayersSvg(layers)
      } catch (error) {
        console.error("Ошибка при генерации комбинированного SVG:", error)
      }
    }

    // Добавляем отладочную информацию
    boardData.debug = {
      ...boardData.debug,
      layersInfo: layers.map((layer) => ({
        name: layer.name,
        type: layer.type,
        side: layer.side,
        elementsCount: layer.lines.length + layer.circles.length + layer.polygons.length + layer.texts.length,
      })),
    }

    // Возвращаем данные клиенту
    return NextResponse.json({
      success: true,
      boardId,
      boardData,
      layersSvg: layersSvgResult,
      componentsCount: boardData.components.length,
      layersCount: layers.length,
      extractPath,
      originalFilePath,
    })
  } catch (error) {
    console.error("Ошибка при загрузке ODB++ файла:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// Функция для генерации SVG для слоя
function generateLayerSvg(layer: any, width = 800, height = 600, padding = 20): string {
  // Определяем размеры SVG
  // const width = 800;
  // const height = 600;
  // const padding = 20;

  // Находим минимальные и максимальные координаты для масштабирования
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  // Проверяем линии
  if (layer.lines && layer.lines.length > 0) {
    for (const line of layer.lines) {
      minX = Math.min(minX, line.start.x, line.end.x)
      minY = Math.min(minY, line.start.y, line.end.y)
      maxX = Math.max(maxX, line.start.x, line.end.x)
      maxY = Math.max(maxY, line.start.y, line.end.y)
    }
  }

  // Проверяем окружности
  if (layer.circles && layer.circles.length > 0) {
    for (const circle of layer.circles) {
      minX = Math.min(minX, circle.center.x - circle.radius)
      minY = Math.min(minY, circle.center.y - circle.radius)
      maxX = Math.max(maxX, circle.center.x + circle.radius)
      maxY = Math.max(maxY, circle.center.y + circle.radius)
    }
  }

  // Проверяем полигоны
  if (layer.polygons && layer.polygons.length > 0) {
    for (const polygon of layer.polygons) {
      for (const point of polygon.points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
    }
  }

  // Проверяем тексты
  if (layer.texts && layer.texts.length > 0) {
    for (const text of layer.texts) {
      minX = Math.min(minX, text.position.x)
      minY = Math.min(minY, text.position.y)
      maxX = Math.max(maxX, text.position.x + text.content.length * text.size * 0.6)
      maxY = Math.max(maxY, text.position.y + text.size)
    }
  }

  // Если нет элементов, используем значения по умолчанию
  if (minX === Number.POSITIVE_INFINITY) {
    minX = 0
    minY = 0
    maxX = 100
    maxY = 100
  }

  // Вычисляем масштаб
  const scaleX = (width - padding * 2) / (maxX - minX)
  const scaleY = (height - padding * 2) / (maxY - minY)
  const scale = Math.min(scaleX, scaleY)

  // Функция для преобразования координат
  const transformX = (x: number) => padding + (x - minX) * scale
  const transformY = (y: number) => padding + (y - minY) * scale

  // Создаем SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg">\n`

  // Добавляем линии
  if (layer.lines && layer.lines.length > 0) {
    for (const line of layer.lines) {
      const x1 = transformX(line.start.x)
      const y1 = transformY(line.start.y)
      const x2 = transformX(line.end.x)
      const y2 = transformY(line.end.y)
      const strokeWidth = Math.max(1, line.width * scale)

      svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${layer.color}" stroke-width="${strokeWidth}" />\n`
    }
  }

  // Добавляем окружности
  if (layer.circles && layer.circles.length > 0) {
    for (const circle of layer.circles) {
      const cx = transformX(circle.center.x)
      const cy = transformY(circle.center.y)
      const r = circle.radius * scale

      svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${layer.color}" stroke-width="1" />\n`
    }
  }

  // Добавляем полигоны
  if (layer.polygons && layer.polygons.length > 0) {
    for (const polygon of layer.polygons) {
      const points = polygon.points.map((point: any) => `${transformX(point.x)},${transformY(point.y)}`).join(" ")

      svg += `  <polygon points="${points}" fill="none" stroke="${layer.color}" stroke-width="1" />\n`
    }
  }

  // Добавляем тексты
  if (layer.texts && layer.texts.length > 0) {
    for (const text of layer.texts) {
      const x = transformX(text.position.x)
      const y = transformY(text.position.y)
      const fontSize = text.size * scale

      svg += `  <text x="${x}" y="${y}" font-size="${fontSize}" fill="${layer.color}">${text.content}</text>\n`
    }
  }

  svg += "</svg>"

  return svg
}

/**
 * Генерирует комбинированный SVG для всех слоев
 */
function generateCombinedLayersSvg(layers: any[]): string {
  // Определяем размеры SVG
  const width = 800
  const height = 600
  const padding = 20

  // Находим минимальные и максимальные координаты для масштабирования
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  // Проходим по всем слоям и находим общие границы
  for (const layer of layers) {
    // Проверяем линии
    if (layer.lines && layer.lines.length > 0) {
      for (const line of layer.lines) {
        minX = Math.min(minX, line.start.x, line.end.x)
        minY = Math.min(minY, line.start.y, line.end.y)
        maxX = Math.max(maxX, line.start.x, line.end.x)
        maxY = Math.max(maxY, line.start.y, line.end.y)
      }
    }

    // Проверяем окружности
    if (layer.circles && layer.circles.length > 0) {
      for (const circle of layer.circles) {
        minX = Math.min(minX, circle.center.x - circle.radius)
        minY = Math.min(minY, circle.center.y - circle.radius)
        maxX = Math.max(maxX, circle.center.x + circle.radius)
        maxY = Math.max(maxY, circle.center.y + circle.radius)
      }
    }

    // Проверяем полигоны
    if (layer.polygons && layer.polygons.length > 0) {
      for (const polygon of layer.polygons) {
        for (const point of polygon.points) {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        }
      }
    }

    // Проверяем тексты
    if (layer.texts && layer.texts.length > 0) {
      for (const text of layer.texts) {
        minX = Math.min(minX, text.position.x)
        minY = Math.min(minY, text.position.y)
        maxX = Math.max(maxX, text.position.x + text.content.length * text.size * 0.6)
        maxY = Math.max(maxY, text.position.y + text.size)
      }
    }
  }

  // Если нет элементов, используем значения по умолчанию
  if (minX === Number.POSITIVE_INFINITY) {
    minX = 0
    minY = 0
    maxX = 100
    maxY = 100
  }

  // Вычисляем масштаб
  const scaleX = (width - padding * 2) / (maxX - minX)
  const scaleY = (height - padding * 2) / (maxY - minY)
  const scale = Math.min(scaleX, scaleY)

  // Функция для преобразования координат
  const transformX = (x: number) => padding + (x - minX) * scale
  const transformY = (y: number) => padding + (y - minY) * scale

  // Создаем SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}">\n`

  // Добавляем группы для каждого слоя
  for (const layer of layers) {
    svg += `  <g data-layer="${layer.name}" data-type="${layer.type}" data-side="${layer.side || "BOTH"}">\n`

    // Добавляем линии
    if (layer.lines && layer.lines.length > 0) {
      for (const line of layer.lines) {
        const x1 = transformX(line.start.x)
        const y1 = transformY(line.start.y)
        const x2 = transformX(line.end.x)
        const y2 = transformY(line.end.y)
        const strokeWidth = Math.max(1, line.width * scale)

        svg += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${layer.color}" stroke-width="${strokeWidth}" />\n`
      }
    }

    // Добавляем окружности
    if (layer.circles && layer.circles.length > 0) {
      for (const circle of layer.circles) {
        const cx = transformX(circle.center.x)
        const cy = transformY(circle.center.y)
        const r = circle.radius * scale

        svg += `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${layer.color}" stroke-width="1" />\n`
      }
    }

    // Добавляем полигоны
    if (layer.polygons && layer.polygons.length > 0) {
      for (const polygon of layer.polygons) {
        const points = polygon.points.map((point: any) => `${transformX(point.x)},${transformY(point.y)}`).join(" ")

        svg += `    <polygon points="${points}" fill="none" stroke="${layer.color}" stroke-width="1" />\n`
      }
    }

    // Добавляем тексты
    if (layer.texts && layer.texts.length > 0) {
      for (const text of layer.texts) {
        const x = transformX(text.position.x)
        const y = transformY(text.position.y)
        const fontSize = text.size * scale

        svg += `    <text x="${x}" y="${y}" font-size="${fontSize}" fill="${layer.color}">${text.content}</text>\n`
      }
    }

    svg += `  </g>\n`
  }

  svg += "</svg>"

  return svg
}
