import type { Component } from "./types"
import type JSZip from "jszip"

/**
 * Улучшенная функция для поиска компонентов в текстовых файлах
 */
export async function findComponentsInTextFiles(zip: JSZip): Promise<Component[]> {
  let componentsData: Component[] = []
  const debugInfo: string[] = []

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

  debugInfo.push(`Найдено текстовых файлов: ${textFiles.length}`)
  console.log("Найдены текстовые файлы:", textFiles)

  // Парсим каждый текстовый файл и ищем данные о компонентах
  for (const textFile of textFiles) {
    try {
      const textContent = await zip.files[textFile].async("string")
      debugInfo.push(`Анализ файла: ${textFile}, размер: ${textContent.length} байт`)

      // Выводим первые 200 символов для отладки
      console.log(`Содержимое файла ${textFile} (первые 200 символов):`, textContent.substring(0, 200))

      // Проверяем, содержит ли файл данные о компонентах
      const containsComponentKeywords =
        textContent.includes("component") ||
        textContent.includes("COMPONENT") ||
        textContent.includes("part") ||
        textContent.includes("PART") ||
        textContent.includes("designator") ||
        textContent.includes("DESIGNATOR") ||
        textContent.includes("refdes") ||
        textContent.includes("REFDES") ||
        textContent.includes("footprint") ||
        textContent.includes("FOOTPRINT")

      debugInfo.push(`Файл ${textFile} содержит ключевые слова о компонентах: ${containsComponentKeywords}`)

      if (containsComponentKeywords) {
        console.log("Найден текстовый файл с данными о компонентах:", textFile)

        // Пробуем определить формат файла
        const isCSV = textContent.includes(",") || textContent.includes(";") || textContent.includes("\t")
        const isPOS =
          textFile.endsWith(".pos") ||
          (textContent.includes("X") && textContent.includes("Y") && textContent.includes("Rot"))

        debugInfo.push(`Формат файла ${textFile}: ${isCSV ? "CSV" : isPOS ? "POS" : "текстовый"}`)

        let parsedComponents: Component[] = []

        if (isCSV) {
          parsedComponents = parseCSVFile(textContent, textFile)
          debugInfo.push(`Из CSV файла ${textFile} извлечено компонентов: ${parsedComponents.length}`)
        } else if (isPOS) {
          parsedComponents = parsePOSFile(textContent, textFile)
          debugInfo.push(`Из POS файла ${textFile} извлечено компонентов: ${parsedComponents.length}`)
        } else {
          parsedComponents = parseGenericTextFile(textContent, textFile)
          debugInfo.push(`Из текстового файла ${textFile} извлечено компонентов: ${parsedComponents.length}`)
        }

        if (parsedComponents.length > 0) {
          console.log(`Извлечено ${parsedComponents.length} компонентов из файла ${textFile}`)
          componentsData = [...componentsData, ...parsedComponents]
        }
      }
    } catch (e) {
      console.warn(`Ошибка при парсинге текстового файла ${textFile}:`, e)
      debugInfo.push(`Ошибка при парсинге файла ${textFile}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log("Отладочная информация:", debugInfo.join("\n"))
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
    console.error("Ошибка при парсинга POS файла:", e)
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
      // Здесь можно добавить более сложную логику для определения формата строки
      const parts = line.split(/\s+/)

      if (parts.length >= 2) {
        // Пытаемся извлечь данные
        const name = parts[0]
        const packageType = parts[1]

        // Создаем компонент
        const component: Component = {
          uid: `TXT-${filename.split("/").pop()?.split(".")[0] || "file"}-${components.length.toString().padStart(3, "0")}`,
          name,
          package: packageType,
          pins: determinePinsFromPackage(packageType, name),
          assembled: false,
          side: "TOP",
          x: 0.5,
          y: 0.5,
        }

        // Добавляем размеры компонента
        setComponentDimensions(component)

        // Добавляем компонент в список
        components.push(component)
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
  // Здесь можно добавить логику для определения количества пинов
  // на основе типа корпуса

  // Временная реализация - возвращаем случайное число от 2 до 100
  return Math.floor(Math.random() * 99) + 2
}

/**
 * Определяет размеры компонента на основе типа корпуса
 */
function setComponentDimensions(component: Component): void {
  // Здесь можно добавить логику для определения размеров компонента
  // на основе типа корпуса

  // Временная реализация - устанавливаем случайные размеры
  component.width = Math.random() * 10
  component.height = Math.random() * 10
}
