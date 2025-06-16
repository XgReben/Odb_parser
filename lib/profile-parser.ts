import type { BoardProfile, Point, Polygon } from "./types"
import type JSZip from "jszip"

/**
 * Парсит контур платы из ODB++ файла
 * @param zip Распакованный архив ODB++
 * @returns Контур платы
 */
export async function parseProfileFromODB(zip: JSZip): Promise<BoardProfile | null> {
  try {
    console.log("Начинаем парсинг контура платы...")

    // Ищем файл profile в директории odb/steps/pcb или steps/pcb
    const profileFile = findProfileFile(zip)
    if (!profileFile) {
      console.warn("Файл profile не найден")

      // Выводим список всех файлов для отладки
      console.log("Список всех файлов в архиве:")
      Object.keys(zip.files).forEach((file) => {
        console.log(`- ${file} (${zip.files[file].dir ? "директория" : "файл"})`)
      })

      return null
    }

    console.log("Найден файл profile:", profileFile)

    // Читаем содержимое файла
    const content = await zip.files[profileFile].async("string")
    console.log(`Содержимое файла profile (первые 200 символов): ${content.substring(0, 200)}...`)

    // Выводим первые 10 строк для анализа формата
    const lines = content.split(/\r?\n/).slice(0, 10)
    console.log("Первые 10 строк файла profile:")
    lines.forEach((line, index) => {
      console.log(`${index}: ${line}`)
    })

    // Создаем контур
    const profile: BoardProfile = {
      outline: [],
      width: 0,
      height: 0,
      minX: Number.MAX_VALUE,
      minY: Number.MAX_VALUE,
      maxX: Number.MIN_VALUE,
      maxY: Number.MIN_VALUE,
    }

    // Парсим файл profile
    parseODBProfile(content, profile)

    // Если не нашли контур, создаем стандартный
    if (profile.outline.length === 0) {
      console.log("Контур платы не найден в файле profile, создаем стандартный")
      createDefaultProfile(profile)
    }

    // Вычисляем размеры платы
    calculateProfileDimensions(profile)

    console.log("Парсинг контура платы завершен:")
    console.log(`- Размеры: ${profile.width}x${profile.height}`)
    console.log(`- Границы: (${profile.minX}, ${profile.minY}) - (${profile.maxX}, ${profile.maxY})`)
    console.log(`- Количество полигонов: ${profile.outline.length}`)

    if (profile.outline.length > 0) {
      profile.outline.forEach((polygon, index) => {
        console.log(`- Полигон ${index}: ${polygon.points.length} точек`)
        if (polygon.points.length > 0) {
          console.log(`  Первые 3 точки: ${JSON.stringify(polygon.points.slice(0, 3))}`)
        }
      })
    }

    return profile
  } catch (error) {
    console.error("Ошибка при парсинге контура платы:", error)
    return null
  }
}

/**
 * Ищет файл profile в директории odb/steps/pcb или steps/pcb
 */
function findProfileFile(zip: JSZip): string | null {
  // Приоритетные пути к файлу profile
  const profilePaths = [
    "odb/steps/pcb/profile",
    "steps/pcb/profile",
    "data/steps/pcb/profile",
    "odb/steps/pcb/Profile",
    "steps/pcb/Profile",
    "data/steps/pcb/Profile",
    // Добавляем пути к директориям profile
    "odb/steps/pcb/profile/",
    "steps/pcb/profile/",
    "data/steps/pcb/profile/",
  ]

  // Проверяем каждый путь напрямую
  for (const path of profilePaths) {
    if (path in zip.files) {
      if (!zip.files[path].dir) {
        console.log(`Найден файл profile по точному пути: ${path}`)
        return path
      } else {
        console.log(`Найдена директория profile по точному пути: ${path}`)
        // Если это директория, ищем файлы внутри
        const filesInDir = Object.keys(zip.files).filter(
          (file) => file.startsWith(path) && !zip.files[file].dir && file !== path,
        )

        if (filesInDir.length > 0) {
          console.log(`Найдены файлы в директории ${path}:`, filesInDir)
          // Ищем файл features
          const featuresFile = filesInDir.find(
            (file) =>
              file.endsWith("features") ||
              file.endsWith("feat") ||
              file.includes("features") ||
              file.includes("outline"),
          )

          if (featuresFile) {
            console.log(`Найден файл features: ${featuresFile}`)
            return featuresFile
          }

          // Если features не найден, берем первый файл
          console.log(`Файл features не найден, используем первый файл: ${filesInDir[0]}`)
          return filesInDir[0]
        }
      }
    }
  }

  // Если точного совпадения нет, ищем файл profile в директориях pcb
  const pcbDirs = ["odb/steps/pcb/", "steps/pcb/", "data/steps/pcb/", "odb/steps/", "steps/", "data/steps/"]

  for (const pcbDir of pcbDirs) {
    // Ищем все файлы в директории pcb
    const filesInDir = Object.keys(zip.files).filter((file) => file.startsWith(pcbDir) && !zip.files[file].dir)

    console.log(`Файлы в директории ${pcbDir}:`, filesInDir)

    // Ищем файл profile или features
    for (const file of filesInDir) {
      const baseName = file.split("/").pop()?.toLowerCase() || ""
      if (
        baseName === "profile" ||
        baseName.startsWith("profile.") ||
        baseName === "features" ||
        baseName.startsWith("features.") ||
        baseName.includes("outline")
      ) {
        console.log(`Найден файл контура в директории pcb: ${file}`)
        return file
      }
    }
  }

  // Если не нашли, ищем любой файл с "profile" или "features" в имени
  for (const filename in zip.files) {
    if (!zip.files[filename].dir) {
      const baseName = filename.split("/").pop()?.toLowerCase() || ""
      if (
        baseName === "profile" ||
        baseName.startsWith("profile.") ||
        baseName === "features" ||
        baseName.startsWith("features.") ||
        baseName.includes("outline")
      ) {
        console.log(`Найден файл контура: ${filename}`)
        return filename
      }
    }
  }

  console.warn("Файл контура не найден")
  return null
}

// Улучшаем функцию parseODBProfile для более точного парсинга файла profile
function parseODBProfile(content: string, profile: BoardProfile): void {
  try {
    console.log("Парсинг ODB profile файла...")

    const lines = content.split(/\r?\n/)
    console.log(`Найдено ${lines.length} строк в файле profile`)

    // Словарь для хранения определений символов
    const symbolDefinitions: Record<string, number> = {}

    // Текущий полигон (для многострочных определений)
    let currentPolygon: Point[] | null = null

    // Проходим по всем строкам файла
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (!line || line.startsWith("#") || line.startsWith("//")) {
        continue
      }

      // Выводим первые 10 непустых строк для отладки
      if (i < 10) {
        console.log(`Строка ${i}: ${line}`)
      }

      // Парсим определения символов (например, $37=r149.9997)
      if (line.includes("=")) {
        const parts = line.split("=")
        if (parts.length === 2 && parts[0].startsWith("$")) {
          const symbolId = parts[0].substring(1)
          let value = 0

          // Извлекаем значение
          if (parts[1].startsWith("r")) {
            // Радиус
            value = Number.parseFloat(parts[1].substring(1))
          } else if (parts[1].startsWith("w")) {
            // Ширина
            value = Number.parseFloat(parts[1].substring(1))
          } else {
            // Другие значения
            value = Number.parseFloat(parts[1])
          }

          symbolDefinitions[symbolId] = value
          continue
        }
      }

      // Парсим полигоны (P x1 y1 x2 y2 ... xn yn)
      if (line.startsWith("P ") || line.startsWith("OB ")) {
        console.log(`Найден полигон: ${line}`)

        // Начинаем новый полигон
        currentPolygon = []

        const parts = line.split(/\s+/)
        for (let j = 1; j < parts.length; j += 2) {
          if (j + 1 < parts.length) {
            const x = Number.parseFloat(parts[j])
            const y = Number.parseFloat(parts[j + 1])
            if (!isNaN(x) && !isNaN(y)) {
              currentPolygon.push({ x, y })

              // Обновляем границы
              profile.minX = Math.min(profile.minX, x)
              profile.minY = Math.min(profile.minY, y)
              profile.maxX = Math.max(profile.maxX, x)
              profile.maxY = Math.max(profile.maxY, y)
            }
          }
        }

        // Если строка заканчивается точкой с запятой, завершаем полигон
        if (line.endsWith(";")) {
          if (currentPolygon.length >= 3) {
            profile.outline.push({ points: currentPolygon })
            console.log(`Добавлен полигон с ${currentPolygon.length} точками`)
          }
          currentPolygon = null
        }

        continue
      }

      // Продолжение полигона
      if (currentPolygon !== null) {
        const parts = line.split(/\s+/)
        for (let j = 0; j < parts.length; j += 2) {
          if (j + 1 < parts.length) {
            const x = Number.parseFloat(parts[j])
            const y = Number.parseFloat(parts[j + 1])
            if (!isNaN(x) && !isNaN(y)) {
              currentPolygon.push({ x, y })

              // Обновляем границы
              profile.minX = Math.min(profile.minX, x)
              profile.minY = Math.min(profile.minY, y)
              profile.maxX = Math.max(profile.maxX, x)
              profile.maxY = Math.max(profile.maxY, y)
            }
          }
        }

        // Если строка заканчивается точкой с запятой, завершаем полигон
        if (line.endsWith(";")) {
          if (currentPolygon.length >= 3) {
            profile.outline.push({ points: currentPolygon })
            console.log(`Добавлен полигон с ${currentPolygon.length} точками`)
          }
          currentPolygon = null
        }

        continue
      }

      // Если не нашли полигоны, ищем линии (L x1 y1 x2 y2 width)
      if (line.startsWith("L ")) {
        console.log(`Найдена линия: ${line}`)

        const parts = line.split(/\s+/)
        if (parts.length >= 5) {
          const x1 = Number.parseFloat(parts[1])
          const y1 = Number.parseFloat(parts[2])
          const x2 = Number.parseFloat(parts[3])
          const y2 = Number.parseFloat(parts[4])

          // Сохраняем линию для последующего построения полигона
          const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
          lines.push({ x1, y1, x2, y2 })

          // Обновляем границы
          profile.minX = Math.min(profile.minX, x1, x2)
          profile.minY = Math.min(profile.minY, y1, y2)
          profile.maxX = Math.max(profile.maxX, x1, x2)
          profile.maxY = Math.max(profile.maxY, y1, y2)

          // Пытаемся построить полигон из линий
          const polygon = buildPolygonFromLines(lines)
          if (polygon && polygon.points.length >= 3) {
            profile.outline.push(polygon)
            console.log(`Добавлен полигон из линии с ${polygon.points.length} точками`)
          }
        }
      }

      // Проверяем другие форматы, которые могут содержать контур
      // Например, формат с координатами в скобках: (x1,y1) (x2,y2) ...
      const coordPairsMatch = line.match(/$$(-?\d+\.?\d*),(-?\d+\.?\d*)$$/g)
      if (coordPairsMatch && coordPairsMatch.length >= 3) {
        console.log(`Найдены координаты в формате (x,y): ${line}`)

        const points: Point[] = []
        for (const pair of coordPairsMatch) {
          const coords = pair.match(/$$(-?\d+\.?\d*),(-?\d+\.?\d*)$$/)
          if (coords) {
            const x = Number.parseFloat(coords[1])
            const y = Number.parseFloat(coords[2])
            points.push({ x, y })

            // Обновляем границы
            profile.minX = Math.min(profile.minX, x)
            profile.minY = Math.min(profile.minY, y)
            profile.maxX = Math.max(profile.maxX, x)
            profile.maxY = Math.max(profile.maxY, y)
          }
        }

        if (points.length >= 3) {
          profile.outline.push({ points })
          console.log(`Добавлен полигон из координат (x,y) с ${points.length} точками`)
        }
      }
    }

    // Завершаем текущий полигон, если он есть
    if (currentPolygon !== null && currentPolygon.length >= 3) {
      profile.outline.push({ points: currentPolygon })
      console.log(`Добавлен последний полигон с ${currentPolygon.length} точками`)
    }

    // Если не нашли полигоны, пробуем найти их в других форматах
    if (profile.outline.length === 0) {
      console.log("Полигоны не найдены, пробуем другие форматы...")

      // Пробуем найти координаты в формате "x y" по всему файлу
      const allCoords = content.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g)
      if (allCoords && allCoords.length >= 6) {
        // Минимум 3 точки (6 координат)
        console.log(`Найдены координаты в формате "x y": ${allCoords.length} пар`)

        const points: Point[] = []
        for (let i = 0; i < allCoords.length; i++) {
          const coords = allCoords[i].split(/\s+/)
          if (coords.length === 2) {
            const x = Number.parseFloat(coords[0])
            const y = Number.parseFloat(coords[1])
            points.push({ x, y })

            // Обновляем границы
            profile.minX = Math.min(profile.minX, x)
            profile.minY = Math.min(profile.minY, y)
            profile.maxX = Math.max(profile.maxX, x)
            profile.maxY = Math.max(profile.maxY, y)
          }
        }

        if (points.length >= 3) {
          profile.outline.push({ points })
          console.log(`Добавлен полигон из координат "x y" с ${points.length} точками`)
        }
      }
    }

    console.log(`Парсинг ODB profile завершен, найдено ${profile.outline.length} полигонов`)
  } catch (error) {
    console.error("Ошибка при парсинге ODB profile:", error)
  }
}

/**
 * Строит полигон из набора линий
 */
function buildPolygonFromLines(lines: { x1: number; y1: number; x2: number; y2: number }[]): Polygon | null {
  if (lines.length === 0) {
    return null
  }

  // Создаем копию массива линий
  const remainingLines = [...lines]

  // Начинаем с первой линии
  const firstLine = remainingLines.shift()!
  const points: Point[] = [
    { x: firstLine.x1, y: firstLine.y1 },
    { x: firstLine.x2, y: firstLine.y2 },
  ]

  // Пытаемся найти следующую линию
  let foundNext = true
  while (foundNext && remainingLines.length > 0) {
    foundNext = false

    // Последняя точка в текущем полигоне
    const lastPoint = points[points.length - 1]

    // Ищем линию, которая начинается с последней точки
    for (let i = 0; i < remainingLines.length; i++) {
      const line = remainingLines[i]

      // Проверяем, совпадает ли начало линии с последней точкой
      if (Math.abs(line.x1 - lastPoint.x) < 0.001 && Math.abs(line.y1 - lastPoint.y) < 0.001) {
        points.push({ x: line.x2, y: line.y2 })
        remainingLines.splice(i, 1)
        foundNext = true
        break
      }

      // Проверяем, совпадает ли конец линии с последней точкой
      if (Math.abs(line.x2 - lastPoint.x) < 0.001 && Math.abs(line.y2 - lastPoint.y) < 0.001) {
        points.push({ x: line.x1, y: line.y1 })
        remainingLines.splice(i, 1)
        foundNext = true
        break
      }
    }
  }

  // Проверяем, замкнут ли полигон
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  if (Math.abs(firstPoint.x - lastPoint.x) < 0.001 && Math.abs(firstPoint.y - lastPoint.y) < 0.001) {
    // Полигон замкнут, удаляем последнюю точку (дублирует первую)
    points.pop()
  }

  return { points }
}

/**
 * Создает стандартный контур платы
 */
function createDefaultProfile(profile: BoardProfile): void {
  // Создаем прямоугольный контур
  const points: Point[] = [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
    { x: 300, y: 200 },
    { x: 0, y: 200 },
  ]

  profile.outline.push({ points })

  // Устанавливаем границы
  profile.minX = 0
  profile.minY = 0
  profile.maxX = 300
  profile.maxY = 200
}

/**
 * Вычисляет размеры платы на основе контура
 */
function calculateProfileDimensions(profile: BoardProfile): void {
  if (
    profile.minX === Number.MAX_VALUE ||
    profile.minY === Number.MAX_VALUE ||
    profile.maxX === Number.MIN_VALUE ||
    profile.maxY === Number.MIN_VALUE
  ) {
    // Если границы не были обновлены, устанавливаем стандартные размеры
    profile.minX = 0
    profile.minY = 0
    profile.maxX = 300
    profile.maxY = 200
  }

  // Вычисляем размеры
  profile.width = profile.maxX - profile.minX
  profile.height = profile.maxY - profile.minY
}
