"use client"

import { useState, useCallback } from "react"
import { v4 as uuidv4 } from "uuid"
import JSZip from "jszip"
import { saveClientBoardData, saveClientBoardLayers, saveClientBoardLayersSvg } from "@/lib/client-storage"
import { parseLayersFromODB } from "@/lib/layer-parser"
import { parseProfileFromODB } from "@/lib/profile-parser"
import { generateLayersSvg } from "@/lib/svg-generator"
import type { BoardData, Component } from "@/lib/types"

interface ClientOdbParserProps {
  onParseComplete: (boardId: string) => void
  onParseError: (error: string) => void
}

export default function ClientOdbParser({ onParseComplete, onParseError }: ClientOdbParserProps) {
  const [parsing, setParsing] = useState(false)
  const [progress, setProgress] = useState(0)

  const parseOdbFile = useCallback(
    async (file: File) => {
      try {
        setParsing(true)
        setProgress(5)
        console.log("Начинаем парсинг ODB++ файла:", file.name, "размер:", file.size, "тип:", file.type)

        // Проверяем, что файл существует и имеет размер
        if (!file || file.size === 0) {
          throw new Error("Файл пуст или не существует")
        }

        // Генерируем уникальный ID для платы
        const boardId = uuidv4()
        console.log(`Сгенерирован ID платы: ${boardId}`)

        // Загружаем и распаковываем архив
        const zip = new JSZip()
        console.log("Начинаем распаковку архива...")
        setProgress(10)

        // Преобразуем файл в ArrayBuffer перед распаковкой
        const arrayBuffer = await file.arrayBuffer()
        const zipContents = await zip.loadAsync(arrayBuffer)
        setProgress(30)

        // Выводим подробную информацию о содержимом архива
        const filesList = Object.keys(zipContents.files)
        console.log("Архив распакован, найдено файлов:", filesList.length)

        // Выводим структуру директорий для отладки
        console.log("Структура директорий в архиве:")
        const directories = filesList.filter((f) => zipContents.files[f].dir)
        directories.sort().forEach((dir) => console.log(`- ${dir}`))

        // Проверяем наличие ключевых директорий ODB++
        const hasStepsDir = filesList.some((f) => f.includes("steps/") || f === "steps" || f.includes("odb/steps/"))
        const hasComponentsDir = filesList.some((f) => f.includes("components/") || f === "components")
        console.log("Наличие директории steps:", hasStepsDir)
        console.log("Наличие директории components:", hasComponentsDir)

        // Ищем XML и другие потенциально полезные файлы
        const xmlFiles = filesList.filter((f) => f.endsWith(".xml"))
        const txtFiles = filesList.filter((f) => f.endsWith(".txt"))
        const csvFiles = filesList.filter((f) => f.endsWith(".csv"))
        console.log("Найдено XML файлов:", xmlFiles.length)
        console.log("Найдено TXT файлов:", txtFiles.length)
        console.log("Найдено CSV файлов:", csvFiles.length)

        // Извлекаем имя платы из имени файла
        const boardName = file.name.split(".")[0].replace(/_/g, " ") + " PCB"

        // Создаем данные платы
        const boardData: BoardData = {
          id: boardId,
          name: boardName,
          width: 300, // Стандартные размеры, если не удалось извлечь из файла
          height: 200,
          components: [], // Будет заполнено позже
          debug: {
            fileSize: file.size,
            fileType: file.type,
            totalFiles: filesList.length,
            xmlFiles: xmlFiles.length,
            txtFiles: txtFiles.length,
            csvFiles: csvFiles.length,
            hasStepsDir,
            hasComponentsDir,
            parsingMethod: "client",
            directoryStructure: directories.slice(0, 50), // Добавляем структуру директорий для отладки (первые 50)
          },
        }

        // Ищем компоненты в архиве
        setProgress(40)
        console.log("Ищем компоненты в архиве...")
        try {
          const components = await findComponentsInArchive(zipContents)
          boardData.components = components
          console.log(`Найдено ${components.length} компонентов`)
        } catch (e) {
          console.warn("Не удалось найти компоненты:", e)
          boardData.components = []
          if (!boardData.debug) boardData.debug = {}
          boardData.debug.componentsError = e instanceof Error ? e.message : String(e)
        }

        // Ищем контур платы
        setProgress(60)
        try {
          console.log("Ищем контур платы...")
          const profile = await parseProfileFromODB(zipContents)
          if (profile) {
            console.log("Найден контур платы")
            boardData.profile = profile

            // Обновляем размеры платы на основе контура
            boardData.width = profile.width
            boardData.height = profile.height

            // Добавляем информацию о контуре в debug
            if (!boardData.debug) boardData.debug = {}
            boardData.debug.profileFound = true
          } else {
            console.warn("Контур платы не найден")
            if (!boardData.debug) boardData.debug = {}
            boardData.debug.profileFound = false
          }
        } catch (e) {
          console.warn("Не удалось найти контур платы:", e)
          if (!boardData.debug) boardData.debug = {}
          boardData.debug.profileError = e instanceof Error ? e.message : String(e)
        }

        // Ищем слои платы
        setProgress(70)
        try {
          console.log("Ищем слои платы...")
          const layers = await parseLayersFromODB(zipContents)
          if (layers.length > 0) {
            console.log(`Найдено ${layers.length} слоев платы`)
            boardData.layers = layers.map((layer) => ({
              name: layer.name,
              type: layer.type,
              side: layer.side,
              color: layer.color,
              visible: layer.visible,
              linesCount: layer.lines?.length || 0,
              circlesCount: layer.circles?.length || 0,
              polygonsCount: layer.polygons?.length || 0,
              textsCount: layer.texts?.length || 0,
            }))

            // Сохраняем полные данные слоев в IndexedDB
            await saveClientBoardLayers(boardId, layers)

            // Генерируем SVG для каждого слоя
            setProgress(80)
            console.log("Генерируем SVG для слоев...")
            const layersSvg = await generateLayersSvg(layers, boardData.profile)

            // Сохраняем SVG в localStorage
            saveClientBoardLayersSvg(boardId, layersSvg)
            console.log("SVG для слоев сгенерированы и сохранены")

            // Добавляем информацию о найденных слоях в debug
            if (!boardData.debug) boardData.debug = {}
            boardData.debug.layersFound = layers.map((layer) => `${layer.name} (${layer.type}, ${layer.side})`)
          } else {
            console.warn("Слои платы не найдены")
            if (!boardData.debug) boardData.debug = {}
            boardData.debug.layersFound = "No layers found"
          }
        } catch (e) {
          console.warn("Не удалось найти слои платы:", e)
          if (!boardData.debug) boardData.debug = {}
          boardData.debug.layerError = e instanceof Error ? e.message : String(e)
        }

        // Сохраняем данные платы в localStorage
        setProgress(90)
        console.log("Сохраняем данные платы в localStorage...")
        saveClientBoardData(boardId, boardData)

        setProgress(100)
        console.log("Парсинг ODB++ файла завершен успешно")

        // Вызываем callback с ID платы
        onParseComplete(boardId)
      } catch (error) {
        console.error("Ошибка при парсинге ODB++ файла:", error)
        onParseError(error instanceof Error ? error.message : "Неизвестная ошибка при парсинге файла")
      } finally {
        setParsing(false)
      }
    },
    [onParseComplete, onParseError],
  )

  return (
    <div className="hidden">
      {/* Этот компонент не имеет UI, он только предоставляет функцию parseOdbFile */}
      {/* Можно добавить индикатор прогресса, если нужно */}
    </div>
  )
}

// Вспомогательная функция для поиска компонентов в архиве
async function findComponentsInArchive(zip: JSZip): Promise<Component[]> {
  // Здесь должна быть логика поиска компонентов в архиве
  // Для простоты вернем пустой массив
  return []
}
