"use client"

import React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  Check,
  MessageSquare,
  Search,
  Info,
  ChevronRight,
  ChevronDown,
  Package,
  Filter,
  FileWarning,
  FileSpreadsheet,
} from "lucide-react"
import type { Component } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ComponentTableProps {
  components: Component[]
  onToggle: (uid: string, checked: boolean) => void
  onComment: (uid: string, comment: string) => void
  onHighlight: (uid: string | null) => void
  onGenerateErrorReport?: () => void
  compact?: boolean
  highlightedComponent?: string | null
}

// Интерфейс для группы компонентов
interface ComponentGroup {
  uid: string
  count: number
  assembledCount: number
  components: Component[]
}

// Функция для проверки, имеет ли десигнатор букву перед цифрой
const hasLetterBeforeNumber = (designator: string | undefined): boolean => {
  if (!designator) return false
  // Регулярное выражение для проверки, что строка начинается с буквы, за которой следует цифра
  const regex = /^[A-Za-z]+\d/
  return regex.test(designator)
}

export default function ComponentTable({
  components = [], // Устанавливаем значение по умолчанию
  onToggle,
  onComment,
  onHighlight,
  onGenerateErrorReport,
  compact = false,
  highlightedComponent,
}: ComponentTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null)
  const [commentText, setCommentText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [groupBy, setGroupBy] = useState<"uid" | "designator" | "none">("uid")
  const [showMissingUidWarning, setShowMissingUidWarning] = useState(false)

  // Проверяем наличие компонентов без UID, но с параметрами и с валидным десигнатором
  const componentsWithoutUid = useMemo(() => {
    return components.filter((component) => {
      // Проверяем, есть ли у компонента хотя бы какие-то параметры
      const hasProperties = component.properties && Object.keys(component.properties).length > 0
      const hasPackage = component.package && component.package !== "Unknown"
      const hasName = component.name && component.name.trim() !== ""

      // Проверяем, что десигнатор имеет букву перед цифрой
      const validDesignator = hasLetterBeforeNumber(component.name)

      // Компонент должен иметь хотя бы какие-то параметры, но не иметь UID,
      // и иметь валидный десигнатор
      return (!component.uid || component.uid === "") && (hasProperties || hasPackage || hasName) && validDesignator
    }).length
  }, [components])

  // Добавим отладочную информацию при монтировании компонента
  useEffect(() => {
    const info = `ComponentTable mounted with ${components.length} components.
Component types: ${Array.from(new Set(components.map((c) => c.package))).join(", ")}
Component sides: ${Array.from(new Set(components.map((c) => c.side))).join(", ")}
Components without UID but with parameters and valid designator: ${componentsWithoutUid}
Search term: "${searchTerm}"`
    setDebugInfo(info)
    console.log(info)

    // Показываем предупреждение, если есть компоненты без UID, но с параметрами
    setShowMissingUidWarning(componentsWithoutUid > 0)
  }, [components, componentsWithoutUid, searchTerm])

  // Получаем все уникальные свойства компонентов из PRP
  const allProperties = useMemo(() => {
    const properties = new Set<string>()
    components.forEach((component) => {
      if (component.properties) {
        Object.keys(component.properties).forEach((key) => {
          properties.add(key)
        })
      }
    })
    return Array.from(properties)
  }, [components])

  // Группируем компоненты по UID (без учета регистра) или designator
  const componentGroups = useMemo(() => {
    if (groupBy === "none") {
      return null // Не группируем
    }

    const groups: Record<string, ComponentGroup> = {}

    components.forEach((component) => {
      // Определяем ключ группировки
      let groupKey = ""

      if (groupBy === "uid") {
        // Группируем по UID без учета регистра
        groupKey = component.uid ? component.uid.toLowerCase() : "unknown"
      } else if (groupBy === "designator") {
        // Группируем по первой букве designator (например, R для резисторов)
        groupKey = component.name ? component.name.charAt(0).toUpperCase() : "unknown"
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          uid: groupKey,
          count: 0,
          assembledCount: 0,
          components: [],
        }
      }

      groups[groupKey].components.push(component)
      groups[groupKey].count++
      if (component.assembled) {
        groups[groupKey].assembledCount++
      }
    })

    // Преобразуем объект в массив и сортируем по имени
    return Object.values(groups).sort((a, b) => a.uid.localeCompare(b.uid))
  }, [components, groupBy])

  // Фильтруем компоненты или группы по поисковому запросу
  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return groupBy === "none" ? components : componentGroups
    }

    const lowerSearchTerm = searchTerm.toLowerCase()

    if (groupBy === "none") {
      // Фильтруем отдельные компоненты
      return components.filter((component) => {
        // Проверяем основные поля
        if (
          (component.uid && component.uid.toLowerCase().includes(lowerSearchTerm)) ||
          (component.name && component.name.toLowerCase().includes(lowerSearchTerm)) ||
          (component.package && component.package.toLowerCase().includes(lowerSearchTerm))
        ) {
          return true
        }

        // Проверяем свойства из PRP
        if (component.properties) {
          for (const [key, value] of Object.entries(component.properties)) {
            if (
              key.toLowerCase().includes(lowerSearchTerm) ||
              (value && value.toString().toLowerCase().includes(lowerSearchTerm))
            ) {
              return true
            }
          }
        }

        return false
      })
    } else {
      // Фильтруем группы и их компоненты
      return componentGroups?.filter((group) => {
        // Проверяем, соответствует ли группа поисковому запросу
        if (group.uid.toLowerCase().includes(lowerSearchTerm)) {
          return true
        }

        // Проверяем, есть ли в группе компоненты, соответствующие поисковому запросу
        return group.components.some((component) => {
          // Проверяем основные поля
          if (
            (component.uid && component.uid.toLowerCase().includes(lowerSearchTerm)) ||
            (component.name && component.name.toLowerCase().includes(lowerSearchTerm)) ||
            (component.package && component.package.toLowerCase().includes(lowerSearchTerm))
          ) {
            return true
          }

          // Проверяем свойства из PRP
          if (component.properties) {
            for (const [key, value] of Object.entries(component.properties)) {
              if (
                key.toLowerCase().includes(lowerSearchTerm) ||
                (value && value.toString().toLowerCase().includes(lowerSearchTerm))
              ) {
                return true
              }
            }
          }

          return false
        })
      })
    }
  }, [components, componentGroups, searchTerm, groupBy])

  const handleCommentOpen = (component: Component) => {
    setSelectedComponent(component)
    setCommentText(component.comment || "")
    setDialogOpen(true)
  }

  const handleCommentSave = () => {
    if (selectedComponent) {
      onComment(selectedComponent.uid, commentText)
      setDialogOpen(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }))
  }

  const toggleAllInGroup = (group: ComponentGroup, assembled: boolean) => {
    group.components.forEach((component) => {
      onToggle(component.uid, assembled)
    })
  }

  // Функция для отображения прогресса сборки группы
  const renderGroupProgress = (group: ComponentGroup) => {
    const progress = Math.round((group.assembledCount / group.count) * 100)
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
        <span className="text-xs text-muted-foreground">{progress}%</span>
      </div>
    )
  }

  // Функция для отображения свойств компонента
  const renderComponentProperties = (component: Component) => {
    if (!component.properties || Object.keys(component.properties).length === 0) {
      return <span className="text-muted-foreground text-xs">No properties</span>
    }

    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(component.properties).map(([key, value]) => (
          <TooltipProvider key={key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs">
                  {key}: {value}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {key}: {value}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    )
  }

  // Проверка, имеет ли компонент хотя бы какие-то параметры
  const hasParameters = (component: Component): boolean => {
    const hasProperties = component.properties && Object.keys(component.properties).length > 0
    const hasPackage = component.package && component.package !== "Unknown"
    const hasName = component.name && component.name.trim() !== ""

    return hasProperties || hasPackage || hasName
  }

  // Функция для экспорта данных в CSV
  const exportToCsv = () => {
    // Подготовка данных для экспорта
    const exportData: any[] = []

    if (groupBy !== "none" && componentGroups) {
      // Экспорт сгруппированных компонентов
      componentGroups.forEach((group) => {
        // Собираем все десигнаторы в группе
        const designators = group.components.map((c) => c.name?.split(" ")[0] || "Unknown").join(", ")

        // Получаем первый компонент в группе для получения общих данных
        const firstComponent = group.components[0]

        // Определяем partnumber из свойств (если есть)
        const partnumber =
          firstComponent.properties?.["PARTNUMBER"] ||
          firstComponent.properties?.["PN"] ||
          firstComponent.properties?.["P/N"] ||
          firstComponent.package ||
          "Unknown"

        // Определяем альтернативный UID
        const altUid = firstComponent.properties?.["ALT_UID"] || ""

        // Определяем DNP (Do Not Place)
        const dnp =
          firstComponent.properties?.["DNP"] === "true" ||
          firstComponent.properties?.["DNP"] === "1" ||
          firstComponent.properties?.["DO_NOT_PLACE"] === "true" ||
          false

        exportData.push({
          Designator: designators,
          Quantity: group.count,
          Partnumber: partnumber,
          UID: firstComponent.uid || "",
          ALT_UID: altUid,
          DNP: dnp ? "Yes" : "No",
        })
      })
    } else {
      // Экспорт отдельных компонентов
      components.forEach((component) => {
        // Определяем partnumber из свойств (если есть)
        const partnumber =
          component.properties?.["PARTNUMBER"] ||
          component.properties?.["PN"] ||
          component.properties?.["P/N"] ||
          component.package ||
          "Unknown"

        // Определяем альтернативный UID
        const altUid = component.properties?.["ALT_UID"] || ""

        // Определяем DNP (Do Not Place)
        const dnp =
          component.properties?.["DNP"] === "true" ||
          component.properties?.["DNP"] === "1" ||
          component.properties?.["DO_NOT_PLACE"] === "true" ||
          false

        exportData.push({
          Designator: component.name?.split(" ")[0] || "Unknown",
          Quantity: 1,
          Partnumber: partnumber,
          UID: component.uid || "",
          ALT_UID: altUid,
          DNP: dnp ? "Yes" : "No",
        })
      })
    }

    // Создаем CSV-строку
    const headers = ["Designator", "Quantity", "Partnumber", "UID", "ALT_UID", "DNP"]
    let csvContent = headers.join(",") + "\n"

    exportData.forEach((item) => {
      const row = [
        `"${item.Designator.replace(/"/g, '""')}"`, // Экранируем кавычки в строках
        item.Quantity,
        `"${item.Partnumber.replace(/"/g, '""')}"`,
        `"${item.UID.replace(/"/g, '""')}"`,
        `"${item.ALT_UID.replace(/"/g, '""')}"`,
        item.DNP,
      ]
      csvContent += row.join(",") + "\n"
    })

    // Создаем Blob и используем более надежный метод для скачивания
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)

    // Создаем видимую кнопку для скачивания, которая будет удалена после нажатия
    const downloadLink = document.createElement("a")
    downloadLink.href = url
    downloadLink.download = "components.csv"
    downloadLink.textContent = "Download CSV"
    downloadLink.style.display = "none"

    // Добавляем ссылку в DOM
    document.body.appendChild(downloadLink)

    // Программно нажимаем на ссылку
    downloadLink.click()

    // Удаляем ссылку из DOM после небольшой задержки
    setTimeout(() => {
      document.body.removeChild(downloadLink)
      // Освобождаем URL объект
      URL.revokeObjectURL(url)
    }, 100)

    // Показываем уведомление пользователю
    alert("CSV file has been generated. If download didn't start automatically, check your browser settings.")
  }

  return (
    <div className="space-y-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search components..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setGroupBy("uid")}>
              <Package className="mr-2 h-4 w-4" />
              Group by UID
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("designator")}>
              <Package className="mr-2 h-4 w-4" />
              Group by Designator
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("none")}>
              <Package className="mr-2 h-4 w-4" />
              No Grouping
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="icon" onClick={exportToCsv} title="Export to CSV">
          <FileSpreadsheet className="h-4 w-4" />
        </Button>
      </div>

      {showMissingUidWarning && (
        <div className="mx-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Warning: {componentsWithoutUid} components without UID
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Some components have parameters but are missing UID property which may cause issues with tracking
            </p>
          </div>
          {onGenerateErrorReport && (
            <Button variant="outline" size="sm" onClick={onGenerateErrorReport} className="whitespace-nowrap">
              Generate Report
            </Button>
          )}
        </div>
      )}

      {components.length === 0 && (
        <div className="p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
          <h3 className="text-lg font-medium">No components found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The uploaded file did not contain any component data that could be parsed.
          </p>
        </div>
      )}

      {components.length > 0 && (
        <div className="rounded-md border-0 border-t overflow-auto flex-1" style={{ height: "calc(100vh - 300px)" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Designator</TableHead>
                <TableHead className="w-20">Quantity</TableHead>
                <TableHead>UID</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupBy !== "none" && componentGroups && filteredItems && filteredItems.length > 0 ? (
                // Отображаем сгруппированные компоненты
                filteredItems.map((group: ComponentGroup) => (
                  <React.Fragment key={group.uid}>
                    <TableRow className="group hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 mr-2"
                            onClick={() => toggleGroup(group.uid)}
                          >
                            {expandedGroups[group.uid] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                          <Checkbox
                            checked={group.assembledCount === group.count}
                            onCheckedChange={(checked) => toggleAllInGroup(group, checked === true)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => toggleGroup(group.uid)}>
                        <div className="flex items-center gap-2">
                          <span>{group.uid}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{group.count}</Badge>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right">{renderGroupProgress(group)}</TableCell>
                    </TableRow>

                    {expandedGroups[group.uid] &&
                      group.components.map((component) => (
                        <TableRow
                          key={component.uid}
                          onMouseEnter={() => onHighlight(component.uid)}
                          onMouseLeave={() => onHighlight(null)}
                          className={`${component.assembled ? "bg-green-50/50 dark:bg-green-950/20" : ""} pl-10`}
                        >
                          <TableCell className="pl-10">
                            <Checkbox
                              checked={component.assembled}
                              onCheckedChange={(checked) => {
                                onToggle(component.uid, checked === true)
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{component.name.split(" ")[0]}</TableCell>
                          <TableCell>1</TableCell>
                          <TableCell className="font-mono text-xs">
                            {component.uid || (
                              <span className="text-amber-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Missing
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{renderComponentProperties(component)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {component.comment && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-500"
                                  onClick={() => handleCommentOpen(component)}
                                >
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="sr-only">View comment</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCommentOpen(component)}
                              >
                                <MessageSquare className="h-4 w-4" />
                                <span className="sr-only">Add comment</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                ))
              ) : // Отображаем отдельные компоненты (без группировки)
              filteredItems && filteredItems.length > 0 ? (
                filteredItems.map((component: Component) => (
                  <TableRow
                    key={component.uid}
                    onMouseEnter={() => onHighlight(component.uid)}
                    onMouseLeave={() => onHighlight(null)}
                    className={component.assembled ? "bg-green-50/50 dark:bg-green-950/20" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={component.assembled}
                        onCheckedChange={(checked) => {
                          onToggle(component.uid, checked === true)
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{component.name.split(" ")[0]}</TableCell>
                    <TableCell>1</TableCell>
                    <TableCell className="font-mono text-xs">
                      {component.uid || (
                        <span className="text-amber-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{renderComponentProperties(component)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {component.comment && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-500"
                            onClick={() => handleCommentOpen(component)}
                          >
                            <AlertCircle className="h-4 w-4" />
                            <span className="sr-only">View comment</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCommentOpen(component)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="sr-only">Add comment</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Info className="h-6 w-6 text-muted-foreground mb-2" />
                      <p>No components found matching your search.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Try adjusting your search term or check the debug information.
                      </p>
                      <div className="mt-2 text-xs text-left bg-slate-50 dark:bg-slate-900 p-2 rounded-md max-w-md overflow-auto">
                        <pre className="whitespace-pre-wrap">{debugInfo}</pre>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Component Comment</DialogTitle>
            <DialogDescription>
              {selectedComponent?.name} ({selectedComponent?.uid})
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Add a comment about this component..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCommentSave}>
              <Check className="mr-2 h-4 w-4" />
              Save Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
