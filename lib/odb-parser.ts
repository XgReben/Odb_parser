import type { BoardData, Component } from "./types"
import JSZip from "jszip"
import { parseSpecificComponentFormat } from "./parseSpecificComponentFormat"

// Добавляем импорт функций для парсинга слоев и контура
import { parseLayersFromODB } from "./layer-parser"
import { parseProfileFromODB } from "./profile-parser"

// Улучшим функцию parseODBFile для более подробного логирования и отладки
export async function parseODBFile(file: File): Promise<BoardData> {
  try {
    console.log("Начинаем парсинг ODB++ файла:", file.name, "размер:", file.size, "тип:", file.type)

    // Проверяем, что файл существует и имеет размер
    if (!file || file.size === 0) {
      throw new Error("Файл пуст или не существует")
    }

    // Загружаем и распаковываем архив
    const zip = new JSZip()
    console.log("Начинаем распаковку архива...")

    try {
      // Преобразуем файл в ArrayBuffer перед распаковкой
      const arrayBuffer = await file.arrayBuffer()
      const zipContents = await zip.loadAsync(arrayBuffer)

      // Выводим подробную информацию о содержимом архива
      const filesList = Object.keys(zipContents.files)
      console.log("Архив распакован, найдено файлов:", filesList.length)

      // Выводим структуру директорий для отладки
      console.log("Структура директорий в архиве:")
      const directories = filesList.filter((f) => zipContents.files[f].dir)
      directories.sort().forEach((dir) => console.log(`- ${dir}`))

      console.log("Первые 20 файлов:", filesList.slice(0, 20))

      // Проверяем наличие ключевых директорий ODB++
      const odbDirectories = filesList.filter((f) => zip.files[f].dir)
      console.log("Структура директорий в архиве:")
      odbDirectories.sort().forEach((dir) => console.log(`- ${dir}`))

      // Анализируем структуру архива для определения формата ODB++
      const hasStepsDir = odbDirectories.some(
        (f) => f.includes("steps/") || f === "steps/" || f.includes("odb/steps/") || f.includes("/steps/"),
      )
      const hasComponentsDir = odbDirectories.some(
        (f) => f.includes("components/") || f === "components/" || f.includes("/components/"),
      )
      const hasLayersDir = odbDirectories.some(
        (f) => f.includes("layers/") || f === "layers/" || f.includes("/layers/"),
      )
      const hasProfileFile = filesList.some((f) => f.includes("profile") || f.endsWith("profile"))

      console.log("Анализ структуры архива:")
      console.log("- Наличие директории steps:", hasStepsDir)
      console.log("- Наличие директории components:", hasComponentsDir)
      console.log("- Наличие директории layers:", hasLayersDir)
      console.log("- Наличие файла profile:", hasProfileFile)

      // Определяем базовый путь для ODB++ структуры
      let odbBasePath = ""
      if (odbDirectories.some((d) => d.startsWith("odb/"))) {
        odbBasePath = "odb/"
        console.log("Обнаружена структура с базовым путем 'odb/'")
      } else if (odbDirectories.some((d) => d.startsWith("data/"))) {
        odbBasePath = "data/"
        console.log("Обнаружена структура с базовым путем 'data/'")
      }
      console.log("Базовый путь ODB++:", odbBasePath || "(корень архива)")

      // Ищем XML и другие потенциально полезные файлы
      const xmlFiles = filesList.filter((f) => f.endsWith(".xml"))
      const txtFiles = filesList.filter((f) => f.endsWith(".txt"))
      const csvFiles = filesList.filter((f) => f.endsWith(".csv"))
      console.log("Найдено XML файлов:", xmlFiles.length)
      console.log("Найдено TXT файлов:", txtFiles.length)
      console.log("Найдено CSV файлов:", csvFiles.length)

      // Извлекаем имя платы из имени файла
      const boardName = file.name.split(".")[0].replace(/_/g, " ") + " PCB"

      // Ищем компоненты в архиве
      let componentsData: Component[] = []
      let foundRealComponents = false
      let parsingMethod = "none"

      // Сначала пробуем найти компоненты в стандартной структуре ODB++
      try {
        console.log("Ищем компоненты в стандартной структуре ODB++...")
        componentsData = await findComponentsInStandardStructure(zipContents)
        console.log("Найдены компоненты в стандартной структуре:", componentsData.length)
        if (componentsData.length > 0) {
          foundRealComponents = true
          parsingMethod = "standard"
        }
      } catch (e) {
        console.warn("Не удалось найти компоненты в стандартной структуре:", e)
        // Не прерываем выполнение, продолжаем искать компоненты другими способами
      }

      // Если не удалось найти компоненты в стандартной структуре, ищем в указанных путях
      if (!foundRealComponents) {
        try {
          console.log("Ищем компоненты в указанных путях...")
          const specificComponents = await findComponentsInSpecificPaths(zipContents)
          console.log("Найдены компоненты в указанных путях:", specificComponents.length)
          if (specificComponents.length > 0) {
            componentsData = specificComponents
            foundRealComponents = true
            parsingMethod = "specific_paths"
          }
        } catch (e) {
          console.warn("Не удалось найти компоненты в указанных путях:", e)
        }
      }

      // Если не удалось найти компоненты в стандартной структуре, ищем во всем архиве
      if (!foundRealComponents) {
        try {
          console.log("Ищем компоненты во всем архиве...")
          const archiveComponents = await findComponentsInEntireArchive(zipContents)
          console.log("Найдены компоненты во всем архиве:", archiveComponents.length)
          if (archiveComponents.length > 0) {
            componentsData = archiveComponents
            foundRealComponents = true
            parsingMethod = "archive"
          }
        } catch (e) {
          console.warn("Не удалось найти компоненты во всем архиве:", e)
        }
      }

      // Если не удалось найти компоненты, пробуем найти их в текстовых файлах
      if (!foundRealComponents) {
        try {
          console.log("Ищем компоненты в текстовых файлах...")
          const textComponents = await findComponentsInTextFiles(zipContents)
          console.log("Найдены компоненты в текстовых файлах:", textComponents.length)
          if (textComponents.length > 0) {
            componentsData = textComponents
            foundRealComponents = true
            parsingMethod = "text"
          }
        } catch (e) {
          console.warn("Не удалось найти компоненты в текстовых файлах:", e)
        }
      }

      // Создаем данные платы с найденными компонентами (или пустой список, если компоненты не найдены)
      const boardData: BoardData = {
        name: boardName,
        width: 300, // Стандартные размеры, если не удалось извлечь из файла
        height: 200,
        components: componentsData || [], // Убедимся, что components всегда является массивом
        debug: {
          fileSize: file.size,
          fileType: file.type,
          totalFiles: filesList.length,
          xmlFiles: xmlFiles.length,
          txtFiles: txtFiles.length,
          csvFiles: csvFiles.length,
          hasStepsDir,
          hasComponentsDir,
          parsingMethod,
          directoryStructure: odbDirectories.slice(0, 50), // Добавляем структуру директорий для отладки (первые 50)
        },
      }

      // Ищем контур платы
      try {
        console.log("Ищем контур платы...")
        const profile = await parseProfileFromODB(zipContents)
        if (profile) {
          console.log("Найден контур платы:", profile)
          console.log(`Размеры контура: ${profile.width}x${profile.height}`)
          console.log(`Границы контура: (${profile.minX}, ${profile.minY}) - (${profile.maxX}, ${profile.maxY})`)
          console.log(`Количество полигонов в контуре: ${profile.outline.length}`)

          if (profile.outline.length > 0) {
            console.log(`Первый полигон содержит ${profile.outline[0].points.length} точек`)
            console.log(`Пример точек: ${JSON.stringify(profile.outline[0].points.slice(0, 3))}`)
          }

          boardData.profile = profile

          // Обновляем размеры платы на основе контура
          boardData.width = profile.width
          boardData.height = profile.height

          // Добавляем информацию о контуре в debug
          if (!boardData.debug) {
            boardData.debug = {}
          }
          boardData.debug.profileFound = true
          boardData.debug.profileDimensions = {
            width: profile.width,
            height: profile.height,
            minX: profile.minX,
            minY: profile.minY,
            maxX: profile.maxX,
            maxY: profile.maxY,
          }
          boardData.debug.profilePolygons = profile.outline.map((polygon) => polygon.points.length)
        } else {
          console.warn("Контур платы не найден")

          // Добавляем информацию об отсутствии контура в debug
          if (!boardData.debug) {
            boardData.debug = {}
          }
          boardData.debug.profileFound = false
        }
      } catch (e) {
        console.warn("Не удалось найти контур платы:", e)

        // Добавляем информацию об ошибке в debug
        if (!boardData.debug) {
          boardData.debug = {}
        }
        boardData.debug.profileError = e instanceof Error ? e.message : String(e)
      }

      // Ищем слои платы
      try {
        console.log("Ищем слои платы...")
        const layers = await parseLayersFromODB(zipContents)
        if (layers.length > 0) {
          console.log(`Найдено ${layers.length} слоев платы`)
          boardData.layers = layers

          // Добавляем информацию о найденных слоях в debug
          if (!boardData.debug) {
            boardData.debug = {}
          }
          boardData.debug.layersFound = layers.map((layer) => `${layer.name} (${layer.type}, ${layer.side})`)
          boardData.debug.layerDetails = layers.map((layer) => ({
            name: layer.name,
            type: layer.type,
            side: layer.side,
            lines: layer.lines.length,
            circles: layer.circles.length,
            polygons: layer.polygons.length,
            texts: layer.texts.length,
            color: layer.color,
          }))

          // Логируем детали о слоях для отладки
          layers.forEach((layer, index) => {
            console.log(
              `Слой ${index}: ${layer.name} (${layer.type}, ${layer.side}): ${layer.lines.length} линий, ${layer.circles.length} окружностей, ${layer.polygons.length} полигонов, ${layer.texts.length} текстов`,
            )

            // Выводим примеры элементов для проверки
            if (layer.lines.length > 0) {
              console.log("Пример линии:", JSON.stringify(layer.lines[0]))
            }
            if (layer.circles.length > 0) {
              console.log("Пример окружности:", JSON.stringify(layer.circles[0]))
            }
            if (layer.polygons.length > 0) {
              console.log("Пример полигона:", JSON.stringify(layer.polygons[0]))
            }
          })
        } else {
          console.warn("Слои платы не найдены")

          // Добавляем информацию об отсутствии слоев в debug
          if (!boardData.debug) {
            boardData.debug = {}
          }
          boardData.debug.layersFound = "No layers found"
        }
      } catch (e) {
        console.warn("Не удалось найти слои платы:", e)

        // Добавляем информацию об ошибке в debug
        if (!boardData.debug) {
          boardData.debug = {}
        }
        boardData.debug.layerError = e instanceof Error ? e.message : String(e)
      }

      // Дополнительная проверка перед возвратом
      if (!boardData.components) {
        console.warn("Warning: boardData.components is undefined, setting to empty array")
        boardData.components = []
      }

      console.log("Парсинг ODB++ файла завершен успешно, найдено компонентов:", boardData.components.length)
      if (boardData.components.length > 0) {
        console.log("Примеры компонентов:", boardData.components.slice(0, 3))
      }

      return boardData
    } catch (zipError) {
      console.error("Ошибка при распаковке архива:", zipError)
      // Возвращаем пустую плату с информацией об ошибке
      return {
        name: file.name.split(".")[0].replace(/_/g, " ") + " PCB",
        width: 300,
        height: 200,
        components: [], // Пустой массив компонентов
        debug: {
          error: `Ошибка при распаковке архива: ${zipError instanceof Error ? zipError.message : "Unknown error"}`,
          stack: zipError instanceof Error ? zipError.stack : undefined,
          fileSize: file.size,
          fileType: file.type,
        },
      }
    }
  } catch (error) {
    console.error("Ошибка при парсинге ODB++ файла:", error)

    // Если произошла ошибка, возвращаем пустую плату с информацией об ошибке
    const boardData: BoardData = {
      name: file.name.split(".")[0].replace(/_/g, " ") + " PCB",
      width: 300,
      height: 200,
      components: [], // Гарантируем, что components всегда является массивом
      debug: {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        fileSize: file.size,
        fileType: file.type,
      },
    }

    return boardData
  }
}

/**
 * Ищет компоненты в указанных путях
 */
async function findComponentsInSpecificPaths(zip: JSZip): Promise<Component[]> {
  let componentsData: Component[] = []

  // Пути, где могут находиться компоненты
  const specificPaths = [
    "steps/pcb/layers/comp_+_top",
    "steps/pcb/layers/comp_+_bot",
    "steps/pcb/layers/comp+top",
    "steps/pcb/layers/comp+bot",
    "steps/pcb/layers/comp_top",
    "steps/pcb/layers/comp_bot",
  ]

  // Проверяем каждый путь
  for (const path of specificPaths) {
    const file = findFile(zip, path)
    if (file) {
      console.log(`Найден файл с компонентами по пути: ${file}`)
      const content = await zip.files[file].async("string")
      const parsedComponents = parseSpecificComponentFormat(content, file.includes("bot") ? "BOT" : "TOP")
      if (parsedComponents.length > 0) {
        componentsData = [...componentsData, ...parsedComponents]
      }
    }
  }

  return componentsData
}

function findFile(zip: JSZip, path: string): string | null {
  const files = Object.keys(zip.files)
  const foundFile = files.find((file) => file.includes(path))
  return foundFile || null
}

/**
 * Ищет компоненты в стандартной структуре ODB++
 */
async function findComponentsInStandardStructure(zip: JSZip): Promise<Component[]> {
  // Ищем директорию с данными о компонентах
  // В ODB++ обычно есть директория "steps", которая содержит информацию о шагах сборки

  // Определяем возможные пути к директории steps
  const possibleStepsPaths = ["steps", "odb/steps", "data/steps"]

  // Пробуем найти директорию steps по всем возможным путям
  let stepsDir = null
  for (const path of possibleStepsPaths) {
    stepsDir = findDirectory(zip, path, true)
    if (stepsDir) {
      console.log(`Найдена директория steps по пути: ${stepsDir}`)
      break
    }
  }

  // Если директория steps не найдена, пробуем найти директорию comp_+_top, которая может содержать компоненты
  if (!stepsDir) {
    console.log("Директория 'steps' не найдена, ищем директорию с компонентами напрямую")

    const allDirectories = Object.keys(zip.files).filter((filename) => zip.files[filename].dir)
    const compDir = allDirectories.find(
      (dir) => dir.includes("comp_+_top") || dir.includes("comp+top") || dir.includes("components"),
    )

    if (compDir) {
      console.log(`Найдена директория с компонентами: ${compDir}`)
      // Проверяем наличие файла components в этой директории
      const componentsFile = findFile(zip, `${compDir}/components`)
      if (componentsFile) {
        console.log(`Найден файл с компонентами: ${componentsFile}`)
        const content = await zip.files[componentsFile].async("string")
        const parsedComponents = parseSpecificComponentFormat(content, "TOP")
        return parsedComponents
      }
    }

    // Если не нашли директорию с компонентами, пробуем искать во всем архиве
    return findComponentsInEntireArchive(zip)
  }

  // Остальной код функции остается без изменений...

  // Ищем первую директорию внутри steps (обычно это имя шага, например "pcb")
  const stepDirs = getSubdirectories(zip, stepsDir)

  if (stepDirs.length === 0) {
    throw new Error("Не найдены шаги внутри директории 'steps'")
  }

  const stepDir = stepDirs[0]
  console.log("Найден шаг сборки:", stepDir)

  // Ищем директорию с данными о компонентах
  // В ODB++ данные о компонентах обычно находятся в директории "components"
  const componentsDir = findDirectory(zip, `${stepDir}/components`)

  if (!componentsDir) {
    throw new Error(`Директория 'components' не найдена в шаге ${stepDir}`)
  }

  console.log("Найдена директория с компонентами:", componentsDir)

  // Ищем файл с данными о компонентах
  // В ODB++ данные о компонентах обычно хранятся в файле "components.json" или "components.xml"
  let componentsData: Component[] = []

  // Сначала проверяем наличие JSON файла (не стандартный формат, но может быть)
  const componentsJsonFile = findFile(zip, `${componentsDir}/components.json`)

  if (componentsJsonFile) {
    console.log("Найден JSON файл с компонентами")
    const jsonContent = await zip.files[componentsJsonFile].async("string")
    try {
      componentsData = JSON.parse(jsonContent)
      console.log("Компоненты успешно загружены из JSON:", componentsData.length)
    } catch (e) {
      console.error("Ошибка парсинга JSON файла с компонентами:", e)
    }
  } else {
    // Если JSON файла нет, ищем XML файлы
    console.log("JSON файл не найден, ищем XML файлы")

    // В ODB++ данные о компонентах могут быть в разных файлах
    // Обычно это файл "components.xml" или несколько файлов с расширением .xml
    const xmlFiles = findXmlFiles(zip, componentsDir)

    if (xmlFiles.length === 0) {
      console.warn("Не найдены XML файлы с данными о компонентах")
    } else {
      console.log("Найдены XML файлы:", xmlFiles)

      // Парсим каждый XML файл и собираем данные о компонентах
      for (const xmlFile of xmlFiles) {
        const xmlContent = await zip.files[xmlFile].async("string")
        const parsedComponents = parseComponentsXml(xmlContent)
        componentsData = [...componentsData, ...parsedComponents]
      }

      console.log("Компоненты успешно загружены из XML:", componentsData.length)
    }
  }

  return componentsData
}

function findXmlFiles(zip: JSZip, directory: string): string[] {
  const normalizedDir = directory.endsWith("/") ? directory : directory + "/"
  return Object.keys(zip.files).filter(
    (filename) => filename.startsWith(normalizedDir) && filename.endsWith(".xml") && !zip.files[filename].dir,
  )
}

// Заменим функцию getSubdirectories на более надежную версию
/**
 * Ищет директорию в архиве по пути
 * @param zip JSZip объект
 * @param path Путь к директории
 * @param caseInsensitive Если true, поиск будет регистронезависимым
 */
function findDirectory(zip: JSZip, path: string, caseInsensitive = false): string | null {
  // Нормализуем путь поиска
  const normalizedSearchPath = path.replace(/\\/g, "/")
  const searchPathWithSlash = normalizedSearchPath.endsWith("/") ? normalizedSearchPath : normalizedSearchPath + "/"

  console.log(`Ищем директорию: ${searchPathWithSlash}`)

  // Получаем список всех файлов и директорий в архиве
  const allPaths = Object.keys(zip.files)

  // Выводим первые 10 путей для отладки
  console.log("Первые 10 путей в архиве:", allPaths.slice(0, 10))

  // Создаем список всех файлов и директорий в архиве
  // Директория определяется как путь, который является префиксом для других путей
  const directories = new Set<string>()

  // Сначала добавляем все пути, которые явно помечены как директории
  allPaths.forEach((path) => {
    if (zip.files[path].dir || path.endsWith("/")) {
      directories.add(path)
    }
  })

  // Затем добавляем все родительские директории для всех путей
  allPaths.forEach((path) => {
    const parts = path.split("/")
    let currentPath = ""

    // Для каждой части пути создаем промежуточную директорию
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += parts[i] + "/"
      directories.add(currentPath)
    }
  })

  const directoriesArray = Array.from(directories)
  console.log(`Найдено директорий в архиве: ${directoriesArray.length}`)
  console.log("Первые 10 директорий:", directoriesArray.slice(0, 10))

  // 1. Сначала ищем точное совпадение
  const exactMatch = directoriesArray.find((dir) =>
    caseInsensitive ? dir.toLowerCase() === searchPathWithSlash.toLowerCase() : dir === searchPathWithSlash,
  )
  if (exactMatch) {
    console.log(`Найдена директория (точное совпадение): ${exactMatch}`)
    return exactMatch
  }

  if (caseInsensitive) {
    // 2. Ищем директорию, которая заканчивается на искомый путь
    // Например, если ищем "steps/", найдем "odb/steps/"
    const endsWith = directoriesArray.find((dir) => dir.toLowerCase().endsWith(searchPathWithSlash.toLowerCase()))
    if (endsWith) {
      console.log(`Найдена директория (совпадение по окончанию): ${endsWith}`)
      return endsWith
    }

    // 3. Ищем директорию, которая содержит искомый путь
    const contains = directoriesArray.find((dir) => {
      const lowerDir = dir.toLowerCase()
      const lowerSearch = searchPathWithSlash.toLowerCase()
      return lowerDir.includes(lowerSearch)
    })
    if (contains) {
      console.log(`Найдена директория (содержит искомый путь): ${contains}`)
      return contains
    }

    // 4. Ищем директорию по последней части пути
    const lastPart = normalizedSearchPath.split("/").filter(Boolean).pop()
    if (lastPart) {
      const lastPartMatch = directoriesArray.find((dir) => {
        const dirParts = dir.split("/").filter(Boolean)
        return dirParts.some((part) => part.toLowerCase() === lastPart.toLowerCase())
      })
      if (lastPartMatch) {
        console.log(`Найдена директория (по последней части пути "${lastPart}"): ${lastPartMatch}`)
        return lastPartMatch
      }
    }
  }

  console.log(`Директория не найдена: ${searchPathWithSlash}`)
  return null
}

/**
 * Получает список поддиректорий в указанной директории
 */
function getSubdirectories(zip: JSZip, directory: string): string[] {
  const normalizedDir = directory.endsWith("/") ? directory : directory + "/"
  console.log(`Ищем поддиректории в директории ${normalizedDir}`)

  // Создаем множество для хранения уникальных поддиректорий
  const subdirs = new Set<string>()

  // Получаем все пути в архиве
  const allPaths = Object.keys(zip.files)

  // Выводим все пути, начинающиеся с указанной директории для отладки
  const relevantPaths = allPaths.filter((path) => path.startsWith(normalizedDir) && path !== normalizedDir)
  console.log(`Пути, начинающиеся с ${normalizedDir}:`, relevantPaths.slice(0, 10))

  // Для каждого пути, начинающегося с указанной директории
  for (const path of relevantPaths) {
    // Получаем относительный путь
    const relativePath = path.substring(normalizedDir.length)
    // Разбиваем относительный путь на части
    const parts = relativePath.split("/")

    // Если есть хотя бы одна часть, добавляем первую часть как поддиректорию
    if (parts.length > 0 && parts[0]) {
      subdirs.add(normalizedDir + parts[0] + "/")
    }
  }

  const result = Array.from(subdirs)
  console.log(`Найдено поддиректорий: ${result.length}`)
  console.log(`Поддиректории:`, result)
  return result
}

/**
 * Ищет компоненты во всем архиве
 */
async function findComponentsInEntireArchive(zip: JSZip): Promise<Component[]> {
  let componentsData: Component[] = []

  // Ищем все XML файлы в архиве
  const allXmlFiles = Object.keys(zip.files).filter((filename) => filename.endsWith(".xml") && !zip.files[filename].dir)

  console.log("Найдены все XML файлы в архиве:", allXmlFiles)

  // Парсим каждый XML файл и ищем данные о компонентах
  for (const xmlFile of allXmlFiles) {
    try {
      const xmlContent = await zip.files[xmlFile].async("string")

      // Проверяем, содержит ли файл данные о компонентах
      if (
        xmlContent.includes("<component") ||
        xmlContent.includes("<components") ||
        xmlContent.includes("<part") ||
        xmlContent.includes("<parts")
      ) {
        console.log("Найден файл с данными о компонентах:", xmlFile)
        const parsedComponents = parseComponentsXml(xmlContent)
        componentsData = [...componentsData, ...parsedComponents]
      }
    } catch (e) {
      console.warn(`Ошибка при парсинге XML файла ${xmlFile}:`, e)
    }
  }

  return componentsData
}

function parseComponentsXml(xmlContent: string): Component[] {
  const components: Component[] = []
  // Здесь должна быть логика парсинга XML и извлечения данных о компонентах
  // В зависимости от структуры XML, это может быть довольно сложная задача
  // В данном примере просто возвращаем пустой массив
  return components
}

/**
 * Ищет компоненты в текстовых файлах
 */
async function findComponentsInTextFiles(zip: JSZip): Promise<Component[]> {
  let componentsData: Component[] = []

  // Ищем все текстовые файлы в архиве
  const textFiles = Object.keys(zip.files).filter(
    (filename) =>
      (filename.endsWith(".txt") ||
        filename.endsWith(".dat") ||
        filename.endsWith(".lst") ||
        filename.endsWith(".csv") ||
        filename.endsWith(".pos")) &&
      !zip.files[filename].dir,
  )

  console.log("Найдены текстовые файлы:", textFiles)

  // Парсим каждый текстовый файл и ищем данные о компонентах
  for (const textFile of textFiles) {
    try {
      const textContent = await zip.files[textFile].async("string")

      // Проверяем, содержит ли файл данные о компонентах
      if (
        textContent.includes("component") ||
        textContent.includes("COMPONENT") ||
        textContent.includes("part") ||
        textContent.includes("PART") ||
        textContent.includes("designator") ||
        textContent.includes("DESIGNATOR") ||
        textContent.includes("refdes") ||
        textContent.includes("REFDES") ||
        textContent.includes("footprint") ||
        textContent.includes("FOOTPRINT") ||
        textContent.includes("CMP ") // Проверяем наличие строк CMP, характерных для специфического формата
      ) {
        console.log("Найден текстовый файл с данными о компонентах:", textFile)

        // Проверяем, содержит ли файл строки CMP, характерные для специфического формата
        if (textContent.includes("CMP ")) {
          const side = textFile.toLowerCase().includes("bot") ? "BOT" : "TOP"
          const parsedComponents = parseSpecificComponentFormat(textContent, side)
          if (parsedComponents.length > 0) {
            componentsData = [...componentsData, ...parsedComponents]
            continue
          }
        }

        // Определяем формат файла
        const isCSV = textContent.includes(",") || textContent.includes(";") || textContent.includes("\t")
        const isPOS =
          textFile.endsWith(".pos") ||
          (textContent.includes("X") && textContent.includes("Y") && textContent.includes("Rot"))

        let parsedComponents: Component[] = []

        if (isCSV) {
          parsedComponents = parseCSVFile(textContent, textFile)
        } else if (isPOS) {
          parsedComponents = parsePOSFile(textContent, textFile)
        } else {
          parsedComponents = parseGenericTextFile(textContent, textFile)
        }

        if (parsedComponents.length > 0) {
          componentsData = [...componentsData, ...parsedComponents]
        }
      }
    } catch (e) {
      console.warn(`Ошибка при парсинге текстового файла ${textFile}:`, e)
    }
  }

  return componentsData
}

/**
 * Парсит CSV файл
 */
function parseCSVFile(content: string, filename: string): Component[] {
  const components: Component[] = []

  try {
    // Разбиваем текст на строки
    const lines = content.split(/\r?\n/)

    // Определяем разделитель
    let delimiter = ","
    if (content.includes(";")) delimiter = ";"
    else if (content.includes("\t")) delimiter = "\t"

    // Ищем заголовок
    let headerLine = -1
    let nameIndex = -1
    let packageIndex = -1
    let xIndex = -1
    let yIndex = -1
    let sideIndex = -1
    let rotationIndex = -1

    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith("#") || line.startsWith("//")) continue

      const headers = line.split(delimiter).map((h) => h.trim().toLowerCase())

      // Ищем индексы нужных столбцов
      nameIndex = headers.findIndex(
        (h) =>
          h.includes("name") ||
          h.includes("designator") ||
          h.includes("reference") ||
          h.includes("refdes") ||
          h.includes("part") ||
          h === "ref",
      )

      packageIndex = headers.findIndex(
        (h) =>
          h.includes("package") || h.includes("footprint") || h.includes("pattern") || h === "val" || h === "value",
      )

      xIndex = headers.findIndex((h) => h === "x" || h.includes("pos_x") || h.includes("position_x") || h === "mid_x")

      yIndex = headers.findIndex((h) => h === "y" || h.includes("pos_y") || h.includes("position_y") || h === "mid_y")

      sideIndex = headers.findIndex(
        (h) => h.includes("side") || h.includes("layer") || h === "top" || h === "bot" || h === "tb",
      )

      rotationIndex = headers.findIndex((h) => h.includes("rot") || h.includes("angle") || h.includes("orientation"))

      if (nameIndex !== -1) {
        headerLine = i
        break
      }
    }

    // Если нашли заголовок, парсим данные
    if (headerLine !== -1) {
      for (let i = headerLine + 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line || line.startsWith("#") || line.startsWith("//")) continue

        const fields = line.split(delimiter).map((f) => f.trim())

        // Проверяем, что строка содержит достаточно полей
        if (fields.length <= Math.max(nameIndex, packageIndex, xIndex, yIndex, sideIndex, rotationIndex)) continue

        // Извлекаем данные
        const name = nameIndex !== -1 ? fields[nameIndex] : `Component-${components.length + 1}`
        const packageType = packageIndex !== -1 ? fields[packageIndex] : "Unknown"

        // Координаты могут быть в разных форматах, пробуем их нормализовать
        let x = 0.5
        let y = 0.5

        if (xIndex !== -1) {
          const xValue = fields[xIndex].replace(/[^\d.-]/g, "")
          x = Number.parseFloat(xValue) / 1000
        }

        if (yIndex !== -1) {
          const yValue = fields[yIndex].replace(/[^\d.-]/g, "")
          y = Number.parseFloat(yValue) / 1000
        }

        // Определяем сторону монтажа
        let side: "TOP" | "BOT" = "TOP"
        if (sideIndex !== -1) {
          const sideValue = fields[sideIndex].toUpperCase()
          if (sideValue.includes("BOT") || sideValue.includes("BOTTOM") || sideValue === "B") {
            side = "BOT"
          }
        }

        // Создаем компонент
        const component: Component = {
          uid: `CSV-${filename.split("/").pop()?.split(".")[0] || "file"}-${components.length.toString().padStart(3, "0")}`,
          name,
          package: packageType,
          pins: determinePinsFromPackage(packageType, name),
          assembled: false,
          side,
          x,
          y,
        }

        // Добавляем размеры компонента
        setComponentDimensions(component)

        // Добавляем компонент в список
        components.push(component)
      }
    }
  } catch (e) {
    console.error("Ошибка при парсинге CSV файла:", e)
  }

  return components
}

/**
 * Парсит POS файл (формат размещения компонентов)
 */
function parsePOSFile(content: string, filename: string): Component[] {
  const components: Component[] = []

  try {
    // Разбиваем текст на строки
    const lines = content.split(/\r?\n/)

    // Ищем строки с данными о компонентах
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith("#") || line.startsWith("//")) continue

      // Проверяем, содержит ли строка данные о компоненте
      // Обычно POS файлы имеют формат: RefDes X Y Rotation Side Package
      const parts = line.split(/\s+/)

      if (parts.length >= 3) {
        // Пытаемся извлечь данные
        const name = parts[0]

        // Ищем координаты - обычно это числа с плавающей точкой
        let x = 0.5
        let y = 0.5
        let packageType = "Unknown"
        let side: "TOP" | "BOT" = "TOP"

        // Ищем числа, которые могут быть координатами
        const numberIndices = parts
          .map((part, index) => {
            const num = Number.parseFloat(part.replace(/[^\d.-]/g, ""))
            return isNaN(num) ? -1 : index
          })
          .filter((index) => index !== -1)

        if (numberIndices.length >= 2) {
          x = Number.parseFloat(parts[numberIndices[0]].replace(/[^\d.-]/g, "")) / 1000
          y = Number.parseFloat(parts[numberIndices[1]].replace(/[^\d.-]/g, "")) / 1000
        }

        // Ищем сторону монтажа
        const sideIndex = parts.findIndex(
          (part) =>
            part.toUpperCase() === "TOP" ||
            part.toUpperCase() === "BOTTOM" ||
            part.toUpperCase() === "BOT" ||
            part.toUpperCase() === "T" ||
            part.toUpperCase() === "B",
        )

        if (sideIndex !== -1) {
          const sideValue = parts[sideIndex].toUpperCase()
          if (sideValue.includes("BOT") || sideValue === "B") {
            side = "BOT"
          }
        }

        // Ищем тип корпуса - обычно это последнее поле или поле после координат
        if (parts.length > Math.max(...numberIndices) + 1) {
          packageType = parts[Math.max(...numberIndices) + 1]
        } else if (parts.length > 1) {
          // Если не нашли после координат, берем последнее поле
          packageType = parts[parts.length - 1]
        }

        // Создаем компонент
        const component: Component = {
          uid: `POS-${filename.split("/").pop()?.split(".")[0] || "file"}-${components.length.toString().padStart(3, "0")}`,
          name,
          package: packageType,
          pins: determinePinsFromPackage(packageType, name),
          assembled: false,
          side,
          x,
          y,
        }

        // Добавляем размеры компонента
        setComponentDimensions(component)

        // Добавляем компонент в список
        components.push(component)
      }
    }
  } catch (e) {
    console.error("Ошибка при парсинге POS файла:", e)
  }

  return components
}

/**
 * Парсит текстовый файл общего формата
 */
function parseGenericTextFile(content: string, filename: string): Component[] {
  const components: Component[] = []

  try {
    // Разбиваем текст на строки
    const lines = content.split(/\r?\n/)

    // Ищем строки с данными о компонентах
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith("#") || line.startsWith("//")) continue

      // Проверяем, содержит ли строка данные о компоненте
      if (
        line.includes("component") ||
        line.includes("COMPONENT") ||
        line.includes("part") ||
        line.includes("PART") ||
        line.match(/[A-Z][0-9]+/)
      ) {
        // Пытаемся извлечь данные о компоненте
        const nameMatch = line.match(/name\s*[=:]\s*["']?([^"',\s]+)["']?/i) || line.match(/([A-Z][0-9]+)/i)
        const packageMatch =
          line.match(/package\s*[=:]\s*["']?([^"',\s]+)["']?/i) ||
          line.match(/footprint\s*[=:]\s*["']?([^"',\s]+)["']?/i)
        const xMatch = line.match(/x\s*[=:]\s*([-+]?[0-9]*\.?[0-9]+)/i)
        const yMatch = line.match(/y\s*[=:]\s*([-+]?[0-9]*\.?[0-9]+)/i)
        const sideMatch =
          line.match(/side\s*[=:]\s*["']?([^"',\s]+)["']?/i) || line.match(/layer\s*[=:]\s*["']?([^"',\s]+)["']?/i)

        // Если нашли хотя бы имя компонента, создаем его
        if (nameMatch) {
          // Создаем компонент
          const component: Component = {
            uid: `T-${components.length.toString().padStart(3, "0")}`,
            name: nameMatch[1],
            package: packageMatch ? packageMatch[1] : "Unknown",
            pins: 2, // По умолчанию
            assembled: false, // По умолчанию не собран
            side: (sideMatch ? sideMatch[1].toUpperCase() : "TOP") as "TOP" | "BOT",
          }

          // Добавляем координаты, если они есть
          if (xMatch && yMatch) {
            // Нормализуем координаты к диапазону [0, 1]
            component.x = Number.parseFloat(xMatch[1]) / 1000
            component.y = Number.parseFloat(yMatch[1]) / 1000
          } else {
            // Если координат нет, генерируем случайные
            component.x = 0.1 + Math.random() * 0.8
            component.y = 0.1 + Math.random() * 0.8
          }

          // Добавляем размеры компонента на основе типа корпуса
          setComponentDimensions(component)

          // Добавляем компонент в список
          components.push(component)
        }
      }
    }
  } catch (e) {
    console.error("Ошибка при парсинге текстового файла:", e)
  }

  return components
}

/**
 * Определяет количество пинов компонента на основе типа корпуса
 */
function determinePinsFromPackage(packageType: string, name: string): number {
  const packageUpper = packageType.toUpperCase()

  // Определяем количество выводов на основе типа корпуса
  if (packageUpper.includes("SOIC")) {
    const match = packageUpper.match(/SOIC-(\d+)/)
    return match ? Number.parseInt(match[1]) : 8
  } else if (packageUpper.includes("QFP")) {
    const match = packageUpper.match(/QFP-(\d+)/)
    return match ? Number.parseInt(match[1]) : 32
  } else if (packageUpper.includes("BGA")) {
    const match = packageUpper.match(/BGA-(\d+)/)
    return match ? Number.parseInt(match[1]) : 256
  } else if (
    packageUpper.includes("0402") ||
    packageUpper.includes("0603") ||
    packageUpper.includes("0805") ||
    packageUpper.includes("1206")
  ) {
    return 2
  } else if (packageUpper.includes("SOT23")) {
    return 3
  } else if (packageUpper.includes("SOT")) {
    return 3
  } else if (packageUpper.includes("HEADER")) {
    const match = packageUpper.match(/HEADER-(\d+)X(\d+)/)
    if (match) {
      return Number.parseInt(match[1]) * Number.parseInt(match[2])
    }
  }

  // Определяем по имени компонента
  const nameUpper = name.toUpperCase()
  if (nameUpper.startsWith("R") || nameUpper.startsWith("C") || nameUpper.startsWith("L")) {
    return 2
  } else if (nameUpper.startsWith("Q") || nameUpper.startsWith("T")) {
    return 3
  } else if (nameUpper.startsWith("U") || nameUpper.startsWith("IC")) {
    return 8
  }

  // По умолчанию
  return 2
}

/**
 * Устанавливает размеры компонента на основе типа корпуса
 */
function setComponentDimensions(component: Component): void {
  // Определяем размеры компонента на основе типа корпуса
  const packageType = component.package.toUpperCase()

  // Определяем количество выводов
  if (packageType.includes("SOIC")) {
    const match = packageType.match(/SOIC-(\d+)/)
    component.pins = match ? Number.parseInt(match[1]) : 8
    component.width = 20 + component.pins / 2
    component.height = 10
  } else if (packageType.includes("QFP")) {
    const match = packageType.match(/QFP-(\d+)/)
    component.pins = match ? Number.parseInt(match[1]) : 32
    component.width = 20 + component.pins / 8
    component.height = 20 + component.pins / 8
  } else if (packageType.includes("BGA")) {
    const match = packageType.match(/BGA-(\d+)/)
    component.pins = match ? Number.parseInt(match[1]) : 256
    component.width = 40
    component.height = 40
  } else if (packageType.includes("0402")) {
    component.pins = 2
    component.width = 8
    component.height = 4
  } else if (packageType.includes("0603")) {
    component.pins = 2
    component.width = 10
    component.height = 5
  } else if (packageType.includes("0805")) {
    component.pins = 2
    component.width = 12
    component.height = 6
  } else if (packageType.includes("1206")) {
    component.pins = 2
    component.width = 15
    component.height = 7
  } else if (packageType.includes("SOT23")) {
    component.pins = 3
    component.width = 12
    component.height = 8
  } else if (packageType.includes("SOT")) {
    component.pins = 3
    component.width = 12
    component.height = 8
  } else if (packageType.includes("HEADER")) {
    const match = packageType.match(/HEADER-(\d+)X(\d+)/)
    if (match) {
      component.pins = Number.parseInt(match[1]) * Number.parseInt(match[2])
      component.width = Number.parseInt(match[1]) * 5
      component.height = Number.parseInt(match[2]) * 5
    } else {
      component.pins = 2
      component.width = 15
      component.height = 10
    }
  } else {
    // Для неизвестных типов корпусов
    component.pins = 2
    component.width = 15
    component.height = 8
  }

  // Если компонент начинается с определенной буквы, устанавливаем количество выводов
  if (component.name.startsWith("R") || component.name.startsWith("C") || component.name.startsWith("L")) {
    component.pins = 2
  } else if (component.name.startsWith("Q") || component.name.startsWith("T")) {
    component.pins = 3
  } else if (component.name.startsWith("U") || component.name.startsWith("IC")) {
    if (component.pins < 4) {
      component.pins = 8
    }
  }
}
