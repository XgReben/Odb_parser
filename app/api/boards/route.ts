import { NextResponse } from "next/server"
import { getAllBoards } from "@/lib/board-storage"

export async function GET() {
  try {
    // Получаем список всех плат
    const boards = await getAllBoards()

    // Возвращаем список плат
    return NextResponse.json({
      success: true,
      boards: boards.map((board) => ({
        id: board.id,
        name: board.name,
        components: board.components?.length || 0,
        createdAt: board.createdAt || new Date().toISOString(),
      })),
    })
  } catch (error) {
    console.error("API: Ошибка при получении списка плат:", error)

    // Если произошла ошибка, возвращаем сообщение об ошибке
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error getting boards list",
      },
      { status: 500 },
    )
  }
}
