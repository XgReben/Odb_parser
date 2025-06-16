"use client"

import type React from "react"
import { useState } from "react"
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ArchiveStructureProps {
  structure: ArchiveNode
  title?: string
}

interface ArchiveNode {
  name: string
  path: string
  isDirectory: boolean
  children?: ArchiveNode[]
}

const TreeNode: React.FC<{ node: ArchiveNode; level: number }> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2)

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const indent = level * 16

  return (
    <div>
      <div
        className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
        onClick={toggleExpand}
        style={{ paddingLeft: `${indent}px` }}
      >
        {node.isDirectory && node.children && node.children.length > 0 ? (
          <span className="mr-1">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        ) : (
          <span className="w-5" />
        )}
        {node.isDirectory ? (
          <Folder className="h-4 w-4 text-blue-500 mr-2" />
        ) : (
          <File className="h-4 w-4 text-gray-500 mr-2" />
        )}
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {isExpanded &&
        node.children &&
        node.children.map((child, index) => <TreeNode key={index} node={child} level={level + 1} />)}
    </div>
  )
}

export function ArchiveStructureViewer({ structure, title = "Структура архива" }: ArchiveStructureProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <TreeNode node={structure} level={0} />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

/**
 * Создает структуру архива из JSZip объекта
 * @param zip JSZip объект
 * @returns Структура архива в виде дерева
 */
export function createArchiveStructure(zip: any): ArchiveNode {
  const root: ArchiveNode = {
    name: "Root",
    path: "",
    isDirectory: true,
    children: [],
  }

  // Получаем все пути из архива
  const paths = Object.keys(zip.files)

  // Создаем структуру дерева
  paths.forEach((path) => {
    const isDirectory = zip.files[path].dir || path.endsWith("/")
    const parts = path.split("/")
    let currentNode = root

    // Пропускаем пустые части пути
    const filteredParts = parts.filter((part) => part !== "")

    // Если это пустой путь, пропускаем
    if (filteredParts.length === 0) return

    // Создаем узлы для каждой части пути
    for (let i = 0; i < filteredParts.length; i++) {
      const part = filteredParts[i]
      const isLastPart = i === filteredParts.length - 1
      const currentPath = parts.slice(0, i + 1).join("/")

      // Ищем существующий узел
      let found = currentNode.children?.find((child) => child.name === part)

      if (!found) {
        // Создаем новый узел
        const newNode: ArchiveNode = {
          name: part,
          path: currentPath,
          isDirectory: isLastPart ? isDirectory : true,
          children: [],
        }

        // Добавляем узел в текущий узел
        if (!currentNode.children) {
          currentNode.children = []
        }
        currentNode.children.push(newNode)
        found = newNode
      }

      // Переходим к следующему узлу
      currentNode = found
    }
  })

  return root
}
