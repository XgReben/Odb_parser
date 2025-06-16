"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Download, Code, TableIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ParsedDataViewerProps {
  data: any
  type: "components" | "layers" | "profile" | "debug"
}

export function ParsedDataViewer({ data, type }: ParsedDataViewerProps) {
  const [viewMode, setViewMode] = useState<"table" | "json">("table")
  const [searchTerm, setSearchTerm] = useState("")

  // Функция для фильтрации данных по поисковому запросу
  const filteredData = Array.isArray(data)
    ? data.filter((item) => {
        if (!searchTerm) return true
        const searchLower = searchTerm.toLowerCase()
        return Object.values(item).some((value) => String(value).toLowerCase().includes(searchLower))
      })
    : data

  // Функция для экспорта данных в JSON файл
  const exportToJson = () => {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${type}-data.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Функция для отображения таблицы компонентов
  const renderComponentsTable = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return <p className="text-center py-4">No components found</p>
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Pins</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((component, index) => (
            <TableRow key={component.uid || index}>
              <TableCell className="font-medium">{component.name}</TableCell>
              <TableCell>{component.package}</TableCell>
              <TableCell>{component.side || "N/A"}</TableCell>
              <TableCell>{component.pins}</TableCell>
              <TableCell>
                {component.x !== undefined && component.y !== undefined
                  ? `(${component.x.toFixed(2)}, ${component.y.toFixed(2)})`
                  : "N/A"}
              </TableCell>
              <TableCell>
                <Badge variant={component.assembled ? "success" : "secondary"}>
                  {component.assembled ? "Assembled" : "Not Assembled"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // Функция для отображения таблицы слоев
  const renderLayersTable = () => {
    if (!Array.isArray(data) || data.length === 0) {
      return <p className="text-center py-4">No layers found</p>
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Elements</TableHead>
            <TableHead>Color</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((layer, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{layer.name}</TableCell>
              <TableCell>{layer.type}</TableCell>
              <TableCell>{layer.side}</TableCell>
              <TableCell>
                {layer.lines?.length || 0} lines, {layer.circles?.length || 0} circles, {layer.polygons?.length || 0}{" "}
                polygons
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: layer.color || "#cccccc" }}></div>
                  {layer.color || "Default"}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  // Функция для отображения профиля платы
  const renderProfileInfo = () => {
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-center py-4">No profile information found</p>
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Dimensions</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Width: {data.width?.toFixed(2) || "N/A"} mm</p>
              <p>Height: {data.height?.toFixed(2) || "N/A"} mm</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Boundaries</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Min X: {data.minX?.toFixed(2) || "N/A"}</p>
              <p>Min Y: {data.minY?.toFixed(2) || "N/A"}</p>
              <p>Max X: {data.maxX?.toFixed(2) || "N/A"}</p>
              <p>Max Y: {data.maxY?.toFixed(2) || "N/A"}</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Outline</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Polygons: {data.outline?.length || 0}</p>
            {data.outline && data.outline.length > 0 && (
              <p>Total points: {data.outline.reduce((sum, poly) => sum + (poly.points?.length || 0), 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Функция для отображения отладочной информации
  const renderDebugInfo = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
        </CardContent>
      </Card>
    )
  }

  // Функция для отображения данных в формате JSON
  const renderJsonView = () => {
    return (
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px] rounded-md">
            <pre className="p-4 text-xs font-mono">{JSON.stringify(filteredData, null, 2)}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={`Search ${type}...`}
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-none"
            >
              <TableIcon className="h-4 w-4 mr-1" />
              Table
            </Button>
            <Button
              variant={viewMode === "json" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("json")}
              className="rounded-none"
            >
              <Code className="h-4 w-4 mr-1" />
              JSON
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={exportToJson}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          {viewMode === "json" ? (
            renderJsonView()
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="p-4">
                {type === "components" && renderComponentsTable()}
                {type === "layers" && renderLayersTable()}
                {type === "profile" && renderProfileInfo()}
                {type === "debug" && renderDebugInfo()}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
