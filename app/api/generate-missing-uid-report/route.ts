import { type NextRequest, NextResponse } from "next/server"
import { getBoardData } from "@/lib/board-storage"

export async function POST(request: NextRequest) {
  try {
    const { boardId } = await request.json()

    if (!boardId) {
      return NextResponse.json({ error: "Board ID is required" }, { status: 400 })
    }

    // Получаем данные платы
    const boardData = await getBoardData(boardId)

    if (!boardData) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 })
    }

    // Проверяем наличие компонентов
    if (!boardData.components || boardData.components.length === 0) {
      return NextResponse.json({ error: "No components found for this board" }, { status: 404 })
    }

    // Находим компоненты без UID
    const componentsWithoutUid = boardData.components.filter(
      (component) =>
        !component.uid ||
        component.uid.startsWith("C-") ||
        component.uid.startsWith("P-") ||
        component.uid.startsWith("S-") ||
        component.uid.startsWith("T-"),
    )

    // Создаем отчет
    const report = {
      boardId,
      boardName: boardData.name,
      totalComponents: boardData.components.length,
      componentsWithoutUid: componentsWithoutUid.length,
      componentsWithUid: boardData.components.length - componentsWithoutUid.length,
      components: componentsWithoutUid.map((component) => ({
        name: component.name,
        package: component.package,
        side: component.side,
        x: component.x,
        y: component.y,
        rotation: component.rotation,
      })),
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error("Error generating missing UID report:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
