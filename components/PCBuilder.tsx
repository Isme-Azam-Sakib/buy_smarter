'use client'

import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, CheckCircle, Wrench } from 'lucide-react'

interface Component {
  id: number
  name: string
  category: string
  price: number
  image: string
  specs: Record<string, any>
}

interface BuildComponent {
  component: Component
  quantity: number
}

const mockComponents: Component[] = [
  {
    id: 1,
    name: 'AMD Ryzen 7 7700X',
    category: 'CPU',
    price: 28500,
    image: '/api/placeholder/100/100',
    specs: { socket: 'AM5', cores: 8, threads: 16, tdp: 105 }
  },
  {
    id: 2,
    name: 'NVIDIA GeForce RTX 4070',
    category: 'GPU',
    price: 65000,
    image: '/api/placeholder/100/100',
    specs: { memory: '12GB', tdp: 200 }
  },
  {
    id: 3,
    name: 'Corsair Vengeance LPX 32GB DDR4-3200',
    category: 'RAM',
    price: 12000,
    image: '/api/placeholder/100/100',
    specs: { capacity: '32GB', speed: 3200, type: 'DDR4' }
  }
]

export default function PCBuilder() {
  const [buildComponents, setBuildComponents] = useState<BuildComponent[]>([])
  const [selectedCategory, setSelectedCategory] = useState('CPU')
  const [showComponentSelector, setShowComponentSelector] = useState(false)

  const categories = ['CPU', 'GPU', 'RAM', 'Motherboard', 'PSU', 'Storage', 'Case', 'Cooling']

  const addComponent = (component: Component) => {
    const existingIndex = buildComponents.findIndex(
      item => item.component.id === component.id
    )
    
    if (existingIndex >= 0) {
      const updated = [...buildComponents]
      updated[existingIndex].quantity += 1
      setBuildComponents(updated)
    } else {
      setBuildComponents([...buildComponents, { component, quantity: 1 }])
    }
    setShowComponentSelector(false)
  }

  const removeComponent = (componentId: number) => {
    setBuildComponents(buildComponents.filter(item => item.component.id !== componentId))
  }

  const updateQuantity = (componentId: number, quantity: number) => {
    if (quantity <= 0) {
      removeComponent(componentId)
      return
    }
    
    const updated = buildComponents.map(item =>
      item.component.id === componentId
        ? { ...item, quantity }
        : item
    )
    setBuildComponents(updated)
  }

  const getTotalPrice = () => {
    return buildComponents.reduce(
      (total, item) => total + (item.component.price * item.quantity),
      0
    )
  }

  const checkCompatibility = () => {
    // Mock compatibility check
    const issues = []
    
    if (buildComponents.length === 0) {
      issues.push('No components selected')
    }
    
    const hasCPU = buildComponents.some(item => item.component.category === 'CPU')
    const hasGPU = buildComponents.some(item => item.component.category === 'GPU')
    const hasRAM = buildComponents.some(item => item.component.category === 'RAM')
    const hasMotherboard = buildComponents.some(item => item.component.category === 'Motherboard')
    const hasPSU = buildComponents.some(item => item.component.category === 'PSU')
    
    if (!hasCPU) issues.push('CPU is required')
    if (!hasGPU) issues.push('GPU is required')
    if (!hasRAM) issues.push('RAM is required')
    if (!hasMotherboard) issues.push('Motherboard is required')
    if (!hasPSU) issues.push('Power Supply is required')
    
    return issues
  }

  const compatibilityIssues = checkCompatibility()

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            PC Builder
          </h2>
          <p className="text-xl text-gray-600">
            Build your dream PC with compatibility checking
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Component Selector */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Select Components
                </h3>
                <button
                  onClick={() => setShowComponentSelector(!showComponentSelector)}
                  className="btn-primary flex items-center"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </button>
              </div>

              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Component List */}
              {showComponentSelector && (
                <div className="space-y-3 mb-6">
                  {mockComponents
                    .filter(comp => comp.category === selectedCategory)
                    .map((component) => (
                      <div
                        key={component.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          <img
                            src={component.image}
                            alt={component.name}
                            className="w-12 h-12 object-contain rounded bg-gray-100 mr-3"
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">{component.name}</h4>
                            <p className="text-sm text-gray-500">
                              {Object.entries(component.specs)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(', ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-semibold text-gray-900">
                            ৳{component.price.toLocaleString()}
                          </span>
                          <button
                            onClick={() => addComponent(component)}
                            className="btn-primary text-sm py-1 px-3"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Current Build */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Current Build</h4>
                {buildComponents.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No components selected. Click "Add Component" to start building.
                  </p>
                ) : (
                  buildComponents.map((item) => (
                    <div
                      key={item.component.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <img
                          src={item.component.image}
                          alt={item.component.name}
                          className="w-10 h-10 object-contain rounded bg-white mr-3"
                        />
                        <div>
                          <h5 className="font-medium text-gray-900">
                            {item.component.name}
                          </h5>
                          <p className="text-sm text-gray-500">
                            {item.component.category}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.component.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.component.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-semibold text-gray-900 w-20 text-right">
                          ৳{(item.component.price * item.quantity).toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeComponent(item.component.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Build Summary */}
          <div className="lg:col-span-1">
            <div className="card sticky top-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                Build Summary
              </h3>

              {/* Compatibility Check */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Compatibility</h4>
                {compatibilityIssues.length === 0 ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    <span className="text-sm">All components compatible</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {compatibilityIssues.map((issue, index) => (
                      <div key={index} className="flex items-center text-red-600">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        <span className="text-sm">{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-medium text-gray-900">Total Price</span>
                  <span className="text-2xl font-bold text-primary-600">
                    ৳{getTotalPrice().toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {buildComponents.map((item) => (
                    <div key={item.component.id} className="flex justify-between">
                      <span>{item.component.name} x{item.quantity}</span>
                      <span>৳{(item.component.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button className="w-full btn-primary">
                  <Wrench className="h-4 w-4 mr-2" />
                  Get AI Recommendations
                </button>
                <button className="w-full btn-secondary">
                  Save Build
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
