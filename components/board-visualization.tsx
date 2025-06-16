"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BoardData, Component } from "@/lib/types"

interface BoardVisualizationProps {
  boardData: BoardData
  highlightedComponent?: string | null
  mountSide?: "TOP" | "BOT"
  onMountSideChange?: (side: "TOP" | "BOT") => void
}

export default function BoardVisualization({
  boardData,
  highlightedComponent,
  mountSide = "TOP",
  onMountSideChange,
}: BoardVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Убедимся, что свойство components всегда существует
  const components = boardData.components || []

  // Фильтруем компоненты по стороне монтажа
  const filteredComponents = components.filter((component) => !component.side || component.side === mountSide)

  // Отрисовка платы
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Очищаем холст
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Устанавливаем масштаб и смещение
    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    // Рисуем контур платы
    ctx.fillStyle = "#333"
    ctx.fillRect(0, 0, boardData.width, boardData.height)

    // Рисуем компоненты
    filteredComponents.forEach((component) => {
      const isHighlighted = highlightedComponent === component.uid

      // Определяем цвет компонента
      let color = "#666"
      if (component.assembled) {
        color = "#4CAF50" // Зеленый для собранных компонентов
      }
      if (isHighlighted) {
        color = "#FF9800" // Оранжевый для выделенного компонента
      }

      // Рисуем компонент
      drawComponent(ctx, component, color)
    })

    ctx.restore()
  }, [boardData, filteredComponents, highlightedComponent, scale, offset])

  // Функция для отрисовки компонента
  const drawComponent = (ctx: CanvasRenderingContext2D, component: Component, color: string) => {
    const x = (component.x || 0.5) * boardData.width
    const y = (component.y || 0.5) * boardData.height
    const width = component.width || 10
    const height = component.height || 10

    // Рисуем прямоугольник компонента
    ctx.fillStyle = color
    ctx.fillRect(x - width / 2, y - height / 2, width, height)

    // Рисуем контур компонента
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 0.5
    ctx.strokeRect(x - width / 2, y - height / 2, width, height)

    // Рисуем имя компонента
    ctx.fillStyle = "#fff"
    ctx.font = "4px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(component.name, x, y)
  }

  // Обработчики событий для масштабирования и перемещения
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prevScale) => Math.max(0.1, Math.min(5, prevScale + delta)))
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  // Обработчик изменения стороны монтажа
  const handleSideChange = (side: "TOP" | "BOT") => {
    if (onMountSideChange) {
      onMountSideChange(side)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Визуализация платы</h3>
        <div className="flex items-center space-x-2">
          <Tabs value={mountSide} onValueChange={handleSideChange as (value: string) => void}>
            <TabsList>
              <TabsTrigger value="TOP">TOP</TabsTrigger>
              <TabsTrigger value="BOT">BOT</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setScale((prevScale) => Math.max(0.1, prevScale - 0.1))}>
            -
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setScale((prevScale) => Math.min(5, prevScale + 0.1))}>
            +
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setScale(1)
              setOffset({ x: 0, y: 0 })
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-[500px] bg-muted cursor-move"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>
          Компоненты: {filteredComponents.length} (сторона {mountSide})
        </p>
        <p>
          Собрано: {filteredComponents.filter((c) => c.assembled).length} из {filteredComponents.length} (
          {filteredComponents.length > 0
            ? Math.round((filteredComponents.filter((c) => c.assembled).length / filteredComponents.length) * 100)
            : 0}
          %)
        </p>
      </div>
    </div>
  )
}
