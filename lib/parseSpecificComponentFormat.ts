import type { Component } from "./types"

/**
 * Парсит специфический формат компонентов ODB++
 *
 * Пример формата:
 * CMP 2 37.99999766 27.70000048 270 N L3 1K ;0=1,1=0.0000
 * PRP Partnumber 'BLM18HE102SN1D'
 * PRP UID 'BLM18HE102SN1D'
 * PRP Value '1K'
 * TOP 0 37.99999766 26.98999936 90 N 232 17 1
 * TOP 1 37.99999766 28.4100016 270 N 219 1 2
 */
export function parseSpecificComponentFormat(content: string, side: "TOP" | "BOT"): Component[] {
  const components: Component[] = []
  const lines = content.split(/\r?\n/)

  let currentComponent: Partial<Component> | null = null
  let currentProperties: Record<string, string> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Пропускаем пустые строки и комментарии
    if (!line || line.startsWith("#") || line.startsWith("@")) {
      continue
    }

    // Строка с информацией о компоненте
    if (line.startsWith("CMP ")) {
      // Если у нас уже есть компонент, проверяем его параметры и добавляем в список
      if (currentComponent && currentComponent.name) {
        // Проверяем, есть ли у компонента хотя бы одна запись PRP
        const hasPrpRecords = Object.keys(currentProperties).length > 0

        // Проверяем, что у компонента есть значимые параметры
        const hasValidParams = currentComponent.package !== "Unknown" || currentComponent.uid !== "" || hasPrpRecords

        if (hasValidParams) {
          currentComponent.properties = { ...currentProperties }
          components.push(currentComponent as Component)
        } else {
          console.log(`Игнорирование компонента ${currentComponent.name} с пустыми параметрами`)
        }
        currentProperties = {}
      }

      // Парсим строку с компонентом
      // Формат: CMP <порядковый номер> <x> <y> <rotation> N <designator> [остальное игнорируется]
      const parts = line.split(" ")
      if (parts.length >= 7) {
        const x = Number.parseFloat(parts[2]) / 100 // Нормализуем координаты
        const y = Number.parseFloat(parts[3]) / 100
        const rotation = Number.parseFloat(parts[4])
        const designator = parts[6] // Designator компонента

        currentComponent = {
          uid: "", // Будет заполнено из PRP UID
          name: designator, // Используем designator как имя компонента
          package: "Unknown", // Будет обновлено из PRP
          pins: 2, // По умолчанию
          assembled: false,
          side,
          x,
          y,
          rotation,
          properties: {},
        }
      }
    }

    // Строка с свойствами компонента
    else if (line.startsWith("PRP ") && currentComponent) {
      // Корректный парсинг строки PRP
      // Формат: PRP ИмяПараметра 'Значение'

      // Находим первый пробел после "PRP "
      const firstSpaceIndex = line.indexOf(" ", 4)
      if (firstSpaceIndex !== -1) {
        // Извлекаем имя параметра
        const propName = line.substring(4, firstSpaceIndex).trim()

        // Извлекаем значение параметра (может быть в кавычках)
        let propValue = line.substring(firstSpaceIndex + 1).trim()

        // Удаляем кавычки, если они есть
        if (propValue.startsWith("'") && propValue.endsWith("'")) {
          propValue = propValue.substring(1, propValue.length - 1)
        }

        // Сохраняем свойство
        currentProperties[propName] = propValue

        // Обрабатываем специальные свойства
        if (propName === "UID") {
          currentComponent.uid = propValue // Используем UID из файла
        } else if (propName === "Value") {
          // Можно добавить значение как часть имени компонента
          if (currentComponent.name && !currentComponent.name.includes(propValue)) {
            currentComponent.name = `${currentComponent.name} ${propValue}`
          }
        } else if (propName === "Partnumber" && propValue) {
          // Используем Partnumber как package, если он указан
          currentComponent.package = propValue
        }
      }
    }

    // Строка с информацией о выводах компонента
    else if ((line.startsWith("TOP ") || line.startsWith("BOT ")) && currentComponent) {
      // Можно использовать для определения количества выводов
      // Формат: TOP <pin_number> <x> <y> <rotation> <side> <net> <node> <pin_name>
      const pinParts = line.split(" ")
      if (pinParts.length >= 2) {
        const pinNumber = Number.parseInt(pinParts[1])
        // Обновляем количество выводов, если нашли больший номер
        if (pinNumber + 1 > (currentComponent.pins || 0)) {
          currentComponent.pins = pinNumber + 1
        }
      }
    }
  }

  // Добавляем последний компонент, если он есть и имеет непустые параметры или записи PRP
  if (currentComponent && currentComponent.name) {
    // Проверяем, есть ли у компонента хотя бы одна запись PRP
    const hasPrpRecords = Object.keys(currentProperties).length > 0

    // Проверяем, что у компонента есть значимые параметры
    const hasValidParams = currentComponent.package !== "Unknown" || currentComponent.uid !== "" || hasPrpRecords

    if (hasValidParams) {
      currentComponent.properties = { ...currentProperties }
      components.push(currentComponent as Component)
    } else {
      console.log(`Игнорирование компонента ${currentComponent.name} с пустыми параметрами`)
    }
  }

  // Устанавливаем размеры компонентов
  for (const component of components) {
    setComponentDimensions(component)
  }

  return components
}

/**
 * Определяет размеры компонента на основе типа корпуса
 */
function setComponentDimensions(component: Component): void {
  // Определяем размеры компонента на основе типа корпуса
  const packageType = component.package.toUpperCase()

  // Определяем количество выводов
  if (packageType.includes("SOIC")) {
    const match = packageType.match(/SOIC-(\d+)/)
    component.pins = match ? Number.parseInt(match[1]) : 8
    component.width = 20 + component.pins / 2
    component.height = 10
  } else if (packageType.includes("QFP")) {
    const match = packageType.match(/QFP-(\d+)/)
    component.pins = match ? Number.parseInt(match[1]) : 32
    component.width = 20 + component.pins / 8
    component.height = 20 + component.pins / 8
  } else if (packageType.includes("BGA")) {
    const match = packageType.match(/BGA-(\d+)/)
    component.pins = match ? Number.parseInt(match[1]) : 256
    component.width = 40
    component.height = 40
  } else if (packageType.includes("0402")) {
    component.pins = 2
    component.width = 8
    component.height = 4
  } else if (packageType.includes("0603")) {
    component.pins = 2
    component.width = 10
    component.height = 5
  } else if (packageType.includes("0805")) {
    component.pins = 2
    component.width = 12
    component.height = 6
  } else if (packageType.includes("1206")) {
    component.pins = 2
    component.width = 15
    component.height = 7
  } else if (packageType.includes("SOT23")) {
    component.pins = 3
    component.width = 12
    component.height = 8
  } else if (packageType.includes("SOT")) {
    component.pins = 3
    component.width = 12
    component.height = 8
  } else if (packageType.includes("HEADER")) {
    const match = packageType.match(/HEADER-(\d+)X(\d+)/)
    if (match) {
      component.pins = Number.parseInt(match[1]) * Number.parseInt(match[2])
      component.width = Number.parseInt(match[1]) * 5
      component.height = Number.parseInt(match[2]) * 5
    } else {
      component.pins = 2
      component.width = 15
      component.height = 10
    }
  } else {
    // Для неизвестных типов корпусов
    component.pins = 2
    component.width = 15
    component.height = 8
  }

  // Если компонент начинается с определенной буквы, устанавливаем количество выводов
  if (component.name.startsWith("R") || component.name.startsWith("C") || component.name.startsWith("L")) {
    component.pins = 2
  } else if (component.name.startsWith("Q") || component.name.startsWith("T")) {
    component.pins = 3
  } else if (component.name.startsWith("U") || component.name.startsWith("IC")) {
    if (component.pins < 4) {
      component.pins = 8
    }
  }
}
