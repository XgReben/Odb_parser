"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { InfoIcon, ZoomInIcon, ZoomOutIcon, RotateCcwIcon, AlertTriangleIcon, Download } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getClientBoardData, getClientBoardLayersSvg } from "@/lib/client-storage"

interface Layer {
  name: string
  type: string
  side?: string
  featuresCount: number
  svg: string
  color: string
}

interface EnhancedBoardVisualizationProps {
  boardId: string
}

export default function EnhancedBoardVisualization({ boardId }: EnhancedBoardVisualizationProps) {
  const [layers, setLayers] = useState<Layer[]>([])
  const [visibleLayers, setVisibleLayers] = useState<{ [key: string]: boolean }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [isDemoData, setIsDemoData] = useState(false)
  const [boardName, setBoardName] = useState<string>("")
  const svgContainerRef = useRef<HTMLDivElement>(null)

  // Загрузка слоев платы из клиентского хранилища
  useEffect(() => {
    const fetchLayers = async () => {
      try {
        setLoading(true)
        setError(null)
        setDebugInfo(`Загрузка слоев платы с ID: ${boardId}...`)

        // Получаем данные платы из localStorage
        const boardData = getClientBoardData(boardId)
        if (!boardData) {
          throw new Error("Board data not found in client storage")
        }

        setBoardName(boardData.name || "Unnamed Board")
        setDebugInfo((prev) => `${prev}\nПолучены данные платы: ${boardData.name}`)

        // Добавляем отладочную информацию о слоях
        if (boardData.debug?.layersInfo) {
          setDebugInfo((prev) => `${prev}\nОтладочная информация о слоях:`)
          boardData.debug.layersInfo.forEach((layerInfo: any) => {
            setDebugInfo(
              (prev) =>
                `${prev}\n- ${layerInfo.name}: тип=${layerInfo.type}, сторона=${layerInfo.side}, элементов=${layerInfo.elementsCount}`,
            )
          })
        }

        // Получаем SVG-представления слоев из localStorage
        const layersSvgData = getClientBoardLayersSvg(boardId)

        if (!layersSvgData || Object.keys(layersSvgData).length === 0) {
          setDebugInfo((prev) => `${prev}\nSVG для слоев не найдены в localStorage`)
          throw new Error("Layer SVG data not found in client storage")
        }

        setDebugInfo((prev) => `${prev}\nНайдено ${Object.keys(layersSvgData).length} SVG для слоев`)

        // Создаем слои на основе SVG
        const layersData: Layer[] = []

        // Получаем метаданные о слоях из boardData
        if (boardData.layers && boardData.layers.length > 0) {
          setDebugInfo((prev) => `${prev}\nНайдено ${boardData.layers.length} слоев в данных платы`)

          for (const layerMeta of boardData.layers) {
            if (layerMeta.name && layersSvgData[layerMeta.name]) {
              // Выводим информацию о каждом слое для отладки
              setDebugInfo(
                (prev) => `${prev}\nСлой ${layerMeta.name}: тип=${layerMeta.type}, сторона=${layerMeta.side}`,
              )

              layersData.push({
                name: layerMeta.name,
                type: layerMeta.type || "unknown",
                side: layerMeta.side,
                featuresCount:
                  (layerMeta.linesCount || 0) +
                  (layerMeta.circlesCount || 0) +
                  (layerMeta.polygonsCount || 0) +
                  (layerMeta.textsCount || 0),
                svg: layersSvgData[layerMeta.name],
                color: layerMeta.color || getLayerColor(layerMeta.type || "unknown", layerMeta.side || "BOTH"),
              })
            }
          }
        } else {
          setDebugInfo((prev) => `${prev}\nСлои не найдены в данных платы`)
        }

        // Если нет слоев, но есть комбинированный SVG, создаем один слой
        if (layersData.length === 0 && layersSvgData["all"]) {
          setDebugInfo((prev) => `${prev}\nСоздаем комбинированный слой`)
          layersData.push({
            name: "combined",
            type: "combined",
            side: "BOTH",
            featuresCount: 0,
            svg: layersSvgData["all"],
            color: "#00ff00",
          })
        }

        setLayers(layersData)
        setDebugInfo((prev) => `${prev}\nСоздано ${layersData.length} слоев`)

        // Инициализируем видимость слоев
        const initialVisibility: { [key: string]: boolean } = {}
        layersData.forEach((layer) => {
          initialVisibility[layer.name] = true
        })
        setVisibleLayers(initialVisibility)

        // Проверяем, являются ли данные демо-данными
        setIsDemoData(boardData.debug?.parsingMethod === "demo" || false)
      } catch (err) {
        console.error("Ошибка при загрузке слоев платы:", err)
        setError(err instanceof Error ? err.message : "Неизвестная ошибка при загрузке слоев")
        setDebugInfo((prev) => `${prev}\nОшибка: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`)
      } finally {
        setLoading(false)
      }
    }

    fetchLayers()
  }, [boardId])

  // Функция для получения цвета слоя по его типу и стороне
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

  // Обновление SVG при изменении слоев или масштаба
  useEffect(() => {
    if (svgContainerRef.current && layers.length > 0) {
      updateSvgContent()
    }
  }, [layers, visibleLayers, scale])

  // Функция для переключения видимости слоя
  const toggleLayerVisibility = (layerName: string) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName],
    }))
    setDebugInfo((prev) => `${prev}\nПереключена видимость слоя ${layerName}: ${!visibleLayers[layerName]}`)
  }

  // Функция для обновления содержимого SVG
  const updateSvgContent = () => {
    if (!svgContainerRef.current) return

    // Очищаем контейнер
    svgContainerRef.current.innerHTML = ""

    // Создаем основной SVG-элемент
    const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svgElement.setAttribute("width", "100%")
    svgElement.setAttribute("height", "100%")
    svgElement.setAttribute("viewBox", "0 0 800 600")
    svgElement.style.backgroundColor = "#1a1a1a"

    // Создаем группу для масштабирования
    const scaleGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
    scaleGroup.setAttribute("transform", `scale(${scale})`)
    svgElement.appendChild(scaleGroup)

    // Добавляем видимые слои
    const visibleLayersList = layers.filter((layer) => visibleLayers[layer.name])

    // Сортируем слои по типу для правильного наложения
    const layerOrder: Record<string, number> = {
      outline: 1,
      copper: 2,
      solder_mask: 3,
      silkscreen: 4,
      paste: 5,
      drill: 6,
      component: 7,
      combined: 8,
    }

    visibleLayersList.sort((a, b) => {
      const orderA = layerOrder[a.type.toLowerCase()] || 99
      const orderB = layerOrder[b.type.toLowerCase()] || 99
      return orderA - orderB
    })

    // Добавляем слои в обратном порядке (чтобы первые в списке были сверху)
    for (const layer of visibleLayersList) {
      // Создаем группу для слоя
      const layerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
      layerGroup.setAttribute("data-layer-name", layer.name)
      layerGroup.setAttribute("data-layer-type", layer.type)

      // Парсим SVG-строку слоя
      const parser = new DOMParser()
      const layerDoc = parser.parseFromString(layer.svg, "image/svg+xml")

      // Извлекаем элементы из SVG слоя
      const layerSvg = layerDoc.documentElement

      // Копируем все дочерние элементы из SVG слоя в группу
      Array.from(layerSvg.children).forEach((child) => {
        layerGroup.appendChild(document.importNode(child, true))
      })

      // Добавляем группу слоя в группу масштабирования
      scaleGroup.appendChild(layerGroup)
    }

    // Если это демо-данные, добавляем уведомление
    if (isDemoData) {
      const demoNotice = document.createElementNS("http://www.w3.org/2000/svg", "text")
      demoNotice.setAttribute("x", "10")
      demoNotice.setAttribute("y", "20")
      demoNotice.setAttribute("fill", "orange")
      demoNotice.setAttribute("font-size", "12")
      demoNotice.textContent = "Демо-данные"
      svgElement.appendChild(demoNotice)
    }

    // Добавляем SVG в контейнер
    svgContainerRef.current.appendChild(svgElement)

    setDebugInfo((prev) => `${prev}\nОбновлено содержимое SVG с ${visibleLayersList.length} видимыми слоями`)
  }

  // Функция для увеличения масштаба
  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 3))
    setDebugInfo((prev) => `${prev}\nМасштаб увеличен до ${(Math.min(scale + 0.1, 3)).toFixed(1)}`)
  }

  // Функция для уменьшения масштаба
  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.1))
    setDebugInfo((prev) => `${prev}\nМасштаб уменьшен до ${(Math.max(scale - 0.1, 0.1)).toFixed(1)}`)
  }

  // Функция для сброса масштаба
  const resetZoom = () => {
    setScale(1)
    setDebugInfo((prev) => `${prev}\nМасштаб сброшен до 1.0`)
  }

  // Функция для экспорта SVG
  const exportSvg = () => {
    if (!svgContainerRef.current) return

    const svgElement = svgContainerRef.current.querySelector("svg")
    if (!svgElement) return

    // Создаем копию SVG для экспорта
    const svgClone = svgElement.cloneNode(true) as SVGElement

    // Устанавливаем атрибуты для корректного отображения
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    svgClone.setAttribute("width", "800")
    svgClone.setAttribute("height", "600")

    // Преобразуем SVG в строку
    const svgData = new XMLSerializer().serializeToString(svgClone)

    // Создаем Blob и URL для скачивания
    const blob = new Blob([svgData], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)

    // Создаем ссылку для скачивания
    const link = document.createElement("a")
    link.href = url
    link.download = `pcb-layers-${boardId}.svg`
    document.body.appendChild(link)
    link.click()

    // Очищаем ресурсы
    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 100)
  }

  // Если данные загружаются, показываем индикатор загрузки
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-3">Загрузка слоев платы...</span>
      </div>
    )
  }

  // Если произошла ошибка, показываем сообщение об ошибке
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangleIcon className="h-4 w-4" />
        <AlertTitle>Ошибка при загрузке слоев платы</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Попробовать снова
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2">
                  Отладочная информация
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Отладочная информация</DialogTitle>
                </DialogHeader>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-xs whitespace-pre-wrap">{debugInfo}</pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  // Если слои не найдены, показываем сообщение
  if (layers.length === 0) {
    return (
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Слои не найдены</AlertTitle>
        <AlertDescription>
          Для данной платы не найдено ни одного слоя. Попробуйте загрузить другой ODB++ файл.
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/upload")}>
              Загрузить другой файл
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-2">
                  Отладочная информация
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Отладочная информация</DialogTitle>
                </DialogHeader>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-xs whitespace-pre-wrap">{debugInfo}</pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">
          Визуализация слоев платы: {boardName}
          {isDemoData && <span className="ml-2 text-sm text-orange-500 font-normal">(Демо-данные)</span>}
        </h3>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOutIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomInIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetZoom}>
            <RotateCcwIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportSvg}>
            <Download className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <InfoIcon className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Отладочная информация</DialogTitle>
              </DialogHeader>
              <div className="bg-muted p-4 rounded-md">
                <pre className="text-xs whitespace-pre-wrap">{debugInfo}</pre>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 bg-muted rounded-lg overflow-hidden" style={{ height: "500px" }}>
          <div ref={svgContainerRef} className="w-full h-full overflow-auto"></div>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium mb-4">Слои ({layers.length})</h4>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {layers.map((layer) => (
              <div key={layer.name} className="flex items-center space-x-2">
                <Checkbox
                  id={`layer-${layer.name}`}
                  checked={visibleLayers[layer.name] || false}
                  onCheckedChange={() => toggleLayerVisibility(layer.name)}
                />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: layer.color }}></div>
                <label htmlFor={`layer-${layer.name}`} className="text-sm">
                  {layer.name} ({layer.type}
                  {layer.side ? `, ${layer.side}` : ""})
                  <span className="text-xs text-gray-500 ml-1">({layer.featuresCount} элем.)</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
