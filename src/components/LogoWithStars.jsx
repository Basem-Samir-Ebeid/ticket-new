import { useRef, useCallback, useEffect } from 'react'

export default function LogoWithStars({ className = '', imgClassName = '' }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const starsRef = useRef([])
  const activeRef = useRef(false)

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }, [])

  useEffect(() => {
    initCanvas()
    window.addEventListener('resize', initCanvas)
    return () => window.removeEventListener('resize', initCanvas)
  }, [initCanvas])

  const spawnStars = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const count = 80
    starsRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      speed: 3 + Math.random() * 5,
      size: 8 + Math.random() * 12,
      opacity: 0.7 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.8,
      color: ['#FFD700', '#FFC200', '#FFE066', '#F5C518', '#FFDF00'][Math.floor(Math.random() * 5)],
    }))
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    let allDone = true
    starsRef.current.forEach(s => {
      s.y += s.speed
      s.x += s.drift
      if (s.y < canvas.height + 20) allDone = false

      ctx.save()
      ctx.globalAlpha = s.opacity * Math.max(0, 1 - s.y / (canvas.height * 1.1))
      ctx.font = `${s.size}px serif`
      ctx.fillStyle = s.color
      ctx.shadowColor = s.color
      ctx.shadowBlur = 10
      ctx.fillText('★', s.x, s.y)
      ctx.restore()
    })

    if (!allDone) {
      animRef.current = requestAnimationFrame(animate)
    } else {
      activeRef.current = false
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  const handleClick = useCallback(() => {
    if (activeRef.current) {
      cancelAnimationFrame(animRef.current)
      const canvas = canvasRef.current
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    }
    activeRef.current = true
    spawnStars()
    animRef.current = requestAnimationFrame(animate)
  }, [spawnStars, animate])

  useEffect(() => () => cancelAnimationFrame(animRef.current), [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          pointerEvents: 'none', zIndex: 9999,
          width: '100vw', height: '100vh',
        }}
      />
      <div className={`relative cursor-pointer select-none ${className}`} onClick={handleClick}>
        <img src="/logo.png" alt="Logo" className={imgClassName} />
      </div>
    </>
  )
}
