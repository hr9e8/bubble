import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Badge } from './ui/badge'

type ModulePageProps = {
  title: string
  description: string
  badge?: string
  primaryAction?: string
  sections: Array<{
    title: string
    detail: string
    href?: string
  }>
}

export function ModulePage({ title, description, badge, primaryAction, sections }: ModulePageProps) {
  return (
    <div className="app-page">
      <section className="page-header-row">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {badge ? <Badge tone="info">{badge}</Badge> : null}
          {primaryAction ? (
            <button className="polaris-button polaris-button-primary">
              {primaryAction} <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <article key={section.title} className="section-card">
            <div className="flex items-start justify-between gap-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#008060]" />
              <Badge tone="neutral">Phase 1</Badge>
            </div>
            <h2 className="section-heading mt-4">{section.title}</h2>
            <p className="section-muted mt-1">{section.detail}</p>
            {section.href ? (
              <a href={section.href} className="app-link mt-4 inline-flex items-center gap-1 text-sm">
                Open <ArrowRight className="h-4 w-4" />
              </a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  )
}
