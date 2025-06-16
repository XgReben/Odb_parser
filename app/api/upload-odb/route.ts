import { type NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { parseODBFile } from "@/lib/odb-parser"
import { createArchiveStructure } from "@/components/archive-structure-viewer"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Проверяем расширение файла
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith(".zip") && !fileName.endsWith(".tgz") && !fileName.endsWith(".tar.gz")) {
      return NextResponse.json({ error: "Unsupported file format" }, { status: 400 })
    }

    // Получаем содержимое файла
    const fileBuffer = await file.arrayBuffer()

    // Распаковываем архив
    const zip = new JSZip()
    await zip.loadAsync(fileBuffer)

    // Создаем структуру архива для визуализации
    const archiveStructure = createArchiveStructure(zip)

    // Парсим ODB++ файл
    const boardData = await parseODBFile(file)

    // Добавляем структуру архива к данным платы
    boardData.archiveStructure = archiveStructure

    return NextResponse.json(boardData)
  } catch (error) {
    console.error("Error processing ODB++ file:", error)
    return NextResponse.json(
      { error: `Error processing ODB++ file: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
