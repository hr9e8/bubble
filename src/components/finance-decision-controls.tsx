import { useServerFn } from '@tanstack/react-start'
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { holdPayment, rejectPayment, verifyPayment } from '../lib/finance.functions'

type FinanceDecisionControlsProps = {
  orderId: string
  compact?: boolean
  onDecision: () => Promise<void>
}

export function FinanceDecisionControls({ orderId, compact = false, onDecision }: FinanceDecisionControlsProps) {
  const verify = useServerFn(verifyPayment)
  const reject = useServerFn(rejectPayment)
  const hold = useServerFn(holdPayment)
  const [remarks, setRemarks] = useState('')
  const [rejectedReason, setRejectedReason] = useState('')
  const [financeHoldReason, setFinanceHoldReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function runDecision(action: 'verified' | 'rejected' | 'finance_hold') {
    setIsSubmitting(true)
    setError(null)

    try {
      if (action === 'verified') {
        await verify({ data: { orderId, remarks: remarks || undefined } })
      } else if (action === 'finance_hold') {
        await hold({
          data: {
            orderId,
            financeHoldReason: financeHoldReason.trim(),
            remarks: remarks || undefined,
          },
        })
      } else {
        await reject({
          data: {
            orderId,
            rejectedReason: rejectedReason.trim(),
            remarks: remarks || undefined,
          },
        })
      }

      setRemarks('')
      setRejectedReason('')
      setFinanceHoldReason('')
      await onDecision()
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Unable to save finance decision.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runDecision('verified')
  }

  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-3'}>
      {error ? <p className="form-error">{error}</p> : null}
      <form className={compact ? 'grid gap-2' : 'grid gap-3'} onSubmit={handleVerify}>
        <label className="form-field">
          <span className="form-label">Review remarks</span>
          <textarea
            className={compact ? 'form-textarea min-h-20' : 'form-textarea'}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Proof amount, bank reference, reviewer notes"
          />
        </label>
        <div className={compact ? 'grid gap-2 xl:grid-cols-2' : 'grid gap-3'}>
          <label className="form-field">
            <span className="form-label">Hold reason</span>
            <input
              className="form-input"
              value={financeHoldReason}
              onChange={(event) => setFinanceHoldReason(event.target.value)}
              placeholder="Missing proof, mismatch, duplicate check"
            />
          </label>
          <label className="form-field">
            <span className="form-label">Reject reason</span>
            <input
              className="form-input"
              value={rejectedReason}
              onChange={(event) => setRejectedReason(event.target.value)}
              placeholder="Invalid proof, wrong amount, expired receipt"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="polaris-button polaris-button-primary" type="submit" disabled={isSubmitting}>
            <CheckCircle2 className="h-4 w-4" /> Verify
          </button>
          <button
            className="polaris-button polaris-button-secondary"
            type="button"
            disabled={isSubmitting || !financeHoldReason.trim()}
            onClick={() => void runDecision('finance_hold')}
          >
            <ShieldAlert className="h-4 w-4" /> Hold
          </button>
          <button
            className="polaris-button polaris-button-critical"
            type="button"
            disabled={isSubmitting || !rejectedReason.trim()}
            onClick={() => void runDecision('rejected')}
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
      </form>
    </div>
  )
}
