import { type NextRequest, NextResponse } from "next/server"
import { getBoardData } from "@/lib/board-storage"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const boardId = params.id
    console.log(`Получение данных платы с ID: ${boardId}`)

    const boardData = await getBoardData(boardId)

    if (!boardData) {
      console.warn(`Плата с ID ${boardId} не найдена`)
      return NextResponse.json({ error: "Плата не найдена" }, { status: 404 })
    }

    // Убедимся, что свойство components всегда существует
    if (!boardData.components) {
      console.warn(`Плата с ID ${boardId} не имеет свойства components, инициализируем пустым массивом`)
      boardData.components = []
    }

    return NextResponse.json(boardData)
  } catch (error) {
    console.error("Ошибка при получении данных платы:", error)
    return NextResponse.json(
      { error: `Ошибка при получении данных платы: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
