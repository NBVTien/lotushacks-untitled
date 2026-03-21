import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, Loader2, StickyNote } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const INITIAL_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
]

function getInitialColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return INITIAL_COLORS[Math.abs(hash) % INITIAL_COLORS.length]
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleAddNote()
    }
  }

  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" />
          Notes
          {notes.length > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary">
              {notes.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="Add a note about this candidate..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="text-sm pr-2 resize-none focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/60">
              {text.trim() ? '⌘+Enter to submit' : ''}
            </span>
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
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
            <StickyNote className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No notes yet</p>
            <p className="text-xs">Add the first note above</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {sortedNotes.map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                >
                  {/* Author avatar */}
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getInitialColor(note.authorName)}`}
                  >
                    {getInitials(note.authorName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold">{note.authorName}</span>
                      <span className="text-[10px] text-muted-foreground">{relativeTime(note.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{note.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
