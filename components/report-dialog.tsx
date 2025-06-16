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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { FileDown, FileIcon as FilePdf, FileText, Printer, Save } from "lucide-react"
import type { BoardData } from "@/lib/types"

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardData: BoardData
  boardId: string
  assemblyProgress: {
    top: number
    bot: number
  }
}

export default function ReportDialog({ open, onOpenChange, boardData, boardId, assemblyProgress }: ReportDialogProps) {
  const [assemblerName, setAssemblerName] = useState("")
  const [serialNumber, setSerialNumber] = useState("")
  const [reportFormat, setReportFormat] = useState<"pdf" | "csv">("pdf")
  const [includeComments, setIncludeComments] = useState(true)
  const [includeImages, setIncludeImages] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)

  const handleGenerateReport = async () => {
    if (!assemblerName || !serialNumber) {
      alert("Please enter assembler name and board serial number")
      return
    }

    setGeneratingReport(true)

    // Simulate report generation delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setGeneratingReport(false)
    alert(`${reportFormat.toUpperCase()} report generated successfully!`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Assembly Report</DialogTitle>
          <DialogDescription>
            Enter assembly information and choose export options to generate a report.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Assembly Information</TabsTrigger>
            <TabsTrigger value="export">Export Options</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="assembler-name">Assembler Name</Label>
              <Input
                id="assembler-name"
                value={assemblerName}
                onChange={(e) => setAssemblerName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial-number">Board Serial Number</Label>
              <Input
                id="serial-number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Enter board serial number"
              />
            </div>

            <div className="space-y-2">
              <Label>Assembly Progress</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">TOP Side</span>
                    <span className="text-sm text-muted-foreground">{assemblyProgress.top}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${assemblyProgress.top}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">BOT Side</span>
                    <span className="text-sm text-muted-foreground">{assemblyProgress.bot}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${assemblyProgress.bot}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Board Information</Label>
              <div className="rounded-md border p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Board Name:</span> {boardData.name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Board ID:</span> {boardId}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Components:</span> {boardData.components.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assembled:</span>{" "}
                    {boardData.components.filter((c) => c.assembled).length}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Report Format</Label>
              <RadioGroup
                value={reportFormat}
                onValueChange={(value) => setReportFormat(value as "pdf" | "csv")}
                className="flex flex-col space-y-2 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="pdf" />
                  <Label htmlFor="pdf" className="flex items-center">
                    <FilePdf className="mr-2 h-4 w-4" />
                    PDF Document
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    CSV Spreadsheet
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Include in Report</Label>
              <div className="flex flex-col space-y-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-comments"
                    checked={includeComments}
                    onCheckedChange={(checked) => setIncludeComments(checked === true)}
                  />
                  <Label htmlFor="include-comments">Component comments</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-images"
                    checked={includeImages}
                    onCheckedChange={(checked) => setIncludeImages(checked === true)}
                  />
                  <Label htmlFor="include-images">Board images</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Export Options</Label>
              <div className="space-y-2 mt-2">
                <Button variant="outline" className="w-full justify-start">
                  <Printer className="mr-2 h-4 w-4" />
                  Print Component List
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileDown className="mr-2 h-4 w-4" />
                  Export to CSV
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerateReport} disabled={generatingReport}>
            {generatingReport ? (
              "Generating..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
