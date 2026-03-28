'use client'

interface VendorLogoProps {
  src: string
  alt: string
}

export default function VendorLogo({ src, alt }: VendorLogoProps) {
  return (
    <div className="h-auto w-full flex items-center">
      <img
        src={src}
        alt={alt}
        className="h-full w-auto object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.src = '/assets/images.jpg'
        }}
      />
    </div>
  )
}

