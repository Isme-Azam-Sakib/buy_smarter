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

export function getTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)
  
  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  if (diffWeeks === 1) return '1 week ago'
  if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`
  if (diffMonths === 1) return '1 month ago'
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`
  if (diffYears === 1) return '1 year ago'
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`
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
    'pre_order': 'text-blue-600 bg-blue-100',
    'upcoming': 'text-orange-600 bg-orange-100'
  }
  return colors[status] || colors['in_stock']
}

export function getAvailabilityText(status: string): string {
  const texts: { [key: string]: string } = {
    'in_stock': 'In Stock',
    'out_of_stock': 'Out of Stock',
    'limited': 'Limited Stock',
    'pre_order': 'Pre-order',
    'upcoming': 'Up Coming'
  }
  return texts[status] || 'In Stock'
}

export function getVendorLogo(vendorName: string): string | null {
  const normalizedName = vendorName.toLowerCase()
  const logoMap: { [key: string]: string } = {
    'star tech': '/assets/startech.png',
    'startech': '/assets/startech.png',
    'techland': '/assets/techland.png',
    'techland bd': '/assets/techland.png',
    'ultra technology': '/assets/ultratech.png',
    'ultra tech': '/assets/ultratech.png',
    'ultratech': '/assets/ultratech.png',
    'skyland': '/assets/skyland.png',
    'skyland computer bd': '/assets/skyland.png',
    'pc house': '/assets/images.jpg',
    'pc house bd': '/assets/images.jpg'
  }
  return logoMap[normalizedName] || null
}

export function getVendorDisplayName(vendorName: string): string {
  const normalizedName = vendorName.toLowerCase()
  const displayNames: { [key: string]: string } = {
    'star tech': 'STAR TECH',
    'startech': 'STAR TECH',
    'techland': 'TECH LAND',
    'techland bd': 'TECH LAND',
    'ultra technology': 'ULTRA TECH',
    'ultra tech': 'ULTRA TECH',
    'ultratech': 'ULTRA TECH',
    'skyland': 'SKY LAND',
    'skyland computer bd': 'SKY LAND',
    'pc house': 'PC HOUSE BD',
    'pc house bd': 'PC HOUSE BD'
  }
  return displayNames[normalizedName] || vendorName.toUpperCase()
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
