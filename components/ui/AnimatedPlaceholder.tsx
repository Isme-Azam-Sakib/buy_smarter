'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AnimatedPlaceholderProps {
  questions: string[]
  className?: string
}

export default function AnimatedPlaceholder({ questions, className = '' }: AnimatedPlaceholderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (questions.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % questions.length)
    }, 3000) // Change every 3 seconds

    return () => clearInterval(interval)
  }, [questions.length])

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="inline-block"
        >
          {questions[currentIndex] || questions[0]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

