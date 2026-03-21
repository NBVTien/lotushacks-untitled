import { cn } from '@/lib/utils'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-500'
  if (score >= 60) return 'text-blue-500'
  if (score >= 40) return 'text-amber-500'
  return 'text-red-500'
}

export function ScoreRing({ score, size = 100, strokeWidth = 8, className }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('animate-score-fill transition-all duration-1000', getScoreColor(score))}
          style={{ '--score-offset': offset } as React.CSSProperties}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('font-bold', getScoreColor(score))} style={{ fontSize: size * 0.28 }}>{score}</span>
        {size >= 80 && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Score
          </span>
        )}
      </div>
    </div>
  )
}
