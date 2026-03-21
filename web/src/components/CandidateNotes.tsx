import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { candidatesApi } from '@/lib/api'
import type { CandidateNote } from '@lotushack/shared'

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

interface CandidateNotesProps {
  jobId: string
  candidateId: string
  notes: CandidateNote[]
  onNotesUpdate: (notes: CandidateNote[]) => void
}

export function CandidateNotes({ jobId, candidateId, notes, onNotesUpdate }: CandidateNotesProps) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleAddNote = async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    setSubmitting(true)
    try {
      const updated = await candidatesApi.addNote(jobId, candidateId, trimmed)
      onNotesUpdate(updated.notes)
      setText('')
      toast.success('Note added')
    } catch {
      toast.error('Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Notes ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note about this candidate..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={submitting || !text.trim()}
              className="gap-1.5"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Add Note
            </Button>
          </div>
        </div>

        {/* Notes list */}
        {sortedNotes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No notes yet. Add the first note above.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border bg-muted/30 p-3 transition-colors dark:bg-muted/10"
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.text}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">{note.authorName}</span>
                  <span>&middot;</span>
                  <span>{relativeTime(note.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
