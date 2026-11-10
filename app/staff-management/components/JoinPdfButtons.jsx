'use client'
// Download / Share everything someone sent on their join link as one PDF
// (lib/hires/joinPdf.js) — on the new hire sheet and on the staff record.
import { useEffect, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Button, toast } from '@/app/components/ui'
import { getLetter } from '@/lib/hires/client'
import { hireName } from '@/lib/hires/model'
import { joinPdf, saveBlob, shareBlob } from '@/lib/hires/joinPdf'
import { letterForHire } from '@/app/tools/appointment-letter/letterForHire'
import { roleLabelOf } from '../lib/constants'

export default function JoinPdfButtons ({ hire, companyId, branchId, company, currency }) {
  const [busy, setBusy] = useState(null) // 'download' | 'share'
  const made = useRef(null) // { key, result } — made once per hire as it stands
  const key = hire ? `${hire.id}:${hire.submittedAt || ''}:${hire.status}` : ''
  useEffect(() => { made.current = null }, [key])

  const build = async () => {
    if (made.current?.key === key) return made.current.result
    let letter = null
    if (hire.letterReady) {
      const saved = await getLetter(companyId, branchId, hire.id)
      if (saved) letter = await letterForHire(saved, { details: hire.details || hire, signed: hire.signed, currency }).blob.arrayBuffer()
    }
    const result = await joinPdf(hire, { company, letter, role: roleLabelOf(hire.role) })
    made.current = { key, result }
    if (result.missed.length) toast.warning(`Couldn't add: ${result.missed.join(', ')}`, { description: 'Open those in the app instead.' })
    return result
  }

  const run = async how => {
    setBusy(how)
    try {
      const { blob, fileName } = await build()
      if (how === 'download') {
        saveBlob(blob, fileName)
        toast.success('PDF saved')
      } else {
        const r = await shareBlob(blob, fileName, hireName(hire))
        if (r === 'saved') toast.success('PDF saved', { description: 'Attach it in WhatsApp or email.' })
        if (r === 'again') toast.info('PDF ready — tap Share again')
      }
    } catch (err) {
      console.error(err)
      toast.error("Couldn't make the PDF", { description: err?.message })
    } finally {
      setBusy(null)
    }
  }

  if (!hire) return null
  return (
    <div className='flex flex-wrap gap-2'>
      <Button size='sm' variant='secondary' icon={Download} loading={busy === 'download'} disabled={!!busy} onClick={() => run('download')}>Download PDF</Button>
      <Button size='sm' variant='secondary' icon={Share2} loading={busy === 'share'} disabled={!!busy} onClick={() => run('share')}>Share</Button>
    </div>
  )
}
