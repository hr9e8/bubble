import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import {
  ArrowRight,
  ClipboardCheck,
  DatabaseZap,
  FileSearch,
  FileSpreadsheet,
  GitBranch,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { migrationStages } from '../lib/domain'

export const Route = createFileRoute('/admin/migration')({ component: MigrationPage })

const workflowSteps = [
  {
    icon: FileSearch,
    title: 'Profile CSV exports',
    command: 'pnpm data:profile -- data-example',
    detail: 'Lists canonical and variant CSV files, row counts, column counts, and headers before any database write.',
  },
  {
    icon: DatabaseZap,
    title: 'Import raw rows',
    command: 'pnpm data:import -- --dir=data-example',
    detail: 'Creates a Bubble import batch, stores source rows as raw JSON, and extracts Bubble relationship tokens.',
  },
  {
    icon: RotateCw,
    title: 'Transform managed tables',
    command: 'pnpm data:transform -- --batch=<batch-id>',
    detail: 'Resets migration-managed tables, normalizes users, products, shipping setup, customers, orders, stock lots, and stock movements.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review status',
    command: 'pnpm data:status',
    detail: 'Shows the latest batch, source counts, raw row totals, and relationship token totals for operational checks.',
  },
]

function MigrationPage() {
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId })

  if (activeRouteId !== Route.id) {
    return <Outlet />
  }

  return (
    <div className="app-page">
      <section className="page-header">
        <h1 className="page-title">Bubble migration</h1>
        <p className="page-description">
          Track the scripted Bubble import pipeline from CSV profiling through raw staging, normalized transforms, and reconciliation reports.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {migrationStages.map((stage) => (
          <article key={stage.name} className="metric-card">
            <Badge tone={stage.state === 'Scripted' ? 'success' : 'neutral'}>{stage.state}</Badge>
            <h2 className="section-heading mt-4">{stage.name}</h2>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="section-card">
          <FileSpreadsheet className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Profiling and staging</h2>
          <p className="section-muted mt-1">Profile canonical and variant CSV exports, then preserve every source row as raw JSON with Bubble IDs, slugs, file names, and row indexes.</p>
        </article>
        <article className="section-card">
          <GitBranch className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Import relationships</h2>
          <p className="section-muted mt-1">Extract Bubble list tokens into relationship rows with source columns and target hints so unresolved references stay traceable by batch.</p>
        </article>
        <article className="section-card">
          <ShieldCheck className="h-5 w-5 text-[#008060]" />
          <h2 className="section-heading mt-4">Reconciliation</h2>
          <p className="section-muted mt-1">Compare source counts to transformed tables, flag order total differences, orphan checks, stock mismatches, payment status differences, and skipped rows.</p>
          <Link to="/admin/migration/reconciliation" className="app-link mt-4 inline-flex items-center gap-1 text-sm">
            Open <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </section>

      <section>
        <h2 className="section-heading">Operational workflow</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          {workflowSteps.map((step) => {
            const Icon = step.icon
            return (
              <article key={step.title} className="rounded-lg border border-[#e3e3e3] bg-[#f7f7f7] p-4">
                <Icon className="h-5 w-5 text-[#008060]" />
                <h3 className="mt-3 text-sm font-semibold text-[#202223]">{step.title}</h3>
                <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs text-[#3d3d3d]">
                  {step.command}
                </code>
                <p className="section-muted mt-3 text-sm">{step.detail}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-[#c9cccf] bg-white p-8 text-center shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <ShieldCheck className="mx-auto h-8 w-8 text-[#616161]" />
        <h2 className="section-heading mt-4">Transform writes reconciliation reports</h2>
        <p className="section-muted mx-auto mt-1 max-w-xl">
          The transform script writes entity counts, total mismatches, orphan checks, stock mismatches, payment status comparisons, and skipped-row summaries for the active batch.
        </p>
      </section>
    </div>
  )
}
