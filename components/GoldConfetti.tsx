'use client'

import { useEffect, useState } from 'react'

interface Piece {
  id: number
  x: number
  size: number
  delay: number
  duration: number
  rotation: number
  shape: 'rect' | 'circle' | 'star'
  color: string
}

const COLORS = ['#F4B942', '#FFD700', '#FFF7E0', '#e0a030', '#ffffff', '#F4B942', '#F4B942']

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a)
}

function generatePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: randomBetween(0, 100),
    size: randomBetween(6, 14),
    delay: randomBetween(0, 1.2),
    duration: randomBetween(2.2, 3.8),
    rotation: randomBetween(0, 360),
    shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
}

interface Props {
  trigger: boolean
  onDone?: () => void
}

export default function GoldConfetti({ trigger, onDone }: Props) {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!trigger) return
    setPieces(generatePieces(80))
    setVisible(true)

    const timer = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 4500)

    return () => clearTimeout(timer)
  }, [trigger])

  if (!visible || pieces.length === 0) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 9999 }}
    >
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: '-20px',
            width: p.shape === 'rect' ? p.size : p.size,
            height: p.shape === 'rect' ? p.size * 0.5 : p.size,
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'rect' ? '2px' : '0',
            background: p.shape === 'star' ? 'transparent' : p.color,
            color: p.color,
            fontSize: p.shape === 'star' ? `${p.size * 1.4}px` : undefined,
            lineHeight: 1,
            transform: `rotate(${p.rotation}deg)`,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            opacity: 0,
          }}
        >
          {p.shape === 'star' ? '★' : null}
        </div>
      ))}

      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0px) rotate(0deg); opacity: 1; }
          20%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
