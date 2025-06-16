import type { BoardLayer } from "./types"

// Интерфейс для определения символа
interface SymbolDefinition {
  id: string
  type: "r" | "s" | "o" | string // r - круглый, s - квадратный, o - овальный
  value: number
  width?: number
  height?: number
}

/**
 * Парсит определения символов из текстового содержимого
 * @param content Содержимое файла
 * @returns Объект с определениями символов
 */
function parseSymbolDefinitions(content: string): Record<string, SymbolDefinition> {
  console.log("Парсинг определений символов...")
  const symbols: Record<string, SymbolDefinition> = {}

  // Регулярное выражение для поиска определений символов
  const symbolRegex = /\$(\d+)\s+([a-z])(\d+\.?\d*)\s*=?\s*(\d+\.?\d*)?/i

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
        const value = Number.parseFloat(match[4] || match[3])

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
 * Улучшенный парсер Gerber/ODB++ файлов
 * @param content Содержимое файла
 * @param layer Слой для заполнения
 * @param scaleFactor Масштабный коэффициент
 */
export function parseEnhancedGerber(content: string, layer: BoardLayer, scaleFactor = 0.001) {
  console.log(`Starting enhanced parsing for layer ${layer.name}`)

  // Парсим определения символов
  const symbols = parseSymbolDefinitions(content)

  const lines = content.split(/\r?\n/)

  let padCount = 0
  let lineCount = 0
  let circleCount = 0
  let polygonCount = 0
  let textCount = 0

  let currentPolygon: { x: number; y: number }[] = []
  let inPolygon = false

  // Обрабатываем каждую строку
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Пропускаем пустые строки и комментарии
    if (!line || line.startsWith("#")) {
      continue
    }

    // Обработка падов (P x y $symbol)
    if (line.startsWith("P ")) {
      console.log(`Processing pad line: ${line}`)

      // Формат: P x y $symbol [rotation]
      const parts = line.split(/\s+/)
      if (parts.length >= 4 && parts[3].startsWith("$")) {
        const x = Number.parseFloat(parts[1]) * scaleFactor
        const y = Number.parseFloat(parts[2]) * scaleFactor
        const symbolId = parts[3].substring(1) // Убираем $
        const rotation = parts.length >= 5 ? Number.parseFloat(parts[4]) : 0

        // Проверяем, есть ли такой символ
        if (symbols[symbolId]) {
          const symbol = symbols[symbolId]
          console.log(`  Found symbol $${symbolId}: type=${symbol.type}, value=${symbol.value}`)

          // Создаем пад в зависимости от типа символа
          if (symbol.type === "r") {
            // Круглый пад
            const radius = symbol.value * scaleFactor
            layer.circles.push({
              center: { x, y },
              radius,
            })
            padCount++
            console.log(`  Added round pad at (${x}, ${y}) with radius ${radius}`)
          } else if (symbol.type === "s") {
            // Квадратный/прямоугольный пад
            const width = (symbol.width || symbol.value) * scaleFactor
            const height = (symbol.height || symbol.value) * scaleFactor

            // Создаем прямоугольный пад как полигон
            const halfWidth = width / 2
            const halfHeight = height / 2

            const points = [
              { x: x - halfWidth, y: y - halfHeight },
              { x: x + halfWidth, y: y - halfHeight },
              { x: x + halfWidth, y: y + halfHeight },
              { x: x - halfWidth, y: y + halfHeight },
              { x: x - halfWidth, y: y - halfHeight }, // Замыкаем полигон
            ]

            layer.polygons.push({ points })
            padCount++
            console.log(`  Added rectangular pad at (${x}, ${y}) with width=${width}, height=${height}`)
          } else if (symbol.type === "o") {
            // Овальный пад - представляем как окружность
            const radius = symbol.value * scaleFactor
            layer.circles.push({
              center: { x, y },
              radius,
            })
            padCount++
            console.log(`  Added oval pad at (${x}, ${y}) with radius ${radius}`)
          }
        } else {
          console.log(`  Symbol $${symbolId} not found in definitions`)
        }
      }
      continue
    }

    // Обработка линий (L x1 y1 x2 y2 width)
    if (line.startsWith("L ")) {
      const parts = line.split(/\s+/)
      if (parts.length >= 6) {
        const startX = Number.parseFloat(parts[1]) * scaleFactor
        const startY = Number.parseFloat(parts[2]) * scaleFactor
        const endX = Number.parseFloat(parts[3]) * scaleFactor
        const endY = Number.parseFloat(parts[4]) * scaleFactor
        const width = Number.parseFloat(parts[5]) * scaleFactor

        layer.lines.push({
          start: { x: startX, y: startY },
          end: { x: endX, y: endY },
          width,
        })
        lineCount++

        if (lineCount <= 5) {
          console.log(`Line ${lineCount}: (${startX},${startY}) to (${endX},${endY}) width=${width}`)
        }
      }
      continue
    }

    // Обработка окружностей (C x y radius)
    if (line.startsWith("C ")) {
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const centerX = Number.parseFloat(parts[1]) * scaleFactor
        const centerY = Number.parseFloat(parts[2]) * scaleFactor
        const radius = Number.parseFloat(parts[3]) * scaleFactor

        layer.circles.push({
          center: { x: centerX, y: centerY },
          radius,
        })
        circleCount++
        console.log(`Circle ${circleCount}: center=(${centerX},${centerY}) radius=${radius}`)
      }
      continue
    }

    // Начало полигона
    if (line.startsWith("S ") || line.includes("POLYGON") || line.includes("SURFACE")) {
      console.log(`Found polygon start: ${line}`)
      inPolygon = true
      currentPolygon = []
      continue
    }

    // Конец полигона
    if ((line === "SE" || line === "OE" || line.includes("END")) && inPolygon) {
      console.log(`Found polygon end: ${line}`)
      if (currentPolygon.length >= 3) {
        // Замыкаем полигон, если он не замкнут
        const firstPoint = currentPolygon[0]
        const lastPoint = currentPolygon[currentPolygon.length - 1]

        if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
          currentPolygon.push({ ...firstPoint })
        }

        layer.polygons.push({ points: currentPolygon })
        polygonCount++
        console.log(`Added polygon with ${currentPolygon.length} points`)
      }
      inPolygon = false
      currentPolygon = []
      continue
    }

    // Точки полигона
    if (inPolygon && (line.startsWith("OB ") || line.startsWith("OS ") || line.startsWith("OV "))) {
      const parts = line.split(/\s+/)
      if (parts.length >= 3) {
        const x = Number.parseFloat(parts[1]) * scaleFactor
        const y = Number.parseFloat(parts[2]) * scaleFactor
        currentPolygon.push({ x, y })
        console.log(`  Added polygon point: (${x}, ${y})`)
      }
      continue
    }

    // Простые координаты для полигона (x y)
    if (inPolygon && line.match(/^\s*-?\d+\.?\d*\s+-?\d+\.?\d*\s*$/)) {
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        const x = Number.parseFloat(parts[0]) * scaleFactor
        const y = Number.parseFloat(parts[1]) * scaleFactor
        currentPolygon.push({ x, y })
        console.log(`  Added polygon point from coordinates: (${x}, ${y})`)
      }
      continue
    }

    // Обработка текста
    if (line.startsWith("T ") || line.includes("TEXT")) {
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const x = Number.parseFloat(parts[1]) * scaleFactor
        const y = Number.parseFloat(parts[2]) * scaleFactor
        const size = parts.length >= 4 ? Number.parseFloat(parts[3]) * scaleFactor : 1
        const text = parts.slice(4).join(" ") || "TEXT"

        layer.texts.push({
          position: { x, y },
          content: text,
          size,
        })
        textCount++
        console.log(`Text ${textCount}: "${text}" at (${x}, ${y}) size=${size}`)
      }
      continue
    }

    // Дополнительный поиск падов по ключевым словам
    if (line.toLowerCase().includes("pad") || line.toLowerCase().includes("via")) {
      console.log(`Found potential pad/via: ${line}`)

      // Пытаемся извлечь координаты и размер
      const coordMatch = line.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g)
      if (coordMatch && coordMatch.length >= 1) {
        const coords = coordMatch[0].split(/\s+/)
        if (coords.length >= 2) {
          const x = Number.parseFloat(coords[0]) * scaleFactor
          const y = Number.parseFloat(coords[1]) * scaleFactor

          // Ищем размер
          const sizeMatch = line.match(/r(\d+\.?\d*)/i) || line.match(/(\d+\.?\d*)\s*mm/i)
          const radius = sizeMatch ? Number.parseFloat(sizeMatch[1]) * scaleFactor : 0.5 * scaleFactor

          layer.circles.push({
            center: { x, y },
            radius,
          })
          padCount++
          console.log(`  Added pad/via at (${x}, ${y}) with radius ${radius}`)
        }
      }
    }
  }

  // Если остался незавершенный полигон, добавляем его
  if (inPolygon && currentPolygon.length >= 3) {
    const firstPoint = currentPolygon[0]
    const lastPoint = currentPolygon[currentPolygon.length - 1]

    if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
      currentPolygon.push({ ...firstPoint })
    }

    layer.polygons.push({ points: currentPolygon })
    polygonCount++
    console.log(`Added final polygon with ${currentPolygon.length} points`)
  }

  console.log(
    `Parsed layer data: ${lineCount} lines, ${circleCount} circles, ${padCount} pads, ${polygonCount} polygons, ${textCount} texts, ${Object.keys(symbols).length} symbol definitions`,
  )

  // Примеры линий для отладки
  if (layer.lines.length > 0) {
    console.log("Примеры линий:")
    for (let i = 0; i < Math.min(5, layer.lines.length); i++) {
      const line = layer.lines[i]
      console.log(
        `  Линия ${i}: (${line.start.x}, ${line.start.y}) -> (${line.end.x}, ${line.end.y}), ширина: ${line.width}`,
      )
    }
  }

  console.log(`Слой ${layer.name} успешно добавлен в список`)
}
