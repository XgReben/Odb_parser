"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Download, ZoomIn, ZoomOut, RotateCw, RotateCcw, Grid } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { BoardLayer } from "@/lib/types"

interface LayerVisualizationProps {
  layers: BoardLayer[]
}

export function LayerVisualization({ layers }: LayerVisualizationProps) {
  const [activeLayer, setActiveLayer] = useState<string | null>(layers.length > 0 ? layers[0].name : null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  // Сортируем слои по типу и стороне для более логичного отображения
  const sortedLayers = [...layers].sort((a, b) => {
    // Сначала сортируем по стороне (TOP, BOT)
    if (a.side !== b.side) {
      return a.side === "TOP" ? -1 : 1
    }
    // Затем по типу слоя
    const typeOrder = {
      copper: 1,
      solder_mask: 2,
      paste: 3,
      silkscreen: 4,
      drill: 5,
      outline: 6,
      other: 7,
    }
    const aType = a.type?.toLowerCase() || "other"
    const bType = b.type?.toLowerCase() || "other"
    return (typeOrder[aType as keyof typeof typeOrder] || 7) - (typeOrder[bType as keyof typeof typeOrder] || 7)
  })

  // Функция для генерации SVG на основе данных слоя
  const generateLayerSvg = (layer: BoardLayer) => {
    if (!layer) {
      return (
        <g>
          <text x="50%" y="50%" textAnchor="middle" fill="currentColor">
            Нет данных для отображения
          </text>
        </g>
      )
    }

    // Проверяем наличие элементов в слое
    const hasElements =
      (layer.lines && layer.lines.length > 0) ||
      (layer.circles && layer.circles.length > 0) ||
      (layer.polygons && layer.polygons.length > 0) ||
      (layer.texts && layer.texts.length > 0)

    if (!hasElements) {
      return (
        <g>
          <text x="50%" y="50%" textAnchor="middle" fill="currentColor">
            Слой не содержит элементов для отображения
          </text>
        </g>
      )
    }

    // Используем цвет слоя из данных или определяем по типу
    const color = layer.color || getLayerColor(layer.type, layer.side)

    // Добавляем отладочную информацию
    console.log(`Rendering layer ${layer.name} with:`)
    console.log(`- ${layer.lines?.length || 0} lines`)
    console.log(`- ${layer.circles?.length || 0} circles`)
    console.log(`- ${layer.polygons?.length || 0} polygons`)
    console.log(`- ${layer.texts?.length || 0} texts`)

    return (
      <g>
        {/* Отладочная информация */}
        <text x="10" y="20" fontSize="12" fill="#ff0000">
          Слой: {layer.name} (Линий: {layer.lines?.length || 0}, Окружностей: {layer.circles?.length || 0}, Полигонов:{" "}
          {layer.polygons?.length || 0}, Текстов: {layer.texts?.length || 0})
        </text>

        {/* Отрисовка линий */}
        {layer.lines &&
          layer.lines.map((line, index) => (
            <line
              key={`line-${index}`}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
              stroke={color}
              strokeWidth={line.width || 1}
            />
          ))}

        {/* Отрисовка окружностей */}
        {layer.circles &&
          layer.circles.map((circle, index) => (
            <circle
              key={`circle-${index}`}
              cx={circle.center.x}
              cy={circle.center.y}
              r={circle.radius}
              stroke={color}
              strokeWidth={1}
              fill={color}
              fillOpacity={0.5}
              data-type="circle"
              data-index={index}
            />
          ))}

        {/* Отрисовка полигонов */}
        {layer.polygons &&
          layer.polygons.map((polygon, index) => {
            if (!polygon.points || polygon.points.length < 3) {
              console.warn(`Skipping polygon with insufficient points: ${polygon.points?.length || 0}`)
              return null
            }

            const points = polygon.points.map((p) => `${p.x},${p.y}`).join(" ")
            console.log(`Rendering polygon ${index} with ${polygon.points.length} points`)
            return (
              <polygon
                key={`polygon-${index}`}
                points={points}
                stroke={color}
                strokeWidth={1}
                fill={color}
                fillOpacity={0.3}
                data-type="polygon"
                data-points={polygon.points.length}
              />
            )
          })}

        {/* Отрисовка текстов */}
        {layer.texts &&
          layer.texts.map((text, index) => (
            <text
              key={`text-${index}`}
              x={text.position.x}
              y={text.position.y}
              fontSize={text.size || 10}
              fill={color}
              textAnchor="middle"
            >
              {text.content}
            </text>
          ))}
      </g>
    )
  }

  // Функция для определения цвета слоя
  const getLayerColor = (layerType: string, layerSide: string): string => {
    const type = layerType?.toLowerCase() || ""
    const side = layerSide?.toUpperCase() || ""

    if (type.includes("copper")) {
      return side === "TOP" ? "#C87533" : "#A35A2A"
    }
    if (type.includes("solder_mask")) {
      return side === "TOP" ? "#1A5D1A" : "#0F3D0F"
    }
    if (type.includes("paste")) {
      return side === "TOP" ? "#C0C0C0" : "#A0A0A0"
    }
    if (type.includes("silkscreen")) {
      return side === "TOP" ? "#FFFFFF" : "#E0E0E0"
    }
    if (type.includes("drill")) {
      return "#FF0000"
    }
    if (type.includes("outline")) {
      return "#0000FF"
    }
    return "#AAAAAA" // серый по умолчанию
  }

  // Функция для скачивания SVG
  const downloadSvg = () => {
    if (!svgRef.current || !activeLayer) return

    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgData], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `layer-${activeLayer}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Находим активный слой
  const currentLayer = sortedLayers.find((layer) => layer.name === activeLayer) || null

  // Добавляем отладочную информацию о текущем слое
  useEffect(() => {
    if (currentLayer) {
      console.log(`Текущий слой: ${currentLayer.name}`)
      console.log(`- Линий: ${currentLayer.lines?.length || 0}`)
      console.log(`- Окружностей: ${currentLayer.circles?.length || 0}`)
      console.log(`- Полигонов: ${currentLayer.polygons?.length || 0}`)
      console.log(`- Текстов: ${currentLayer.texts?.length || 0}`)

      // Выводим первые 5 элементов каждого типа для отладки
      if (currentLayer.lines && currentLayer.lines.length > 0) {
        console.log("Примеры линий:")
        currentLayer.lines.slice(0, 5).forEach((line, i) => {
          console.log(
            `  Линия ${i}: (${line.start.x}, ${line.start.y}) -> (${line.end.x}, ${line.end.y}), ширина: ${line.width}`,
          )
        })
      }

      if (currentLayer.circles && currentLayer.circles.length > 0) {
        console.log("Примеры окружностей:")
        currentLayer.circles.slice(0, 5).forEach((circle, i) => {
          console.log(`  Окружность ${i}: центр (${circle.center.x}, ${circle.center.y}), радиус: ${circle.radius}`)
        })
      }

      if (currentLayer.polygons && currentLayer.polygons.length > 0) {
        console.log("Примеры полигонов:")
        currentLayer.polygons.slice(0, 5).forEach((polygon, i) => {
          console.log(`  Полигон ${i}: ${polygon.points.length} точек`)
          if (polygon.points.length >= 3) {
            console.log(
              `    Первые 3 точки: (${polygon.points[0].x}, ${polygon.points[0].y}), (${polygon.points[1].x}, ${polygon.points[1].y}), (${polygon.points[2].x}, ${polygon.points[2].y})`,
            )
          } else {
            console.warn(`    Полигон имеет недостаточно точек: ${polygon.points.length}`)
          }
        })
      }
    }
  }, [currentLayer])

  // Вычисляем размеры платы для отображения
  // Находим минимальные и максимальные координаты для всех элементов слоя
  let minX = 0,
    minY = 0,
    maxX = 100,
    maxY = 100

  if (currentLayer) {
    // Инициализируем с первыми значениями, если они есть
    if (currentLayer.lines && currentLayer.lines.length > 0) {
      minX = Math.min(currentLayer.lines[0].start.x, currentLayer.lines[0].end.x)
      minY = Math.min(currentLayer.lines[0].start.y, currentLayer.lines[0].end.y)
      maxX = Math.max(currentLayer.lines[0].start.x, currentLayer.lines[0].end.x)
      maxY = Math.max(currentLayer.lines[0].start.y, currentLayer.lines[0].end.y)
    } else if (currentLayer.circles && currentLayer.circles.length > 0) {
      minX = currentLayer.circles[0].center.x - currentLayer.circles[0].radius
      minY = currentLayer.circles[0].center.y - currentLayer.circles[0].radius
      maxX = currentLayer.circles[0].center.x + currentLayer.circles[0].radius
      maxY = currentLayer.circles[0].center.y + currentLayer.circles[0].radius
    }

    // Обрабатываем все линии
    if (currentLayer.lines) {
      currentLayer.lines.forEach((line) => {
        minX = Math.min(minX, line.start.x, line.end.x)
        minY = Math.min(minY, line.start.y, line.end.y)
        maxX = Math.max(maxX, line.start.x, line.end.x)
        maxY = Math.max(maxY, line.start.y, line.end.y)
      })
    }

    // Обрабатываем все окружности
    if (currentLayer.circles) {
      currentLayer.circles.forEach((circle) => {
        minX = Math.min(minX, circle.center.x - circle.radius)
        minY = Math.min(minY, circle.center.y - circle.radius)
        maxX = Math.max(maxX, circle.center.x + circle.radius)
        maxY = Math.max(maxY, circle.center.y + circle.radius)
      })
    }

    // Обрабатываем все полигоны
    if (currentLayer.polygons) {
      currentLayer.polygons.forEach((polygon) => {
        polygon.points.forEach((point) => {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        })
      })
    }

    // Обрабатываем все тексты
    if (currentLayer.texts) {
      currentLayer.texts.forEach((text) => {
        minX = Math.min(minX, text.position.x)
        minY = Math.min(minY, text.position.y)
        maxX = Math.max(maxX, text.position.x)
        maxY = Math.max(maxY, text.position.y)
      })
    }
  }

  // Добавляем отступы
  const padding = 10
  minX -= padding
  minY -= padding
  maxX += padding
  maxY += padding

  // Вычисляем размеры и viewBox
  const width = maxX - minX
  const height = maxY - minY
  const viewBox = `${minX} ${minY} ${width} ${height}`

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Визуализация слоев</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <Tabs value={activeLayer || ""} onValueChange={setActiveLayer}>
            <TabsList className="flex flex-wrap">
              {sortedLayers.map((layer) => (
                <TabsTrigger key={layer.name} value={layer.name} className="text-xs">
                  {layer.name} ({layer.side})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="icon" onClick={() => setScale((prev) => Math.max(0.1, prev - 0.1))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Slider
                  value={[scale]}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onValueChange={(value) => setScale(value[0])}
                  className="w-32"
                />
                <Button variant="outline" size="icon" onClick={() => setScale((prev) => Math.min(5, prev + 0.1))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" size="icon" onClick={() => setRotation((prev) => (prev - 90) % 360)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <span className="text-xs">{rotation}°</span>
                <Button variant="outline" size="icon" onClick={() => setRotation((prev) => (prev + 90) % 360)}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="grid-toggle" checked={showGrid} onCheckedChange={setShowGrid} />
                <Label htmlFor="grid-toggle" className="flex items-center space-x-1">
                  <Grid className="h-4 w-4" />
                  <span>Сетка</span>
                </Label>
              </div>

              <Button variant="outline" size="sm" onClick={downloadSvg}>
                <Download className="h-4 w-4 mr-2" />
                Скачать SVG
              </Button>
            </div>

            <div className="relative border rounded-md overflow-hidden bg-black/10 dark:bg-white/5 aspect-video">
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: "center",
                  transition: "transform 0.3s ease",
                }}
              >
                {/* Сетка */}
                {showGrid && (
                  <g>
                    {/* Горизонтальные линии */}
                    {Array.from({ length: 21 }).map((_, i) => (
                      <line
                        key={`h-${i}`}
                        x1={minX}
                        y1={minY + i * (height / 20)}
                        x2={maxX}
                        y2={minY + i * (height / 20)}
                        stroke="#444"
                        strokeWidth="0.1"
                        strokeDasharray={i % 2 === 0 ? "none" : "0.5,0.5"}
                      />
                    ))}
                    {/* Вертикальные линии */}
                    {Array.from({ length: 21 }).map((_, i) => (
                      <line
                        key={`v-${i}`}
                        x1={minX + i * (width / 20)}
                        y1={minY}
                        x2={minX + i * (width / 20)}
                        y2={maxY}
                        stroke="#444"
                        strokeWidth="0.1"
                        strokeDasharray={i % 2 === 0 ? "none" : "0.5,0.5"}
                      />
                    ))}
                  </g>
                )}

                {/* Отрисовка слоя */}
                {currentLayer && generateLayerSvg(currentLayer)}
              </svg>
            </div>

            {currentLayer && (
              <div className="text-sm">
                <p>
                  <strong>Слой:</strong> {currentLayer.name}
                </p>
                <p>
                  <strong>Тип:</strong> {currentLayer.type || "Не указан"}
                </p>
                <p>
                  <strong>Сторона:</strong> {currentLayer.side || "Не указана"}
                </p>
                <p>
                  <strong>Элементов:</strong>{" "}
                  {(currentLayer.lines?.length || 0) +
                    (currentLayer.circles?.length || 0) +
                    (currentLayer.polygons?.length || 0) +
                    (currentLayer.texts?.length || 0)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
