import { type NextRequest, NextResponse } from "next/server"
import { getBoardData } from "@/lib/board-storage"
import { parseLayersFromODB } from "@/lib/layer-parser"
import { convertParsedLayersToBoardLayers } from "@/lib/features-parser"
import * as fs from "fs"
import * as path from "path"
import JSZip from "jszip"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    console.log(`API: Получение слоев для платы с ID ${id}`)

    // Получаем данные платы
    const boardData = await getBoardData(id)

    if (!boardData) {
      console.error(`API: Плата с ID ${id} не найдена`)
      return NextResponse.json(
        {
          success: false,
          error: `Board with ID ${id} not found`,
          message: `Плата с ID ${id} не найдена`,
        },
        { status: 404 },
      )
    }

    console.log(`API: Получены данные платы: ${boardData.name}, extractPath: ${boardData.extractPath || "не указан"}`)

    // Проверяем наличие пути к распакованному архиву
    if (!boardData.extractPath) {
      console.error(`API: Путь к распакованному архиву ODB++ не найден для платы с ID ${id}`)
      return NextResponse.json(
        {
          success: false,
          error: "Extract path not found",
          message: "Путь к распакованному архиву ODB++ не найден",
          boardId: id,
          boardName: boardData.name,
        },
        { status: 400 },
      )
    }

    try {
      // Проверяем существование директории
      if (!fs.existsSync(boardData.extractPath)) {
        console.error(`API: Директория ${boardData.extractPath} не существует`)
        return NextResponse.json(
          {
            success: false,
            error: "Directory not found",
            message: `Директория ${boardData.extractPath} не существует`,
            boardId: id,
            boardName: boardData.name,
          },
          { status: 400 },
        )
      }

      console.log(`API: Директория ${boardData.extractPath} существует, начинаем парсинг слоев`)

      // Создаем объект JSZip для имитации работы с архивом
      const zip = new JSZip()

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
        addFilesToZip(boardData.extractPath, zip)
        console.log(`API: Файлы из директории ${boardData.extractPath} добавлены в zip`)
      } catch (error) {
        console.error(`API: Ошибка при добавлении файлов в zip:`, error)
        // Продолжаем выполнение, так как некоторые файлы могли быть добавлены
      }

      // Парсим слои из ODB++ файла
      console.log(`API: Парсим слои из ODB++ файла`)
      const layers = await parseLayersFromODB(zip)
      console.log(`API: Получено ${layers.length} слоев`)

      // Преобразуем слои в формат для визуализации
      const boardLayers = convertParsedLayersToBoardLayers(layers)
      console.log(`API: Преобразовано ${boardLayers.length} слоев для визуализации`)

      if (boardLayers.length === 0) {
        console.warn(`API: Не найдено ни одного слоя в ODB++ файле`)
        // Создаем демо-слои, если не найдено ни одного слоя
        // Это уже реализовано в parseLayersFromODB
      }

      // Генерируем SVG для каждого слоя
      const layersWithSvg = boardLayers.map((layer) => {
        try {
          // Генерируем SVG для слоя
          const svg = generateLayerSvg(layer)

          return {
            name: layer.name,
            type: layer.type,
            side: layer.side,
            featuresCount:
              (layer.lines?.length || 0) +
              (layer.circles?.length || 0) +
              (layer.polygons?.length || 0) +
              (layer.texts?.length || 0),
            svg,
          }
        } catch (error) {
          console.error(`API: Ошибка при генерации SVG для слоя ${layer.name}:`, error)
          return {
            name: layer.name,
            type: layer.type,
            side: layer.side,
            featuresCount: 0,
            svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100">
              <text x="10" y="50" fill="red">Ошибка при генерации SVG</text>
            </svg>`,
          }
        }
      })

      // Добавляем отладочную информацию о слоях перед возвратом
      console.log(`API: Подготовка ответа с ${boardLayers.length} слоями`)
      for (const layer of boardLayers) {
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
      }

      // Возвращаем данные слоев
      return NextResponse.json({
        success: true,
        boardId: id,
        boardName: boardData.name,
        layersCount: layersWithSvg.length,
        layers: layersWithSvg,
        isDemoData: boardLayers.some((layer) => layer.name.includes("demo")),
      })
    } catch (error) {
      console.error("API: Ошибка при парсинге слоев или генерации SVG:", error)

      // Создаем демо-слои в случае ошибки
      const demoLayers = createDemoLayers()
      const layersWithSvg = demoLayers.map((layer) => {
        try {
          // Генерируем SVG для слоя
          const svg = generateLayerSvg(layer)

          return {
            name: layer.name,
            type: layer.type,
            side: layer.side,
            featuresCount:
              (layer.lines?.length || 0) +
              (layer.circles?.length || 0) +
              (layer.polygons?.length || 0) +
              (layer.texts?.length || 0),
            svg,
          }
        } catch (svgError) {
          console.error(`API: Ошибка при генерации SVG для демо-слоя ${layer.name}:`, svgError)
          return {
            name: layer.name,
            type: layer.type,
            side: layer.side,
            featuresCount: 0,
            svg: `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100">
              <text x="10" y="50" fill="red">Ошибка при генерации SVG</text>
            </svg>`,
          }
        }
      })

      return NextResponse.json({
        success: true,
        boardId: id,
        boardName: boardData.name,
        layersCount: layersWithSvg.length,
        layers: layersWithSvg,
        isDemoData: true,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  } catch (error) {
    console.error("API: Ошибка при получении слоев платы:", error)

    // Если произошла ошибка, возвращаем сообщение об ошибке
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Ошибка при получении слоев платы",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

/**
 * Генерирует SVG для слоя
 */
function generateLayerSvg(layer: any): string {
  // Определяем размеры SVG
  const width = 800
  const height = 600
  const padding = 20

  console.log(`Generating SVG for layer: ${layer.name}`)
  console.log(
    `Layer contains: ${layer.lines?.length || 0} lines, ${layer.circles?.length || 0} circles, ${layer.polygons?.length || 0} polygons, ${layer.texts?.length || 0} texts`,
  )

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
      maxX = Math.max(maxX, text.position.x + (text.content?.length || 0) * (text.size || 10) * 0.6)
      maxY = Math.max(maxY, text.position.y + (text.size || 10))
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

  // Добавляем метаданные
  svg += `  <metadata>
    <layer-info name="${layer.name}" type="${layer.type}" side="${layer.side}" 
      lines="${layer.lines?.length || 0}" 
      circles="${layer.circles?.length || 0}" 
      polygons="${layer.polygons?.length || 0}" 
      texts="${layer.texts?.length || 0}"/>
  </metadata>\n`

  // Добавляем линии
  if (layer.lines && layer.lines.length > 0) {
    svg += `  <!-- Lines: ${layer.lines.length} -->\n`
    for (const line of layer.lines) {
      const x1 = transformX(line.start.x)
      const y1 = transformY(line.start.y)
      const x2 = transformX(line.end.x)
      const y2 = transformY(line.end.y)
      const strokeWidth = Math.max(1, (line.width || 1) * scale)

      svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${layer.color || "#888"}" stroke-width="${strokeWidth}" />\n`
    }
  }

  // Добавляем окружности
  if (layer.circles && layer.circles.length > 0) {
    svg += `  <!-- Circles: ${layer.circles.length} -->\n`
    for (const circle of layer.circles) {
      const cx = transformX(circle.center.x)
      const cy = transformY(circle.center.y)
      const r = circle.radius * scale

      svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${layer.color || "#888"}" fill-opacity="0.5" stroke="${layer.color || "#888"}" stroke-width="1" />\n`
    }
  }

  // Добавляем полигоны
  if (layer.polygons && layer.polygons.length > 0) {
    svg += `  <!-- Polygons: ${layer.polygons.length} -->\n`
    for (const polygon of layer.polygons) {
      if (!polygon.points || polygon.points.length < 3) {
        console.warn(`Skipping polygon with insufficient points: ${polygon.points?.length || 0}`)
        continue
      }

      const points = polygon.points.map((point: any) => `${transformX(point.x)},${transformY(point.y)}`).join(" ")

      svg += `  <polygon points="${points}" fill="${layer.color || "#888"}" fill-opacity="0.3" stroke="${layer.color || "#888"}" stroke-width="1" />\n`
    }
  }

  // Добавляем тексты
  if (layer.texts && layer.texts.length > 0) {
    svg += `  <!-- Texts: ${layer.texts.length} -->\n`
    for (const text of layer.texts) {
      const x = transformX(text.position.x)
      const y = transformY(text.position.y)
      const fontSize = (text.size || 10) * scale

      svg += `  <text x="${x}" y="${y}" font-size="${fontSize}" fill="${layer.color || "#888"}">${text.content || ""}</text>\n`
    }
  }

  svg += "</svg>"

  return svg
}

/**
 * Создает демо-слои для отображения
 */
function createDemoLayers(): any[] {
  console.log("API: Создаем демо-слои для отображения")

  const layers: any[] = []

  // Создаем слой контура платы
  const outlineLayer = {
    name: "demo_outline",
    type: "outline",
    side: "BOTH",
    lines: [],
    circles: [],
    polygons: [],
    texts: [],
    color: "#0c4a6e",
    visible: true,
  }

  // Добавляем прямоугольник контура платы
  outlineLayer.lines.push(
    { start: { x: 10, y: 10 }, end: { x: 290, y: 10 }, width: 2 },
    { start: { x: 290, y: 10 }, end: { x: 290, y: 190 }, width: 2 },
    { start: { x: 290, y: 190 }, end: { x: 10, y: 190 }, width: 2 },
    { start: { x: 10, y: 190 }, end: { x: 10, y: 10 }, width: 2 },
  )

  // Создаем слой верхней меди
  const topCopperLayer = {
    name: "demo_top_copper",
    type: "copper",
    side: "TOP",
    lines: [],
    circles: [],
    polygons: [],
    texts: [],
    color: "#c87137",
    visible: true,
  }

  // Добавляем несколько линий и окружностей для демонстрации
  for (let i = 0; i < 10; i++) {
    topCopperLayer.lines.push({
      start: { x: 50 + i * 20, y: 50 },
      end: { x: 50 + i * 20, y: 150 },
      width: 1,
    })
  }

  for (let i = 0; i < 5; i++) {
    topCopperLayer.circles.push({
      center: { x: 50 + i * 50, y: 100 },
      radius: 5,
    })
  }

  // Создаем слой нижней меди
  const bottomCopperLayer = {
    name: "demo_bottom_copper",
    type: "copper",
    side: "BOT",
    lines: [],
    circles: [],
    polygons: [],
    texts: [],
    color: "#b36530",
    visible: true,
  }

  // Добавляем несколько линий и окружностей для демонстрации
  for (let i = 0; i < 10; i++) {
    bottomCopperLayer.lines.push({
      start: { x: 50, y: 50 + i * 10 },
      end: { x: 250, y: 50 + i * 10 },
      width: 1,
    })
  }

  // Создаем слой верхней шелкографии
  const topSilkLayer = {
    name: "demo_top_silkscreen",
    type: "silkscreen",
    side: "TOP",
    lines: [],
    circles: [],
    polygons: [],
    texts: [],
    color: "#ffffff",
    visible: true,
  }

  // Добавляем текст
  topSilkLayer.texts.push({
    position: { x: 150, y: 30 },
    content: "DEMO PCB",
    size: 10,
  })

  // Добавляем слои в список
  layers.push(outlineLayer, topCopperLayer, bottomCopperLayer, topSilkLayer)

  return layers
}
