"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUp, Upload, AlertCircle, CheckCircle2, Loader2, Bug } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { saveClientBoardData, saveClientBoardLayers, saveClientBoardLayersSvg } from "@/lib/client-storage"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function UploadPage() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [componentsCount, setComponentsCount] = useState<number | null>(null)
  const [boardId, setBoardId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      validateAndSetFile(droppedFile)
    }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      validateAndSetFile(selectedFile)
    }
  }, [])

  const validateAndSetFile = useCallback((file: File) => {
    // Check file extension
    const validExtensions = [".zip", ".tgz", ".tar.gz", ".odb"]
    const fileName = file.name.toLowerCase()
    const isValidExtension = validExtensions.some((ext) => fileName.endsWith(ext))

    if (!isValidExtension) {
      setError("Please upload a valid ODB++ file (.zip, .tgz, .tar.gz, .odb)")
      return
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB in bytes
    if (file.size > maxSize) {
      setError(`File size exceeds 50MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB)`)
      return
    }

    setFile(file)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file) return

    setUploading(true)
    setProgress(0)
    setError(null)
    setSuccess(null)
    setComponentsCount(null)
    setBoardId(null)
    setDebugInfo(null)

    try {
      // For demo purposes, simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 5
        })
      }, 300)

      // Create FormData
      const formData = new FormData()
      formData.append("file", file)

      // Use fetch API
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Server error" }))
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || "Unknown error occurred")
      }

      setProgress(100)
      setSuccess(
        `File uploaded and processed successfully! Found ${data.componentsCount} components and ${data.layersCount} layers.`,
      )
      setComponentsCount(data.componentsCount)
      setBoardId(data.boardId)
      setDebugInfo(data.debug)

      // Сохраняем данные платы в localStorage
      if (data.boardData && data.boardId) {
        // Сохраняем основные данные платы
        saveClientBoardData(data.boardId, data.boardData)

        // Сохраняем SVG-представления слоев
        if (data.layersSvg) {
          saveClientBoardLayersSvg(data.boardId, data.layersSvg)
        }

        // Сохраняем полные данные слоев в IndexedDB
        if (data.boardData.layers && data.boardData.layers.length > 0) {
          await saveClientBoardLayers(data.boardId, data.boardData.layers)
        }
      }

      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/board/${data.boardId}`)
      }, 2000)
    } catch (err) {
      console.error("Upload error:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred during upload")
      setUploading(false)
    }
  }, [file, router])

  const resetUpload = useCallback(() => {
    setFile(null)
    setUploading(false)
    setProgress(0)
    setError(null)
    setSuccess(null)
    setComponentsCount(null)
    setBoardId(null)
    setDebugInfo(null)
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Upload ODB++ File</h1>

      <Card>
        <CardHeader>
          <CardTitle>Upload Board Design</CardTitle>
          <CardDescription>
            Upload an ODB++ file (.zip, .tgz, .tar.gz, .odb) containing your PCB design data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center ${
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Drag and drop your ODB++ file here</h3>
            <p className="text-sm text-muted-foreground mb-4">or</p>
            <Button
              variant="outline"
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={uploading}
            >
              Select File
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".zip,.tgz,.tar.gz,.odb"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>

          {file && !uploading && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="font-medium">Selected file:</p>
              <p className="text-sm text-muted-foreground">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </div>
          )}

          {uploading && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {progress < 95 ? "Uploading and parsing ODB++ file..." : "Processing components and layers..."}
                </p>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-right">{progress}%</p>
            </div>
          )}

          {boardId && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-md">
              <p className="font-medium">Board ID:</p>
              <p className="text-sm font-mono">{boardId}</p>
              <p className="text-xs text-muted-foreground mt-2">
                You will be redirected to the board page in a moment...
              </p>
            </div>
          )}

          {debugInfo && (
            <div className="mt-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="debug">
                  <AccordionTrigger className="text-sm flex items-center">
                    <Bug className="h-4 w-4 mr-2" />
                    Debug Information
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md text-xs font-mono overflow-auto max-h-60">
                      <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {file && !uploading && (
            <>
              <Button variant="outline" onClick={resetUpload}>
                Cancel
              </Button>
              <Button onClick={handleUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload and Process
              </Button>
            </>
          )}
          {(!file || uploading) && (
            <div className="w-full text-center text-sm text-muted-foreground">
              {uploading
                ? "Please wait while we process your file... This may take a few moments."
                : "Supported formats: .zip, .tgz, .tar.gz, .odb (max 50MB)"}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
