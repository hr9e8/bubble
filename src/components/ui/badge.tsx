import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-[#ebebeb] text-[#616161]',
  success: 'bg-[#eaf4ee] text-[#006e52]',
  warning: 'bg-[#fff5ea] text-[#8a6116]',
  danger: 'bg-[#fff0f0] text-[#d72c0d]',
  info: 'bg-[#eef4ff] text-[#2c5cc5]',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold leading-none', tones[tone])}>
      {children}
    </span>
  )
}
