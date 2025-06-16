"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getClientBoardData } from "@/lib/client-storage"
import ComponentTable from "@/components/component-table"
import EnhancedBoardVisualization from "@/components/enhanced-board-visualization"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import MissingUidReportDialog from "@/components/missing-uid-report-dialog"

export default function BoardPage() {
  const params = useParams()
  const boardId = params.id as string
  const [boardData, setBoardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBoardData = () => {
      try {
        setLoading(true)
        setError(null)

        // Получаем данные платы из localStorage
        const data = getClientBoardData(boardId)
        if (!data) {
          throw new Error("Board data not found")
        }

        setBoardData(data)
      } catch (err) {
        console.error("Error fetching board data:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchBoardData()
  }, [boardId])

  // Функция для очистки кэша и перезагрузки страницы
  const clearCacheAndReload = () => {
    // Очищаем кэш localStorage для данной платы
    localStorage.removeItem(`board_${boardId}`)
    localStorage.removeItem(`board_layers_svg_${boardId}`)

    // Перезагружаем страницу
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-3">Загрузка данных платы...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Ошибка при загрузке данных платы</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/history")}>
              Вернуться к истории
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!boardData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Данные платы не найдены</AlertTitle>
        <AlertDescription>
          Не удалось найти данные для платы с ID: {boardId}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/history")}>
              Вернуться к истории
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{boardData.name || "Unnamed Board"}</h1>
          <p className="text-muted-foreground">
            {boardData.components?.length || 0} компонентов • {boardData.layers?.length || 0} слоев
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={clearCacheAndReload}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Очистить кэш и перезагрузить
          </Button>
          <MissingUidReportDialog boardId={boardId} />
        </div>
      </div>

      <Tabs defaultValue="visualization">
        <TabsList>
          <TabsTrigger value="visualization">Визуализация</TabsTrigger>
          <TabsTrigger value="components">Компоненты</TabsTrigger>
          <TabsTrigger value="debug">Отладка</TabsTrigger>
        </TabsList>
        <TabsContent value="visualization" className="p-4 border rounded-md">
          <EnhancedBoardVisualization boardId={boardId} />
        </TabsContent>
        <TabsContent value="components" className="p-4 border rounded-md">
          <ComponentTable components={boardData.components || []} />
        </TabsContent>
        <TabsContent value="debug" className="p-4 border rounded-md">
          <div className="bg-muted p-4 rounded-md">
            <h3 className="text-lg font-medium mb-4">Отладочная информация</h3>
            <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-[500px]">
              {JSON.stringify(boardData, null, 2)}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
