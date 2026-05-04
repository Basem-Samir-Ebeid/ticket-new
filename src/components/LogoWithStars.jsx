import { useState, useCallback } from 'react'

const GOLD_COLORS = ['#FFD700', '#FFC200', '#FFB800', '#FFDF00', '#F5C518', '#FFE066', '#FFA500']

export default function LogoWithStars({ className = '', imgClassName = '' }) {
  const [stars, setStars] = useState([])

  const handleClick = useCallback(() => {
    const id = Date.now()
    const count = 30
    const newStars = Array.from({ length: count }, (_, i) => ({
      id: `${id}-${i}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.4 + Math.random() * 1.2,
      size: 10 + Math.random() * 14,
      color: GOLD_COLORS[Math.floor(Math.random() * GOLD_COLORS.length)],
      drift: (Math.random() - 0.5) * 60,
      spin: Math.random() * 360,
    }))
    setStars(prev => [...prev, ...newStars])
    setTimeout(() => {
      setStars(prev => prev.filter(s => !s.id.startsWith(String(id))))
    }, 3000)
  }, [])

  return (
    <>
      <div className={`relative cursor-pointer select-none ${className}`} onClick={handleClick}>
        <img src="/logo.png" alt="Logo" className={imgClassName} />
      </div>
      {stars.map(star => (
        <StarParticle key={star.id} {...star} />
      ))}
    </>
  )
}

function StarParticle({ left, delay, duration, size, color, drift, spin }) {
  return (
    <span
      style={{
        position: 'fixed',
        left: `${left}%`,
        top: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        fontSize: `${size}px`,
        lineHeight: 1,
        color,
        textShadow: `0 0 8px ${color}, 0 0 16px ${color}88`,
        animation: `starFall ${duration}s ease-in ${delay}s forwards`,
        '--drift': `${drift}px`,
        '--spin': `${spin}deg`,
      }}
    >
      ★
    </span>
  )
}
