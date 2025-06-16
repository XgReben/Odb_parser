import type { LayerFeatures } from "./features-parser"
import type { BoardProfile } from "./board-profile-parser"

interface SvgOptions {
  width: number
  height: number
  padding: number
  scale: number
  layerColors: Record<string, string>
}

const DEFAULT_COLORS: Record<string, string> = {
  top: "#FF0000",
  bottom: "#0000FF",
  top_copper: "#C86464",
  bottom_copper: "#6464C8",
  top_paste: "#FFAAAA",
  bottom_paste: "#AAAAFF",
  top_mask: "#55FF55",
  bottom_mask: "#55FFFF",
  drill: "#000000",
  outline: "#000000",
  default: "#888888",
}

export function generateLayerSvg(
  layerFeatures: LayerFeatures,
  boardProfile: BoardProfile | null,
  options: Partial<SvgOptions> = {},
): string {
  console.log(`Generating SVG for layer: ${layerFeatures.layerName}`)

  // Set default options
  const fullOptions: SvgOptions = {
    width: 800,
    height: 600,
    padding: 20,
    scale: 1,
    layerColors: DEFAULT_COLORS,
    ...options,
  }

  // Calculate scaling and translation
  let scaleX = 1
  let scaleY = 1
  let translateX = 0
  let translateY = 0

  if (boardProfile) {
    const boardWidth = boardProfile.width
    const boardHeight = boardProfile.height

    // Calculate scale to fit the board in the SVG with padding
    const availableWidth = fullOptions.width - 2 * fullOptions.padding
    const availableHeight = fullOptions.height - 2 * fullOptions.padding

    scaleX = availableWidth / boardWidth
    scaleY = availableHeight / boardHeight

    // Use the smaller scale to maintain aspect ratio
    const scale = Math.min(scaleX, scaleY) * fullOptions.scale
    scaleX = scale
    scaleY = scale

    // Calculate translation to center the board
    translateX = fullOptions.padding - boardProfile.minX * scaleX + (availableWidth - boardWidth * scaleX) / 2
    translateY = fullOptions.padding - boardProfile.minY * scaleY + (availableHeight - boardHeight * scaleY) / 2
  }

  // Get layer color
  const layerColor = fullOptions.layerColors[layerFeatures.layerName] || fullOptions.layerColors.default

  // Start SVG
  let svg = `<svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="${fullOptions.width}" 
    height="${fullOptions.height}" 
    viewBox="0 0 ${fullOptions.width} ${fullOptions.height}"
    data-layer="${layerFeatures.layerName}"
  >`

  // Add metadata
  svg += `
    <metadata>
      <layer-info name="${layerFeatures.layerName}" feature-count="${layerFeatures.features.length}"/>
    </metadata>
  `

  // Add board outline if available
  if (boardProfile && boardProfile.outline.length > 0) {
    const points = boardProfile.outline
      .map((point) => `${translateX + point.x * scaleX},${translateY + point.y * scaleY}`)
      .join(" ")

    svg += `
      <polygon 
        points="${points}" 
        fill="none" 
        stroke="#000000" 
        stroke-width="1" 
        data-type="board-outline"
      />
    `
  }

  // Add layer group
  svg += `<g id="layer-${layerFeatures.layerName}" data-layer-name="${layerFeatures.layerName}">`

  // Обновим функцию generateLayerSvg для поддержки всех типов элементов

  // В начале функции generateLayerSvg, после объявления переменных, добавим логирование типов элементов
  console.log(`Generating SVG for layer ${layerFeatures.layerName} with ${layerFeatures.features.length} features`)
  const featureTypes = new Set(layerFeatures.features.map((f) => f.type))
  console.log(`Feature types in layer: ${Array.from(featureTypes).join(", ")}`)

  // Обновим обработку элементов в цикле для поддержки всех типов
  // Найдем блок "Add features" и заменим его на следующий код:
  // Добавляем элементы
  for (const feature of layerFeatures.features) {
    const x = translateX + feature.x * scaleX
    const y = translateY + feature.y * scaleY

    // Определяем цвет элемента (учитываем полярность)
    const featureColor = feature.polarity === "negative" ? "#000000" : layerColor

    switch (feature.type) {
      case "pad":
      case "via":
        if (feature.diameter) {
          const radius = (feature.diameter * scaleX) / 2
          svg += `
            <circle 
              cx="${x}" 
              cy="${y}" 
              r="${radius}" 
              fill="${featureColor}" 
              data-type="${feature.type}"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        } else if (feature.width && feature.height) {
          // Прямоугольный пад
          const halfWidth = (feature.width * scaleX) / 2
          const halfHeight = (feature.height * scaleY) / 2
          const rotation = feature.rotation || 0

          svg += `
            <rect 
              x="${x - halfWidth}" 
              y="${y - halfHeight}" 
              width="${feature.width * scaleX}" 
              height="${feature.height * scaleY}" 
              fill="${featureColor}" 
              ${rotation ? `transform="rotate(${rotation} ${x} ${y})"` : ""}
              data-type="${feature.type}"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        }
        break

      case "line":
        if (feature.points && feature.points.length >= 2 && feature.width) {
          const x1 = translateX + feature.points[0].x * scaleX
          const y1 = translateY + feature.points[0].y * scaleY
          const x2 = translateX + feature.points[1].x * scaleX
          const y2 = translateY + feature.points[1].y * scaleY
          const strokeWidth = feature.width * scaleX

          svg += `
            <line 
              x1="${x1}" 
              y1="${y1}" 
              x2="${x2}" 
              y2="${y2}" 
              stroke="${featureColor}" 
              stroke-width="${strokeWidth}" 
              stroke-linecap="round"
              data-type="line"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        } else if (feature.endX !== undefined && feature.endY !== undefined && feature.width) {
          // Альтернативный формат линии
          const x2 = translateX + feature.endX * scaleX
          const y2 = translateY + feature.endY * scaleY
          const strokeWidth = feature.width * scaleX

          svg += `
            <line 
              x1="${x}" 
              y1="${y}" 
              x2="${x2}" 
              y2="${y2}" 
              stroke="${featureColor}" 
              stroke-width="${strokeWidth}" 
              stroke-linecap="round"
              data-type="line"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        }
        break

      case "arc":
        if (feature.radius !== undefined && feature.startAngle !== undefined && feature.endAngle !== undefined) {
          // Дуга с заданными углами
          const centerX = feature.centerX !== undefined ? translateX + feature.centerX * scaleX : x
          const centerY = feature.centerY !== undefined ? translateY + feature.centerY * scaleY : y
          const radius = feature.radius * scaleX
          const startAngle = (feature.startAngle * Math.PI) / 180
          const endAngle = (feature.endAngle * Math.PI) / 180

          // Вычисляем точки начала и конца дуги
          const startX = centerX + radius * Math.cos(startAngle)
          const startY = centerY + radius * Math.sin(startAngle)
          const endX = centerX + radius * Math.cos(endAngle)
          const endY = centerY + radius * Math.sin(endAngle)

          // Определяем флаги для SVG path
          const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0
          const sweepFlag = endAngle > startAngle ? 1 : 0

          svg += `
            <path 
              d="M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}" 
              stroke="${featureColor}" 
              stroke-width="${feature.width ? feature.width * scaleX : 1}" 
              fill="none"
              data-type="arc"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        } else if (feature.points && feature.points.length >= 3) {
          // Аппроксимация дуги линиями
          for (let i = 0; i < feature.points.length - 1; i++) {
            const x1 = translateX + feature.points[i].x * scaleX
            const y1 = translateY + feature.points[i].y * scaleY
            const x2 = translateX + feature.points[i + 1].x * scaleX
            const y2 = translateY + feature.points[i + 1].y * scaleY

            svg += `
              <line 
                x1="${x1}" 
                y1="${y1}" 
                x2="${x2}" 
                y2="${y2}" 
                stroke="${featureColor}" 
                stroke-width="${feature.width ? feature.width * scaleX : 1}" 
                stroke-linecap="round"
                data-type="arc-segment"
                ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
              />
            `
          }
        }
        break

      case "surface":
      case "polygon":
        if (feature.points && feature.points.length > 2) {
          const points = feature.points
            .map((point) => `${translateX + point.x * scaleX},${translateY + point.y * scaleY}`)
            .join(" ")

          svg += `
            <polygon 
              points="${points}" 
              fill="${featureColor}" 
              stroke="${featureColor}"
              stroke-width="0.5"
              data-type="${feature.type}"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        }
        break

      case "text":
        if (feature.text) {
          const fontSize = feature.height ? feature.height * scaleY : 10
          svg += `
            <text 
              x="${x}" 
              y="${y}" 
              font-size="${fontSize}" 
              fill="${featureColor}" 
              text-anchor="middle" 
              dominant-baseline="middle"
              ${feature.rotation ? `transform="rotate(${feature.rotation} ${x} ${y})"` : ""}
              data-type="text"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
          >${feature.text}</text>
        `
        }
        break

      case "oval":
        if (feature.width && feature.height) {
          const rx = (feature.width * scaleX) / 2
          const ry = (feature.height * scaleY) / 2
          svg += `
            <ellipse 
              cx="${x}" 
              cy="${y}" 
              rx="${rx}" 
              ry="${ry}" 
              fill="${featureColor}" 
              ${feature.rotation ? `transform="rotate(${feature.rotation} ${x} ${y})"` : ""}
              data-type="oval"
              ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
            />
          `
        }
        break

      default:
        // Для неизвестных типов элементов отображаем маркер
        svg += `
          <circle 
            cx="${x}" 
            cy="${y}" 
            r="2" 
            fill="red" 
            data-type="unknown-${feature.type || "undefined"}"
            ${feature.attributes ? `data-attributes="${JSON.stringify(feature.attributes).replace(/"/g, "&quot;")}"` : ""}
          />
        `
        break
    }
  }

  // Close layer group and SVG
  svg += `</g></svg>`

  return svg
}

export function generateAllLayersSvg(
  layerFeaturesList: LayerFeatures[],
  boardProfile: BoardProfile | null,
  options: Partial<SvgOptions> = {},
): Record<string, string> {
  console.log(`Generating SVGs for ${layerFeaturesList.length} layers`)

  const result: Record<string, string> = {}

  for (const layerFeatures of layerFeaturesList) {
    result[layerFeatures.layerName] = generateLayerSvg(layerFeatures, boardProfile, options)
  }

  return result
}
