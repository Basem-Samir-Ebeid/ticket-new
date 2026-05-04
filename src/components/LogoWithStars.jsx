import { useState, useCallback } from 'react'

export default function LogoWithStars({ className = '', imgClassName = '' }) {
  const [stars, setStars] = useState([])

  const handleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const id = Date.now()
    const count = 18
    const newStars = Array.from({ length: count }, (_, i) => ({
      id: `${id}-${i}`,
      cx,
      cy,
      angle: (360 / count) * i + Math.random() * 20 - 10,
      speed: 2.5 + Math.random() * 3,
      size: 4 + Math.random() * 6,
      color: ['#facc15','#a78bfa','#38bdf8','#34d399','#fb923c','#f472b6'][Math.floor(Math.random()*6)],
      opacity: 1,
    }))
    setStars(prev => [...prev, ...newStars])
    setTimeout(() => {
      setStars(prev => prev.filter(s => !s.id.startsWith(String(id))))
    }, 1000)
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

function StarParticle({ cx, cy, angle, speed, size, color }) {
  const rad = (angle * Math.PI) / 180
  const tx = Math.cos(rad) * speed * 60
  const ty = Math.sin(rad) * speed * 60 + 40

  return (
    <span
      style={{
        position: 'fixed',
        left: cx,
        top: cy,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 9999,
        transform: 'translate(-50%, -50%)',
        animation: 'starFall 0.9s ease-out forwards',
        '--tx': `${tx}px`,
        '--ty': `${ty}px`,
        fontSize: size,
        lineHeight: 1,
      }}
    >
      ★
    </span>
  )
}
