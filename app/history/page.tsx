"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, CircuitBoard, Clock, FileUp, Loader2 } from "lucide-react"
import { getAllClientBoards } from "@/lib/client-storage"

interface BoardHistoryItem {
  id: string
  name: string
  components: number
  lastModified?: Date
  progress?: number
}

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<BoardHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBoards() {
      try {
        setLoading(true)

        // Сначала проверяем, есть ли данные в localStorage
        const clientBoards = getAllClientBoards()
        if (clientBoards.length > 0) {
          console.log(`Found ${clientBoards.length} boards in localStorage`)

          // Добавляем дополнительную информацию
          const historyItems: BoardHistoryItem[] = clientBoards.map((board) => ({
            ...board,
            lastModified: new Date(),
            progress: Math.floor(Math.random() * 101), // Случайный прогресс для демонстрации
          }))

          setHistoryItems(historyItems)
          setLoading(false)
          return
        }

        // Если данных нет в localStorage, пробуем загрузить с сервера
        const response = await fetch("/api/boards")

        if (!response.ok) {
          throw new Error(`Failed to fetch boards: ${response.status}`)
        }

        const boards = await response.json()
        console.log(`Loaded ${boards.length} boards from API`)

        // Преобразуем данные и добавляем дополнительную информацию
        const historyItems: BoardHistoryItem[] = boards.map((board: any) => ({
          id: board.id,
          name: board.name,
          components: board.components,
          lastModified: new Date(),
          progress: Math.floor(Math.random() * 101), // Случайный прогресс для демонстрации
        }))

        setHistoryItems(historyItems)
      } catch (err) {
        console.error("Error fetching boards:", err)
        setError(err instanceof Error ? err.message : "Failed to load boards")
      } finally {
        setLoading(false)
      }
    }

    fetchBoards()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-medium">Загрузка истории плат...</h2>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Ошибка загрузки данных</CardTitle>
            <CardDescription>Не удалось загрузить историю плат</CardDescription>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button className="mt-4" onClick={() => (window.location.href = "/")}>
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recent Boards</h1>
        <Link href="/upload">
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            Upload New Board
          </Button>
        </Link>
      </div>

      {historyItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Assembly History</CardTitle>
            <CardDescription>Continue working on previously uploaded boards</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Board Name</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <CircuitBoard className="h-4 w-4 text-muted-foreground" />
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.lastModified?.toLocaleDateString() || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${item.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-muted-foreground">{item.progress || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/board/${item.id}`}>
                        <Button variant="ghost" size="sm">
                          Continue
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CircuitBoard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No boards found</h3>
            <p className="text-sm text-muted-foreground mb-4">You haven&apos;t uploaded any boards yet</p>
            <Link href="/upload">
              <Button>
                <FileUp className="mr-2 h-4 w-4" />
                Upload Your First Board
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
