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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, FolderSearch } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface UpdateExtractPathDialogProps {
  boardId: string
  onPathUpdated: () => void
}

export function UpdateExtractPathDialog({ boardId, onPathUpdated }: UpdateExtractPathDialogProps) {
  const [open, setOpen] = useState(false)
  const [extractPath, setExtractPath] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)

      if (!extractPath.trim()) {
        setError("Путь не может быть пустым")
        return
      }

      const response = await fetch(`/api/board/${boardId}/update-path`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ extractPath }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Не удалось обновить путь")
      }

      setSuccess(true)
      onPathUpdated()

      // Закрываем диалог через 2 секунды после успешного обновления
      setTimeout(() => {
        setOpen(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderSearch className="h-4 w-4 mr-2" />
          Обновить путь к ODB++
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Обновить путь к распакованному архиву ODB++</DialogTitle>
          <DialogDescription>Укажите путь к директории, содержащей распакованные файлы ODB++.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert variant="success">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Успех</AlertTitle>
              <AlertDescription>Путь успешно обновлен</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="extractPath" className="text-right">
              Путь
            </Label>
            <Input
              id="extractPath"
              value={extractPath}
              onChange={(e) => setExtractPath(e.target.value)}
              placeholder="/path/to/extracted/odb"
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? "Обновление..." : "Обновить путь"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
