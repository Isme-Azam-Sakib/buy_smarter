// Utility functions for the CPU products application

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-BD', {
    style: 'decimal',
    minimumFractionDigits: 0
  }).format(price) + ' BDT'
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function getBrandColor(brand: string): string {
  const colors: { [key: string]: string } = {
    'Intel': 'bg-blue-100 text-blue-800 border-blue-200',
    'AMD': 'bg-red-100 text-red-800 border-red-200',
    'default': 'bg-gray-100 text-gray-800 border-gray-200'
  }
  return colors[brand] || colors.default
}

export function getAvailabilityColor(status: string): string {
  const colors: { [key: string]: string } = {
    'in_stock': 'text-green-600 bg-green-100',
    'out_of_stock': 'text-red-600 bg-red-100',
    'limited': 'text-yellow-600 bg-yellow-100',
    'pre_order': 'text-blue-600 bg-blue-100'
  }
  return colors[status] || colors['in_stock']
}

export function getAvailabilityText(status: string): string {
  const texts: { [key: string]: string } = {
    'in_stock': 'In Stock',
    'out_of_stock': 'Out of Stock',
    'limited': 'Limited Stock',
    'pre_order': 'Pre-order'
  }
  return texts[status] || 'In Stock'
}

export function getVendorLogo(vendorName: string): string {
  const logoMap: { [key: string]: string } = {
    'Star Tech': '/assets/startech.png',
    'Techland BD': '/assets/techland.png',
    'Ultra Technology': '/assets/ultratech.png',
    'Skyland Computer BD': '/assets/skyland.png',
    'PC House': '/assets/images.jpg'
  }
  return logoMap[vendorName] || '/assets/images.jpg'
}

export function getVendorDisplayName(vendorName: string): string {
  const displayNames: { [key: string]: string } = {
    'Star Tech': 'Star Tech',
    'Techland BD': 'Techland BD',
    'Ultra Technology': 'Ultra Tech',
    'Skyland Computer BD': 'Skyland',
    'PC House': 'PC House'
  }
  return displayNames[vendorName] || vendorName
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
