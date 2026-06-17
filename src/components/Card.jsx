import React from 'react'

export function Card({ children, className = '', variant = 'default', hoverable = true, accent = null, ...props }) {
  const baseClasses = 'glass-card rounded-lg p-6'
  const hoverClass = hoverable ? 'hover:shadow-lg hover:border-blue-300' : ''
  const accentClass = accent ? `accent-bar-${accent} pl-4` : ''
  const variants = {
    default: 'bg-white border border-slate-200',
    elevated: 'bg-slate-50 border border-slate-300 shadow-md',
    subtle: 'bg-slate-100 border-0',
  }
  
  return (
    <div className={`${baseClasses} ${variants[variant]} ${hoverClass} ${accentClass} ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`mb-4 pb-4 border-b border-slate-200 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', as: As = 'h2', ...props }) {
  return (
    <As className={`text-lg font-bold text-slate-900 ${className}`} {...props}>
      {children}
    </As>
  )
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`text-sm text-slate-600 mt-1 ${className}`} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`space-y-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`mt-6 pt-6 border-t border-slate-200 flex gap-3 ${className}`} {...props}>
      {children}
    </div>
  )
}
