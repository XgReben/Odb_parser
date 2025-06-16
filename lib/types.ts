// Добавим новые типы для поддержки атрибутов и других свойств элементов

// Найдем тип Point и добавим после него следующие типы:

// Добавим тип для атрибутов элементов
export interface FeatureAttributes {
  [key: string]: string | number | boolean
}

// Обновим тип для элементов слоя
export interface LayerFeature {
  type: string
  x: number
  y: number
  width?: number
  height?: number
  diameter?: number
  endX?: number
  endY?: number
  centerX?: number
  centerY?: number
  radius?: number
  startAngle?: number
  endAngle?: number
  thickness?: number
  points?: Point[]
  text?: string
  shape?: string
  rotation?: number
  polarity?: "positive" | "negative"
  attributes?: FeatureAttributes
}

// Обновим тип LayerFeatures
export interface LayerFeatures {
  layerName: string
  layerType: string
  features: LayerFeature[]
}
