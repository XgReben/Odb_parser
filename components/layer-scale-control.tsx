"use client"

import type React from "react"

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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { ZoomIn, Settings } from "lucide-react"

interface LayerScaleControlProps {
  scaleFactor: number
  onScaleChange: (scale: number) => void
}

export default function LayerScaleControl({ scaleFactor, onScaleChange }: LayerScaleControlProps) {
  const [open, setOpen] = useState(false)
  const [tempScale, setTempScale] = useState(scaleFactor)

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempScale(scaleFactor)
    }
    setOpen(isOpen)
  }

  const handleSliderChange = (value: number[]) => {
    setTempScale(value[0])
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setTempScale(value)
    }
  }

  const applyScale = () => {
    onScaleChange(tempScale)
    setOpen(false)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <ZoomIn className="mr-2 h-4 w-4" />
        Scale: {scaleFactor}x
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Layer Scale</DialogTitle>
            <DialogDescription>Adjust the scale factor for better visibility of layer elements.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scale-slider">Scale Factor: {tempScale}x</Label>
              <Slider
                id="scale-slider"
                min={1}
                max={100}
                step={1}
                value={[tempScale]}
                onValueChange={handleSliderChange}
                className="mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scale-input">Custom Scale</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="scale-input"
                  type="number"
                  min={1}
                  max={100}
                  value={tempScale}
                  onChange={handleInputChange}
                />
                <span>x</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Presets</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[1, 5, 10, 20, 50, 100].map((scale) => (
                  <Button
                    key={scale}
                    variant="outline"
                    size="sm"
                    onClick={() => setTempScale(scale)}
                    className={tempScale === scale ? "bg-primary text-primary-foreground" : ""}
                  >
                    {scale}x
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyScale}>
              <Settings className="mr-2 h-4 w-4" />
              Apply Scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
