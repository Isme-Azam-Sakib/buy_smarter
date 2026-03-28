// Category definitions with icons and labels
export interface Category {
  id: string
  name: string
  icon: string
  description: string
  color: string
}

export const CATEGORIES: Category[] = [
  {
    id: 'processor',
    name: 'Processors',
    icon: 'Cpu',
    description: 'Intel & AMD CPUs',
    color: 'blue'
  },
  {
    id: 'graphics-card',
    name: 'Graphics Cards',
    icon: 'Monitor',
    description: 'NVIDIA & AMD GPUs',
    color: 'purple'
  },
  {
    id: 'ram',
    name: 'RAM',
    icon: 'MemoryStick',
    description: 'Memory Modules',
    color: 'green'
  },
  {
    id: 'ssd',
    name: 'SSD',
    icon: 'HardDrive',
    description: 'Solid State Drives',
    color: 'orange'
  },
  {
    id: 'motherboard',
    name: 'Motherboards',
    icon: 'CircuitBoard',
    description: 'Mainboards',
    color: 'red'
  },
  {
    id: 'power-supply',
    name: 'Power Supplies',
    icon: 'Zap',
    description: 'PSUs',
    color: 'yellow'
  },
  {
    id: 'cpu-cooler',
    name: 'CPU Coolers',
    icon: 'Wind',
    description: 'Cooling Solutions',
    color: 'cyan'
  }
]

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(cat => cat.id === id)
}

export function getCategoryColor(id: string): string {
  const category = getCategoryById(id)
  return category?.color || 'gray'
}

