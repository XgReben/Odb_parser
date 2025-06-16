import { type NextRequest, NextResponse } from "next/server"
import { getBoardData, updateBoardData } from "@/lib/board-storage"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const { extractPath } = await request.json()

    if (!extractPath) {
      return NextResponse.json({ success: false, message: "Extract path is required" }, { status: 400 })
    }

    // Получаем данные платы
    const boardData = await getBoardData(id)

    if (!boardData) {
      return NextResponse.json({ success: false, message: `Board with ID ${id} not found` }, { status: 404 })
    }

    // Обновляем путь к распакованному архиву
    const updatedBoardData = await updateBoardData(id, { extractPath })

    if (!updatedBoardData) {
      return NextResponse.json({ success: false, message: "Failed to update board data" }, { status: 500 })
    }

    // Возвращаем обновленные данные платы
    return NextResponse.json({
      success: true,
      boardData: updatedBoardData,
    })
  } catch (error) {
    console.error("API: Ошибка при обновлении пути к распакованному архиву:", error)

    // Если произошла ошибка, возвращаем сообщение об ошибке
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error updating extract path",
      },
      { status: 500 },
    )
  }
}
