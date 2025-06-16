// Функция для сохранения данных платы в localStorage
export function saveClientBoardData(id: string, data: any): void {
  try {
    // Создаем копию данных для сохранения
    const storageData = { ...data }

    // Удаляем большие объекты из данных перед сохранением
    if (storageData.layers) {
      // Сохраняем только метаданные слоев, а не все геометрические данные
      storageData.layers = storageData.layers.map((layer: any) => ({
        name: layer.name,
        type: layer.type,
        side: layer.side,
        color: layer.color,
        visible: layer.visible,
        // Сохраняем только количество элементов, а не сами элементы
        linesCount: layer.lines?.length || 0,
        circlesCount: layer.circles?.length || 0,
        polygonsCount: layer.polygons?.length || 0,
        textsCount: layer.texts?.length || 0,
      }))
    }

    // Преобразуем данные в строку JSON
    const jsonData = JSON.stringify(storageData)

    // Сохраняем данные в localStorage
    localStorage.setItem(`board_${id}`, jsonData)

    // Обновляем список плат
    const boardsList = getClientBoardsList()
    if (!boardsList.includes(id)) {
      boardsList.push(id)
      localStorage.setItem("boards_list", JSON.stringify(boardsList))
    }
  } catch (error) {
    console.error("Error saving board data to localStorage:", error)
  }
}

// Функция для получения данных платы из localStorage
export function getClientBoardData(id: string): any {
  try {
    const jsonData = localStorage.getItem(`board_${id}`)
    if (!jsonData) return null
    return JSON.parse(jsonData)
  } catch (error) {
    console.error("Error getting board data from localStorage:", error)
    return null
  }
}

// Функция для получения списка плат из localStorage
export function getClientBoardsList(): string[] {
  try {
    const jsonData = localStorage.getItem("boards_list")
    if (!jsonData) return []
    return JSON.parse(jsonData)
  } catch (error) {
    console.error("Error getting boards list from localStorage:", error)
    return []
  }
}

// Функция для удаления данных платы из localStorage
export function removeClientBoardData(id: string): void {
  try {
    localStorage.removeItem(`board_${id}`)

    // Обновляем список плат
    const boardsList = getClientBoardsList()
    const updatedList = boardsList.filter((boardId) => boardId !== id)
    localStorage.setItem("boards_list", JSON.stringify(updatedList))
  } catch (error) {
    console.error("Error removing board data from localStorage:", error)
  }
}

// Функция для получения всех плат из localStorage
export function getAllClientBoards(): Array<{ id: string; name: string; components: number }> {
  try {
    const boardsList = getClientBoardsList()
    const boards: Array<{ id: string; name: string; components: number }> = []

    for (const boardId of boardsList) {
      const boardData = getClientBoardData(boardId)
      if (boardData) {
        boards.push({
          id: boardId,
          name: boardData.name || `Board ${boardId.substring(0, 8)}`,
          components: boardData.components?.length || 0,
        })
      }
    }

    return boards
  } catch (error) {
    console.error("Error getting all client boards:", error)
    return []
  }
}

// Функция для сохранения слоев платы в IndexedDB
export async function saveClientBoardLayers(id: string, layers: any[]): Promise<void> {
  try {
    // Используем IndexedDB для хранения больших объемов данных
    const request = indexedDB.open("pcb-assembly-app", 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains("layers")) {
        db.createObjectStore("layers", { keyPath: "id" })
      }
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const transaction = db.transaction(["layers"], "readwrite")
      const store = transaction.objectStore("layers")

      // Сохраняем каждый слой отдельно
      layers.forEach((layer, index) => {
        store.put({
          id: `${id}_layer_${index}`,
          boardId: id,
          layerIndex: index,
          data: layer,
        })
      })

      // Сохраняем метаданные о слоях
      const layersMeta = layers.map((layer, index) => ({
        index,
        name: layer.name,
        type: layer.type,
        side: layer.side,
        color: layer.color,
        visible: layer.visible || true,
      }))

      store.put({
        id: `${id}_layers_meta`,
        boardId: id,
        meta: layersMeta,
      })

      transaction.oncomplete = () => {
        console.log(`Layers for board ${id} saved to IndexedDB`)
        db.close()
      }

      transaction.onerror = (error) => {
        console.error("Error saving layers to IndexedDB:", error)
        db.close()
      }
    }

    request.onerror = (error) => {
      console.error("Error opening IndexedDB:", error)
    }
  } catch (error) {
    console.error("Error saving board layers to IndexedDB:", error)
  }
}

// Функция для получения слоев платы из IndexedDB
export async function getClientBoardLayers(id: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open("pcb-assembly-app", 1)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains("layers")) {
          db.createObjectStore("layers", { keyPath: "id" })
        }
      }

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = db.transaction(["layers"], "readonly")
        const store = transaction.objectStore("layers")

        // Сначала получаем метаданные о слоях
        const metaRequest = store.get(`${id}_layers_meta`)

        metaRequest.onsuccess = () => {
          if (!metaRequest.result) {
            console.warn(`No layers metadata found for board ${id}`)
            resolve([])
            db.close()
            return
          }

          const layersMeta = metaRequest.result.meta
          const layers: any[] = new Array(layersMeta.length)
          let loadedCount = 0

          // Загружаем каждый слой
          layersMeta.forEach((meta: any) => {
            const layerRequest = store.get(`${id}_layer_${meta.index}`)

            layerRequest.onsuccess = () => {
              if (layerRequest.result) {
                layers[meta.index] = layerRequest.result.data
              } else {
                console.warn(`Layer ${meta.index} not found for board ${id}`)
              }

              loadedCount++
              if (loadedCount === layersMeta.length) {
                // Все слои загружены
                resolve(layers.filter(Boolean))
                db.close()
              }
            }

            layerRequest.onerror = (error) => {
              console.error(`Error loading layer ${meta.index}:`, error)
              loadedCount++
              if (loadedCount === layersMeta.length) {
                resolve(layers.filter(Boolean))
                db.close()
              }
            }
          })
        }

        metaRequest.onerror = (error) => {
          console.error("Error loading layers metadata:", error)
          resolve([])
          db.close()
        }
      }

      request.onerror = (error) => {
        console.error("Error opening IndexedDB:", error)
        reject(error)
      }
    } catch (error) {
      console.error("Error getting board layers from IndexedDB:", error)
      reject(error)
    }
  })
}

// Функция для обновления данных платы
export function updateClientBoardData(id: string, data: Partial<any>): void {
  try {
    const currentData = getClientBoardData(id)
    if (!currentData) {
      console.warn(`Board with ID ${id} not found`)
      return
    }

    // Обновляем данные
    const updatedData = {
      ...currentData,
      ...data,
    }

    // Сохраняем обновленные данные
    saveClientBoardData(id, updatedData)
  } catch (error) {
    console.error("Error updating board data in localStorage:", error)
  }
}

/**
 * Сохраняет SVG-представления слоев платы в localStorage
 */
export function saveClientBoardLayersSvg(boardId: string, layersSvg: Record<string, string>): void {
  try {
    // Для каждого слоя сохраняем SVG отдельно, чтобы избежать превышения лимита localStorage
    for (const [layerName, svg] of Object.entries(layersSvg)) {
      const key = `board_${boardId}_layer_svg_${layerName}`
      localStorage.setItem(key, svg)
    }

    // Сохраняем список имен слоев
    const layerNames = Object.keys(layersSvg)
    localStorage.setItem(`board_${boardId}_layer_svg_names`, JSON.stringify(layerNames))

    console.log(`Сохранено ${layerNames.length} SVG-представлений слоев для платы ${boardId}`)
  } catch (error) {
    console.error(`Ошибка при сохранении SVG-представлений слоев для платы ${boardId}:`, error)
  }
}

/**
 * Получает SVG-представления слоев платы из localStorage
 */
export function getClientBoardLayersSvg(boardId: string): Record<string, string> {
  try {
    const layerNamesJson = localStorage.getItem(`board_${boardId}_layer_svg_names`)
    if (!layerNamesJson) {
      return {}
    }

    const layerNames = JSON.parse(layerNamesJson)
    const layersSvg: Record<string, string> = {}

    for (const layerName of layerNames) {
      const key = `board_${boardId}_layer_svg_${layerName}`
      const svg = localStorage.getItem(key)
      if (svg) {
        layersSvg[layerName] = svg
      }
    }

    console.log(`Получено ${Object.keys(layersSvg).length} SVG-представлений слоев для платы ${boardId}`)
    return layersSvg
  } catch (error) {
    console.error(`Ошибка при получении SVG-представлений слоев для платы ${boardId}:`, error)
    return {}
  }
}
