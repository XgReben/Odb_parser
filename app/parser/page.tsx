"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUp, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { parseODBFile } from "@/lib/odb-parser"
import { formatFileSize } from "@/components/file-size-formatter"
import { ParsedDataViewer } from "@/components/parsed-data-viewer"
import { LayerVisualization } from "@/components/layer-visualization"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { BoardLayer } from "@/lib/types"
import type { BoardData } from "@/lib/types"

export default function ParserPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<BoardData | null>(null)
  const [activeTab, setActiveTab] = useState("components")
  const [boardId, setBoardId] = useState<string>("")
  const [layers, setLayers] = useState<BoardLayer[]>([])
  const [loading, setLoading] = useState(false)
  const [apiData, setApiData] = useState<any>(null)
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
      setError(null)
      setParsedData(null)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0])
      setError(null)
      setParsedData(null)
    }
  }

  const handleParse = useCallback(async () => {
    if (!file) {
      setError("Please select a file to parse")
      return
    }

    setParsing(true)
    setProgress(0)
    setError(null)
    setParsedData(null)

    try {
      // Проверяем тип файла
      if (
        !file.name.endsWith(".zip") &&
        !file.name.endsWith(".tgz") &&
        !file.name.endsWith(".tar.gz") &&
        !file.name.endsWith(".odb")
      ) {
        throw new Error("Only ZIP, TGZ, TAR.GZ, and ODB files are supported")
      }

      // Симулируем прогресс парсинга
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 5
        })
      }, 300)

      // Парсим файл
      const data = await parseODBFile(file)

      clearInterval(progressInterval)
      setProgress(100)
      setParsedData(data)
    } catch (err) {
      console.error("Error parsing file:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setParsing(false)
    }
  }, [file])

  const resetParser = () => {
    setFile(null)
    setParsing(false)
    setProgress(0)
    setError(null)
    setParsedData(null)
  }

  // Загрузка данных слоев
  const loadLayerData = async (id: string) => {
    if (!id) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/board-layers/${id}`)
      const data = await response.json()

      setApiData(data)

      if (data.success) {
        console.log(`Получены данные ${data.layersCount} слоев`)
        setLayers(data.layers || [])
        if (data.layers && data.layers.length > 0) {
          setSelectedLayer(data.layers[0].name)
        }
      } else {
        setError(data.message || "Ошибка при загрузке данных слоев")
      }
    } catch (err) {
      setError("Ошибка при загрузке данных: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  // Генерация тестовых слоев
  const generateTestLayers = () => {
    const testLayers: BoardLayer[] = []

    // Слой с линиями
    const linesLayer: BoardLayer = {
      name: "test_lines",
      type: "copper",
      side: "TOP",
      lines: [],
      circles: [],
      polygons: [],
      texts: [],
      color: "#c87137",
      visible: true,
    }

    // Добавляем линии
    for (let i = 0; i < 10; i++) {
      linesLayer.lines.push({
        start: { x: 10, y: 10 + i * 10 },
        end: { x: 90, y: 10 + i * 10 },
        width: 1,
      })
    }

    // Слой с окружностями
    const circlesLayer: BoardLayer = {
      name: "test_circles",
      type: "copper",
      side: "TOP",
      lines: [],
      circles: [],
      polygons: [],
      texts: [],
      color: "#c87137",
      visible: true,
    }

    // Добавляем окружности
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        circlesLayer.circles.push({
          center: { x: 20 + i * 20, y: 20 + j * 20 },
          radius: 5,
        })
      }
    }

    // Слой с полигонами
    const polygonsLayer: BoardLayer = {
      name: "test_polygons",
      type: "copper",
      side: "TOP",
      lines: [],
      circles: [],
      polygons: [],
      texts: [],
      color: "#c87137",
      visible: true,
    }

    // Добавляем полигоны
    polygonsLayer.polygons.push({
      points: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
        { x: 10, y: 10 }, // Замыкаем полигон
      ],
    })

    polygonsLayer.polygons.push({
      points: [
        { x: 30, y: 30 },
        { x: 70, y: 30 },
        { x: 70, y: 70 },
        { x: 30, y: 70 },
        { x: 30, y: 30 }, // Замыкаем полигон
      ],
    })

    // Слой с текстами
    const textsLayer: BoardLayer = {
      name: "test_texts",
      type: "silkscreen",
      side: "TOP",
      lines: [],
      circles: [],
      polygons: [],
      texts: [],
      color: "#ffffff",
      visible: true,
    }

    // Добавляем тексты
    textsLayer.texts.push({
      position: { x: 50, y: 30 },
      content: "TEST PCB",
      size: 10,
    })

    textsLayer.texts.push({
      position: { x: 50, y: 50 },
      content: "v1.0",
      size: 8,
    })

    // Слой с комбинированными элементами
    const combinedLayer: BoardLayer = {
      name: "test_combined",
      type: "copper",
      side: "TOP",
      lines: [],
      circles: [],
      polygons: [],
      texts: [],
      color: "#c87137",
      visible: true,
    }

    // Добавляем линии
    combinedLayer.lines.push(
      { start: { x: 10, y: 10 }, end: { x: 90, y: 10 }, width: 1 },
      { start: { x: 90, y: 10 }, end: { x: 90, y: 90 }, width: 1 },
      { start: { x: 90, y: 90 }, end: { x: 10, y: 90 }, width: 1 },
      { start: { x: 10, y: 90 }, end: { x: 10, y: 10 }, width: 1 },
    )

    // Добавляем окружности
    combinedLayer.circles.push(
      { center: { x: 30, y: 30 }, radius: 10 },
      { center: { x: 70, y: 30 }, radius: 10 },
      { center: { x: 70, y: 70 }, radius: 10 },
      { center: { x: 30, y: 70 }, radius: 10 },
    )

    // Добавляем полигон
    combinedLayer.polygons.push({
      points: [
        { x: 40, y: 40 },
        { x: 60, y: 40 },
        { x: 60, y: 60 },
        { x: 40, y: 60 },
        { x: 40, y: 40 }, // Замыкаем полигон
      ],
    })

    // Добавляем текст
    combinedLayer.texts.push({
      position: { x: 50, y: 50 },
      content: "TEST",
      size: 8,
    })

    // Добавляем все слои
    testLayers.push(linesLayer, circlesLayer, polygonsLayer, textsLayer, combinedLayer)

    setLayers(testLayers)
    setSelectedLayer("test_combined")
  }

  // Функция для анализа содержимого файла features
  const analyzeFeatureFile = () => {
    if (!file) {
      setError("Пожалуйста, выберите файл для анализа")
      return
    }

    setParsing(true)
    setProgress(0)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string

        // Анализируем содержимое файла
        const lines = content.split(/\r?\n/)
        const totalLines = lines.length

        // Ищем строки с определениями символов
        const symbolLines = lines.filter((line) => line.trim().startsWith("$"))

        // Ищем строки с падами
        const padLines = lines.filter((line) => line.trim().startsWith("P "))

        // Ищем строки с линиями
        const lineLines = lines.filter((line) => line.trim().startsWith("L "))

        // Ищем строки с окружностями
        const circleLines = lines.filter((line) => line.trim().startsWith("C "))

        // Создаем отчет
        const report = {
          totalLines,
          symbolLines: symbolLines.length,
          padLines: padLines.length,
          lineLines: lineLines.length,
          circleLines: circleLines.length,
          firstSymbols: symbolLines.slice(0, 10),
          firstPads: padLines.slice(0, 10),
          firstLines: lineLines.slice(0, 10),
          firstCircles: circleLines.slice(0, 10),
        }

        // Более детальный анализ содержимого
        const detailedAnalysis = {
          // Ищем строки с полигонами
          polygonKeywords: lines.filter((line) => {
            const lower = line.toLowerCase()
            return (
              lower.includes("polygon") ||
              lower.includes("surface") ||
              lower.includes("area") ||
              line.trim().startsWith("S ") ||
              line.trim().startsWith("OB ") ||
              line.trim().startsWith("OS ")
            )
          }),

          // Ищем строки с дугами
          arcKeywords: lines.filter((line) => {
            const lower = line.toLowerCase()
            return (
              lower.includes("arc") ||
              lower.includes("circle") ||
              line.trim().startsWith("A ") ||
              (line.trim().startsWith("P ") && line.includes("r"))
            )
          }),

          // Ищем строки с падами
          padKeywords: lines.filter((line) => {
            const lower = line.toLowerCase()
            return lower.includes("pad") || lower.includes("via") || line.trim().startsWith("P ")
          }),

          // Анализируем структуру файла
          structureKeywords: lines.filter((line) => {
            const lower = line.toLowerCase()
            return (
              lower.includes("se") ||
              lower.includes("oe") ||
              lower.includes("ob") ||
              lower.includes("os") ||
              line.trim() === "SE" ||
              line.trim() === "OE"
            )
          }),

          // Ищем координаты
          coordinateLines: lines.filter((line) => {
            return line.trim().match(/^\s*-?\d+\.?\d*\s+-?\d+\.?\d*\s*$/)
          }),
        }

        // Обновляем отчет
        const enhancedReport = {
          ...report,
          detailedAnalysis,
          polygonKeywordCount: detailedAnalysis.polygonKeywords.length,
          arcKeywordCount: detailedAnalysis.arcKeywords.length,
          padKeywordCount: detailedAnalysis.padKeywords.length,
          structureKeywordCount: detailedAnalysis.structureKeywords.length,
          coordinateLineCount: detailedAnalysis.coordinateLines.length,

          // Примеры найденных строк
          examplePolygonLines: detailedAnalysis.polygonKeywords.slice(0, 5),
          exampleArcLines: detailedAnalysis.arcKeywords.slice(0, 5),
          exampleStructureLines: detailedAnalysis.structureKeywords.slice(0, 5),
          exampleCoordinateLines: detailedAnalysis.coordinateLines.slice(0, 5),
        }

        // Устанавливаем расширенный отчет
        setApiData(enhancedReport)

        setProgress(100)
      } catch (err) {
        console.error("Error analyzing file:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      } finally {
        setParsing(false)
      }
    }

    reader.onerror = () => {
      setError("Error reading file")
      setParsing(false)
    }

    reader.readAsText(file)
  }

  // Обработчик выбора слоя
  const handleLayerSelect = (value: string) => {
    setSelectedLayer(value)
  }

  // Получаем выбранный слой
  const selectedLayerData = selectedLayer
    ? layers.find((layer) => layer.name === selectedLayer)
    : layers.length > 0
      ? layers[0]
      : null

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">ODB++ Parser</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Загрузка файла</CardTitle>
            <CardDescription>Загрузите ODB++ файл для парсинга и просмотра содержимого</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div
              className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer mb-4 hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">Перетащите ODB++ файл сюда или нажмите для выбора</p>
              <p className="text-xs text-muted-foreground">Поддерживаются ZIP, TGZ, TAR.GZ и ODB файлы</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tgz,.tar.gz,.odb"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {file && (
              <div className="bg-muted p-3 rounded-md mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                    Удалить
                  </Button>
                </div>
              </div>
            )}

            {parsing && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {progress < 95 ? "Парсинг ODB++ файла..." : "Обработка компонентов и слоев..."}
                  </p>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-right">{progress}%</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetParser} disabled={!file || parsing}>
              Сбросить
            </Button>
            <Button onClick={handleParse} disabled={!file || parsing}>
              {parsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Парсинг...
                </>
              ) : (
                "Парсить файл"
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Отладка парсера слоев</CardTitle>
            <CardDescription>Инструменты для тестирования и отладки парсера слоев</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex gap-2 flex-wrap">
                <Button onClick={generateTestLayers} variant="outline">
                  Сгенерировать тестовые слои
                </Button>
                <Button onClick={() => loadLayerData(boardId)} disabled={!boardId || loading}>
                  {loading ? "Загрузка..." : "Загрузить слои платы"}
                </Button>
                <Button onClick={analyzeFeatureFile} disabled={!file || parsing} variant="secondary">
                  {parsing ? "Анализ..." : "Анализировать файл"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="ID платы"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                />
              </div>

              {layers.length > 0 && (
                <div className="mt-4">
                  <Select value={selectedLayer || ""} onValueChange={handleLayerSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите слой" />
                    </SelectTrigger>
                    <SelectContent>
                      {layers.map((layer) => (
                        <SelectItem key={layer.name} value={layer.name}>
                          {layer.name} ({layer.type}, {layer.side})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedLayerData && (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <h3 className="text-lg font-medium mb-2">Отладочная информация</h3>
                <div className="text-sm">
                  <p>Слой: {selectedLayerData.name}</p>
                  <p>Тип: {selectedLayerData.type}</p>
                  <p>Сторона: {selectedLayerData.side}</p>
                  <p>Линий: {selectedLayerData.lines?.length || 0}</p>
                  <p>Окружностей: {selectedLayerData.circles?.length || 0}</p>
                  <p>Полигонов: {selectedLayerData.polygons?.length || 0}</p>
                  <p>Текстов: {selectedLayerData.texts?.length || 0}</p>
                </div>
              </div>
            )}

            {apiData && (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md mt-4">
                <h3 className="text-lg font-medium mb-2">Анализ файла</h3>
                <div className="text-sm">
                  <p>Всего строк: {apiData.totalLines}</p>
                  <p>Определений символов: {apiData.symbolLines}</p>
                  <p>Строк с падами: {apiData.padLines}</p>
                  <p>Строк с линиями: {apiData.lineLines}</p>
                  <p>Строк с окружностями: {apiData.circleLines}</p>

                  {apiData.firstSymbols && apiData.firstSymbols.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Примеры определений символов:</p>
                      <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-auto max-h-32">
                        {apiData.firstSymbols.join("\n")}
                      </pre>
                    </div>
                  )}

                  {apiData.firstPads && apiData.firstPads.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Примеры строк с падами:</p>
                      <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-auto max-h-32">
                        {apiData.firstPads.join("\n")}
                      </pre>
                    </div>
                  )}
                </div>
                {apiData.detailedAnalysis && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Детальный анализ:</h4>
                    <div className="text-sm space-y-1">
                      <p>Строк с ключевыми словами полигонов: {apiData.polygonKeywordCount}</p>
                      <p>Строк с ключевыми словами дуг: {apiData.arcKeywordCount}</p>
                      <p>Строк с ключевыми словами падов: {apiData.padKeywordCount}</p>
                      <p>Строк со структурными командами: {apiData.structureKeywordCount}</p>
                      <p>Строк с координатами: {apiData.coordinateLineCount}</p>
                    </div>

                    {apiData.examplePolygonLines && apiData.examplePolygonLines.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Примеры строк с полигонами:</p>
                        <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-auto max-h-32">
                          {apiData.examplePolygonLines.join("\n")}
                        </pre>
                      </div>
                    )}

                    {apiData.exampleArcLines && apiData.exampleArcLines.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Примеры строк с дугами:</p>
                        <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-auto max-h-32">
                          {apiData.exampleArcLines.join("\n")}
                        </pre>
                      </div>
                    )}

                    {apiData.exampleStructureLines && apiData.exampleStructureLines.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Примеры структурных команд:</p>
                        <pre className="text-xs bg-black/10 dark:bg-white/10 p-2 rounded overflow-auto max-h-32">
                          {apiData.exampleStructureLines.join("\n")}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {parsedData && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{parsedData.name}</h2>
              <p className="text-muted-foreground">
                {parsedData.components.length} компонентов, {parsedData.layers?.length || 0} слоев
              </p>
            </div>
            <Button variant="outline" onClick={resetParser}>
              Парсить другой файл
            </Button>
          </div>

          <Alert className="mb-6 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Парсинг успешен</AlertTitle>
            <AlertDescription>Файл успешно обработан. Отображаются извлеченные данные.</AlertDescription>
          </Alert>

          <Tabs defaultValue="components" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="components">Компоненты ({parsedData.components.length})</TabsTrigger>
              <TabsTrigger value="layers">Слои ({parsedData.layers?.length || 0})</TabsTrigger>
              <TabsTrigger value="visualization">Визуализация слоев</TabsTrigger>
              <TabsTrigger value="profile">Профиль платы</TabsTrigger>
              <TabsTrigger value="debug">Отладочная информация</TabsTrigger>
            </TabsList>

            <TabsContent value="components">
              <ParsedDataViewer data={parsedData.components} type="components" />
            </TabsContent>

            <TabsContent value="layers">
              <ParsedDataViewer data={parsedData.layers || []} type="layers" />
            </TabsContent>

            <TabsContent value="visualization">
              {parsedData.layers && parsedData.layers.length > 0 ? (
                <LayerVisualization layers={parsedData.layers} />
              ) : (
                <Card>
                  <CardContent className="py-6 text-center">
                    <p className="text-muted-foreground">Не найдены слои для визуализации</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="profile">
              <ParsedDataViewer data={parsedData.profile || {}} type="profile" />
            </TabsContent>

            <TabsContent value="debug">
              <ParsedDataViewer data={parsedData.debug || {}} type="debug" />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {selectedLayerData && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Визуализация выбранного слоя: {selectedLayerData.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <LayerVisualization layers={[selectedLayerData]} />
          </CardContent>
        </Card>
      )}

      {layers.length > 0 && layers.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Визуализация всех слоев</CardTitle>
          </CardHeader>
          <CardContent>
            <LayerVisualization layers={layers} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
