import type { BoardData } from "./types"

// In-memory хранилище для данных плат
const boardsMap = new Map<string, BoardData>()

/**
 * Сохраняет данные платы
 */
export async function saveBoardData(id: string, data: BoardData): Promise<void> {
  try {
    // Добавляем ID в данные платы
    data.id = id

    // Сохраняем данные в Map
    boardsMap.set(id, data)
    console.log(`Данные платы сохранены с ID: ${id}`)
  } catch (error) {
    console.error("Ошибка при сохранении данных платы:", error)
    throw error
  }
}

/**
 * Получает данные платы
 */
export async function getBoardData(id: string): Promise<BoardData | null> {
  try {
    // Получаем данные из Map
    const boardData = boardsMap.get(id)

    if (!boardData) {
      console.warn(`Плата с ID ${id} не найдена`)
      return null
    }

    return boardData
  } catch (error) {
    console.error("Ошибка при получении данных платы:", error)
    return null
  }
}

/**
 * Получает список всех плат
 */
export async function getAllBoards(): Promise<BoardData[]> {
  try {
    // Преобразуем Map в массив
    return Array.from(boardsMap.values())
  } catch (error) {
    console.error("Ошибка при получении списка плат:", error)
    return []
  }
}

/**
 * Обновляет данные платы
 */
export async function updateBoardData(id: string, data: Partial<BoardData>): Promise<BoardData | null> {
  try {
    // Получаем текущие данные платы
    const currentData = await getBoardData(id)
    if (!currentData) {
      console.warn(`Плата с ID ${id} не найдена`)
      return null
    }

    // Обновляем данные
    const updatedData: BoardData = {
      ...currentData,
      ...data,
      id, // Убедимся, что ID не изменился
    }

    // Сохраняем обновленные данные
    await saveBoardData(id, updatedData)

    return updatedData
  } catch (error) {
    console.error("Ошибка при обновлении данных платы:", error)
    return null
  }
}

/**
 * Удаляет данные платы
 */
export async function deleteBoardData(id: string): Promise<boolean> {
  try {
    // Проверяем существование платы
    if (!boardsMap.has(id)) {
      console.warn(`Плата с ID ${id} не найдена`)
      return false
    }

    // Удаляем данные из Map
    boardsMap.delete(id)
    console.log(`Плата с ID ${id} удалена`)

    return true
  } catch (error) {
    console.error("Ошибка при удалении данных платы:", error)
    return false
  }
}
