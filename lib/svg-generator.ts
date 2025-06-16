import type { LayerFeatures } from "./features-parser"

// Цвета для разных типов слоев
const layerColors = {
  top: "#FF8C00", // Оранжевый для верхнего слоя
  bottom: "#4169E1", // Синий для нижнего слоя
  drill: "#000000", // Черный для сверления
  silkscreen: "#FFFFFF", // Белый для шелкографии
  soldermask: "#006400", // Темно-зеленый для паяльной маски
  solderpaste: "#C0C0C0", // Серебряный для паяльной пасты
  copper: "#CD7F32", // Медный для медных слоев
  unknown: "#808080", // Серый для неизвестных слоев
}

// Функция для генерации SVG из данных features
export function generateLayerSvg(layerFeatures: LayerFeatures, width: number, height: number, scale = 1): string {
  console.log(`Генерация SVG для слоя ${layerFeatures.layerName} (тип: ${layerFeatures.layerType})`)

  // Определяем границы слоя
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const feature of layerFeatures.features) {
    // Обрабатываем основные координаты
    minX = Math.min(minX, feature.x)
    minY = Math.min(minY, feature.y)
    maxX = Math.max(maxX, feature.x)
    maxY = Math.max(maxY, feature.y)

    // Обрабатываем дополнительные координаты в зависимости от типа элемента
    switch (feature.type) {
      case "line":
        if (feature.endX !== undefined && feature.endY !== undefined) {
          minX = Math.min(minX, feature.endX)
          minY = Math.min(minY, feature.endY)
          maxX = Math.max(maxX, feature.endX)
          maxY = Math.max(maxY, feature.endY)
        }
        break

      case "pad":
        if (feature.width !== undefined && feature.height !== undefined) {
          const halfWidth = feature.width / 2
          const halfHeight = feature.height / 2
          minX = Math.min(minX, feature.x - halfWidth)
          minY = Math.min(minY, feature.y - halfHeight)
          maxX = Math.max(maxX, feature.x + halfWidth)
          maxY = Math.max(maxY, feature.y + halfHeight)
        } else if (feature.diameter !== undefined) {
          const radius = feature.diameter / 2
          minX = Math.min(minX, feature.x - radius)
          minY = Math.min(minY, feature.y - radius)
          maxX = Math.max(maxX, feature.x + radius)
          maxY = Math.max(maxY, feature.y + radius)
        }
        break

      case "arc":
        if (feature.radius !== undefined) {
          if (feature.centerX !== undefined && feature.centerY !== undefined) {
            minX = Math.min(minX, feature.centerX - feature.radius)
            minY = Math.min(minY, feature.centerY - feature.radius)
            maxX = Math.max(maxX, feature.centerX + feature.radius)
            maxY = Math.max(maxY, feature.centerY + feature.radius)
          } else {
            minX = Math.min(minX, feature.x - feature.radius)
            minY = Math.min(minY, feature.y - feature.radius)
            maxX = Math.max(maxX, feature.x + feature.radius)
            maxY = Math.max(maxY, feature.y + feature.radius)
          }
        }
        break

      case "surface":
        if (feature.points) {
          for (const point of feature.points) {
            minX = Math.min(minX, point.x)
            minY = Math.min(minY, point.y)
            maxX = Math.max(maxX, point.x)
            maxY = Math.max(maxY, point.y)
          }
        }
        break
    }
  }

  // Если не удалось определить границы, используем значения по умолчанию
  if (
    minX === Number.POSITIVE_INFINITY ||
    minY === Number.POSITIVE_INFINITY ||
    maxX === Number.NEGATIVE_INFINITY ||
    maxY === Number.NEGATIVE_INFINITY
  ) {
    minX = 0
    minY = 0
    maxX = width
    maxY = height
  }

  // Добавляем отступы
  const padding = 10
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  // Вычисляем размеры и масштаб
  const layerWidth = maxX - minX
  const layerHeight = maxY - minY

  // Вычисляем масштаб для вписывания в заданные размеры
  const scaleX = width / layerWidth
  const scaleY = height / layerHeight
  const autoScale = Math.min(scaleX, scaleY)

  // Используем заданный масштаб или автоматический, если заданный слишком большой
  const finalScale = scale > autoScale ? autoScale : scale

  // Вычисляем смещение для центрирования
  const offsetX = (width - layerWidth * finalScale) / 2 - minX * finalScale
  const offsetY = (height - layerHeight * finalScale) / 2 - minY * finalScale

  // Определяем цвет слоя
  const layerColor = layerColors[layerFeatures.layerType as keyof typeof layerColors] || layerColors.unknown

  // Начинаем генерацию SVG
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`

  // Добавляем метаданные
  svg += `
  <metadata>
    <layer-name>${layerFeatures.layerName}</layer-name>
    <layer-type>${layerFeatures.layerType}</layer-type>
    <feature-count>${layerFeatures.features.length}</feature-count>
    <min-x>${minX}</min-x>
    <min-y>${minY}</min-y>
    <max-x>${maxX}</max-x>
    <max-y>${maxY}</max-y>
    <scale>${finalScale}</scale>
  </metadata>`

  // Добавляем фон
  svg += `<rect width="${width}" height="${height}" fill="black" />`

  // Добавляем группу для элементов слоя с трансформацией
  svg += `<g transform="translate(${offsetX}, ${offsetY}) scale(${finalScale})">`

  // Генерируем SVG для каждого элемента
  for (const feature of layerFeatures.features) {
    const featureColor = feature.polarity === "negative" ? "black" : layerColor

    switch (feature.type) {
      case "line":
        if (feature.endX !== undefined && feature.endY !== undefined && feature.thickness !== undefined) {
          svg += `<line x1="${feature.x}" y1="${feature.y}" x2="${feature.endX}" y2="${feature.endY}" stroke="${featureColor}" stroke-width="${feature.thickness}" />`
        }
        break

      case "pad":
        if (feature.shape === "round" || feature.diameter !== undefined) {
          const diameter = feature.diameter || Math.max(feature.width || 0, feature.height || 0)
          svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${diameter / 2}" fill="${featureColor}" />`
        } else if (feature.shape === "rectangle" || (feature.width !== undefined && feature.height !== undefined)) {
          const width = feature.width || 0
          const height = feature.height || 0
          const rotation = feature.rotation || 0

          if (rotation === 0) {
            svg += `<rect x="${feature.x - width / 2}" y="${feature.y - height / 2}" width="${width}" height="${height}" fill="${featureColor}" />`
          } else {
            svg += `<rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="${featureColor}" transform="translate(${feature.x}, ${feature.y}) rotate(${rotation})" />`
          }
        }
        break

      case "arc":
        if (feature.radius !== undefined && feature.startAngle !== undefined && feature.endAngle !== undefined) {
          const centerX = feature.centerX !== undefined ? feature.centerX : feature.x
          const centerY = feature.centerY !== undefined ? feature.centerY : feature.y

          // Преобразуем углы в радианы
          const startAngle = (feature.startAngle * Math.PI) / 180
          const endAngle = (feature.endAngle * Math.PI) / 180

          // Вычисляем точки начала и конца дуги
          const startX = centerX + feature.radius * Math.cos(startAngle)
          const startY = centerY + feature.radius * Math.sin(startAngle)
          const endX = centerX + feature.radius * Math.cos(endAngle)
          const endY = centerY + feature.radius * Math.sin(endAngle)

          // Определяем флаг большой дуги
          const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0

          // Определяем флаг направления
          const sweepFlag = endAngle > startAngle ? 1 : 0

          svg += `<path d="M ${startX} ${startY} A ${feature.radius} ${feature.radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}" stroke="${featureColor}" stroke-width="${feature.thickness || 0.5}" fill="none" />`
        }
        break

      case "surface":
        if (feature.points && feature.points.length > 0) {
          let pathData = `M ${feature.points[0].x} ${feature.points[0].y}`

          for (let i = 1; i < feature.points.length; i++) {
            pathData += ` L ${feature.points[i].x} ${feature.points[i].y}`
          }

          // Замыкаем контур
          pathData += " Z"

          svg += `<path d="${pathData}" fill="${featureColor}" />`
        }
        break

      case "text":
        if (feature.text) {
          const fontSize = feature.height || 2
          const rotation = feature.rotation || 0

          if (rotation === 0) {
            svg += `<text x="${feature.x}" y="${feature.y}" font-size="${fontSize}" fill="${featureColor}" text-anchor="middle" dominant-baseline="middle">${feature.text}</text>`
          } else {
            svg += `<text x="0" y="0" font-size="${fontSize}" fill="${featureColor}" text-anchor="middle" dominant-baseline="middle" transform="translate(${feature.x}, ${feature.y}) rotate(${rotation})">${feature.text}</text>`
          }
        }
        break

      case "hole":
        if (feature.diameter !== undefined) {
          svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${feature.diameter / 2}" fill="black" stroke="${featureColor}" stroke-width="0.2" />`
        }
        break
    }
  }

  // Закрываем группу и SVG
  svg += "</g></svg>"

  return svg
}

// Функция для генерации SVG для всех слоев
export function generateAllLayersSvg(
  layersFeatures: LayerFeatures[],
  width: number,
  height: number,
  scale = 1,
): { [key: string]: string } {
  console.log(`Генерация SVG для ${layersFeatures.length} слоев`)
  const result: { [key: string]: string } = {}

  for (const layerFeatures of layersFeatures) {
    result[layerFeatures.layerName] = generateLayerSvg(layerFeatures, width, height, scale)
  }

  return result
}

// Добавляем экспорт функции generateLayersSvg для совместимости
export function generateLayersSvg(
  layersFeatures: LayerFeatures[],
  width: number,
  height: number,
  scale = 1,
): { [key: string]: string } {
  console.log("Вызов функции generateLayersSvg (алиас для generateAllLayersSvg)")
  return generateAllLayersSvg(layersFeatures, width, height, scale)
}

// Добавляем экспорт для generateLayersSvg как алиас для generateAllLayersSvg
// export const generateLayersSvg = generateAllLayersSvg;
