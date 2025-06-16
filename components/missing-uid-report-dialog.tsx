"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Download } from "lucide-react"
import { getClientBoardData } from "@/lib/client-storage"

interface MissingUidReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  boardName: string
}

export default function MissingUidReportDialog({
  open,
  onOpenChange,
  boardId,
  boardName,
}: MissingUidReportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<any | null>(null)

  // Генерируем отчет при открытии диалога
  const generateReport = async () => {
    try {
      setLoading(true)
      setError(null)

      // Получаем данные платы из клиентского хранилища
      const boardData = getClientBoardData(boardId)

      if (!boardData) {
        throw new Error("Board data not found in client storage")
      }

      // Проверяем наличие компонентов
      if (!boardData.components || boardData.components.length === 0) {
        throw new Error("No components found for this board")
      }

      // Находим компоненты без UID
      const componentsWithoutUid = boardData.components.filter(
        (component) =>
          !component.uid ||
          component.uid.startsWith("C-") ||
          component.uid.startsWith("P-") ||
          component.uid.startsWith("S-") ||
          component.uid.startsWith("T-"),
      )

      // Создаем отчет
      const reportData = {
        boardId,
        boardName: boardData.name,
        totalComponents: boardData.components.length,
        componentsWithoutUid: componentsWithoutUid.length,
        componentsWithUid: boardData.components.length - componentsWithoutUid.length,
        components: componentsWithoutUid.map((component) => ({
          name: component.name,
          package: component.package,
          side: component.side,
          x: component.x,
          y: component.y,
          rotation: component.rotation,
        })),
      }

      setReport(reportData)
    } catch (err) {
      console.error("Error generating report:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  // Экспортируем отчет в CSV
  const exportToCsv = () => {
    if (!report) return

    const headers = ["Name", "Package", "Side", "X", "Y", "Rotation"]
    const rows = report.components.map((component: any) => [
      component.name,
      component.package,
      component.side,
      component.x,
      component.y,
      component.rotation,
    ])

    const csvContent = [headers.join(","), ...rows.map((row: any[]) => row.join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `missing-uid-report-${boardId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} onOpenAutoFocus={generateReport}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Missing UID Report</DialogTitle>
          <DialogDescription>Components without unique identifiers (UID) for board: {boardName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generating report...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 p-4 rounded-md text-destructive">
            <p className="font-medium">Error generating report:</p>
            <p>{error}</p>
          </div>
        ) : report ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">Total Components</p>
                <p className="text-2xl font-bold">{report.totalComponents}</p>
              </div>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">Components with UID</p>
                <p className="text-2xl font-bold">{report.componentsWithUid}</p>
              </div>
              <div className="bg-destructive/10 p-4 rounded-md">
                <p className="text-sm text-destructive">Components without UID</p>
                <p className="text-2xl font-bold text-destructive">{report.componentsWithoutUid}</p>
              </div>
            </div>

            {report.components.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>X</TableHead>
                    <TableHead>Y</TableHead>
                    <TableHead>Rotation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.components.map((component: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{component.name}</TableCell>
                      <TableCell>{component.package}</TableCell>
                      <TableCell>{component.side}</TableCell>
                      <TableCell>{component.x?.toFixed(4)}</TableCell>
                      <TableCell>{component.y?.toFixed(4)}</TableCell>
                      <TableCell>{component.rotation}°</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-md text-green-600 dark:text-green-400">
                <p className="font-medium">Good news!</p>
                <p>All components in this board have unique identifiers.</p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {report && report.components.length > 0 && (
            <Button onClick={exportToCsv} className="mr-auto">
              <Download className="mr-2 h-4 w-4" />
              Export to CSV
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
