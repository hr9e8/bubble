import type { ComponentProps, ReactNode } from 'react'
import { ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '../../lib/utils'

export function ChartContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('h-72 w-full rounded-xl border border-[#dedede] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]', className)}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

export function ChartTooltip(props: ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      cursor={{ fill: 'rgba(15, 23, 42, 0.06)' }}
      contentStyle={{
        borderRadius: 8,
        border: '1px solid #dedede',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
      }}
      {...props}
    />
  )
}
