import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { MatchResult } from '@lotushack/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillDimension {
  name: string
  candidateScore: number // 0-100
  requiredScore: number  // 0-100
}

interface SkillRadarProps {
  skills: SkillDimension[]
  /** viewBox size (square) */
  size?: number
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const RINGS = 4 // concentric rings (25%, 50%, 75%, 100%)

/** Convert a skill index + score (0-100) into SVG x,y.
 *  Angle 0 starts at top (12 o'clock) and goes clockwise. */
function polarToXY(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number,
): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
}

function buildPolygonPoints(
  cx: number,
  cy: number,
  maxRadius: number,
  scores: number[],
): string {
  return scores
    .map((score, i) => {
      const r = (score / 100) * maxRadius
      const [x, y] = polarToXY(cx, cy, r, i, scores.length)
      return `${x},${y}`
    })
    .join(' ')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillRadar({ skills, size = 400 }: SkillRadarProps) {
  const padding = 60
  const cx = size / 2
  const cy = size / 2
  const maxRadius = (size - padding * 2) / 2 // leave room for labels
  const n = skills.length

  // Pre-compute ring & axis geometry
  const rings = useMemo(
    () =>
      Array.from({ length: RINGS }, (_, i) => {
        const r = (maxRadius * (i + 1)) / RINGS
        const pts = Array.from({ length: n }, (__, j) => {
          const [x, y] = polarToXY(cx, cy, r, j, n)
          return `${x},${y}`
        }).join(' ')
        return { r, pts }
      }),
    [cx, cy, maxRadius, n],
  )

  const candidatePoints = useMemo(
    () => buildPolygonPoints(cx, cy, maxRadius, skills.map((s) => s.candidateScore)),
    [cx, cy, maxRadius, skills],
  )

  const requiredPoints = useMemo(
    () => buildPolygonPoints(cx, cy, maxRadius, skills.map((s) => s.requiredScore)),
    [cx, cy, maxRadius, skills],
  )

  // Label positions — pushed slightly further out than maxRadius
  const labels = useMemo(
    () =>
      skills.map((s, i) => {
        const [x, y] = polarToXY(cx, cy, maxRadius + 35, i, n)
        // Determine text-anchor based on position relative to center
        let anchor: 'start' | 'middle' | 'end' = 'middle'
        if (x < cx - 10) anchor = 'end'
        else if (x > cx + 10) anchor = 'start'
        return { ...s, x, y, anchor }
      }),
    [cx, cy, maxRadius, n, skills],
  )

  if (n < 3) return null // need at least 3 axes for a radar

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`-60 -20 ${size + 120} ${size + 40}`}
        width="100%"
        className="max-w-[480px]"
        aria-label="Skill radar chart"
      >
        {/* ---------- Grid rings (polygons) ---------- */}
        {rings.map((ring, i) => (
          <polygon
            key={`ring-${i}`}
            points={ring.pts}
            fill="none"
            stroke="currentColor"
            strokeWidth={i === RINGS - 1 ? 1.2 : 0.6}
            className="text-border"
            opacity={0.5}
          />
        ))}

        {/* ---------- Axis lines from center to each vertex ---------- */}
        {skills.map((_, i) => {
          const [x, y] = polarToXY(cx, cy, maxRadius, i, n)
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth={0.6}
              className="text-border"
              opacity={0.5}
            />
          )
        })}

        {/* ---------- Dot at each ring-axis intersection ---------- */}
        {rings.map((ring, ri) =>
          skills.map((_, si) => {
            const [x, y] = polarToXY(cx, cy, ring.r, si, n)
            return (
              <circle
                key={`dot-${ri}-${si}`}
                cx={x}
                cy={y}
                r={1.5}
                className="fill-border"
                opacity={0.4}
              />
            )
          }),
        )}

        {/* ---------- Required polygon (dashed, red/gray) ---------- */}
        <motion.polygon
          points={requiredPoints}
          fill="rgba(239, 68, 68, 0.08)"
          stroke="rgba(239, 68, 68, 0.6)"
          strokeWidth={1.8}
          strokeDasharray="6 3"
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* ---------- Candidate polygon (blue, filled) ---------- */}
        <motion.polygon
          points={candidatePoints}
          fill="rgba(59, 130, 246, 0.18)"
          stroke="rgba(59, 130, 246, 0.85)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* ---------- Data point dots on candidate polygon ---------- */}
        {skills.map((s, i) => {
          const r = (s.candidateScore / 100) * maxRadius
          const [x, y] = polarToXY(cx, cy, r, i, n)
          return (
            <motion.circle
              key={`cd-${i}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="rgba(59, 130, 246, 1)"
              stroke="white"
              strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.05 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          )
        })}

        {/* ---------- Axis labels ---------- */}
        {labels.map((l, i) => (
          <text
            key={`label-${i}`}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            dominantBaseline="central"
            className="fill-foreground text-[12px] font-medium"
          >
            <title>{l.name}</title>
            {l.name.length > 16 ? l.name.slice(0, 15) + '…' : l.name}
          </text>
        ))}

        {/* ---------- Ring value labels (right side) ---------- */}
        {rings.map((ring, i) => (
          <text
            key={`val-${i}`}
            x={cx + 4}
            y={cy - ring.r - 2}
            className="fill-muted-foreground text-[9px]"
            textAnchor="start"
          >
            {((i + 1) * 100) / RINGS}
          </text>
        ))}
      </svg>

      {/* ---------- Legend ---------- */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm bg-blue-500/70" />
          Candidate
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-5 rounded-sm border border-dashed border-red-400"
            style={{ background: 'rgba(239,68,68,0.08)' }}
          />
          Required
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: extract radar data from candidate match result + job requirements
// ---------------------------------------------------------------------------

/** Common tech skill keywords to look for in strengths/gaps/requirements */
const SKILL_PATTERNS: [RegExp, string][] = [
  [/\bpython\b/i, 'Python'],
  [/\btypescript\b/i, 'TypeScript'],
  [/\bjavascript\b/i, 'JavaScript'],
  [/\bjava\b(?!\s*script)/i, 'Java'],
  [/\breact\b/i, 'React'],
  [/\bangular\b/i, 'Angular'],
  [/\bvue\b/i, 'Vue'],
  [/\bnode\.?js\b/i, 'Node.js'],
  [/\bnest\.?js\b/i, 'NestJS'],
  [/\bnext\.?js\b/i, 'Next.js'],
  [/\bgolang\b|\bgo\b/i, 'Go'],
  [/\brust\b/i, 'Rust'],
  [/\bc\+\+\b/i, 'C++'],
  [/\bc#\b|\.net\b/i, 'C# / .NET'],
  [/\bswift\b/i, 'Swift'],
  [/\bkotlin\b/i, 'Kotlin'],
  [/\bruby\b/i, 'Ruby'],
  [/\bphp\b/i, 'PHP'],
  [/\bsql\b|\bpostgres\b|\bmysql\b|\bdatabase\b/i, 'Database/SQL'],
  [/\bmongo\b/i, 'MongoDB'],
  [/\bredis\b/i, 'Redis'],
  [/\bdocker\b|\bcontainer\b/i, 'Docker'],
  [/\bkubernetes\b|\bk8s\b/i, 'Kubernetes'],
  [/\baws\b|\bazure\b|\bgcp\b|\bcloud\b/i, 'Cloud'],
  [/\bci[\s/]*cd\b|\bdevops\b/i, 'CI/CD'],
  [/\bgit\b/i, 'Git'],
  [/\bhtml\b|\bcss\b|\btailwind\b/i, 'HTML/CSS'],
  [/\bgraph\s*ql\b/i, 'GraphQL'],
  [/\brest\s*(?:ful)?\s*api\b|\bapi\s*design\b/i, 'REST APIs'],
  [/\bmachine\s*learn\b|\bml\b|\bai\b|\bdeep\s*learn\b/i, 'ML / AI'],
  [/\btest\b|\bjest\b|\bcypress\b|\btesting\b/i, 'Testing'],
  [/\bagile\b|\bscrum\b/i, 'Agile'],
  [/\bleader\b|\blead\b|\bmanag\b|\bmentor\b/i, 'Leadership'],
  [/\bcommunicat\b|\bcollaborat\b|\bteamwork\b/i, 'Communication'],
  [/\bsystem\s*design\b|\barchitect\b/i, 'System Design'],
  [/\bsecurity\b|\bcybersec\b/i, 'Security'],
  [/\bmobile\b|\bios\b|\bandroid\b|\breact\s*native\b|\bflutter\b/i, 'Mobile Dev'],
  [/\bperformance\b|\boptimiz\b|\bscalable\b|\bscalability\b/i, 'Performance'],
]

/**
 * Build 5-8 skill dimensions from a candidate's matchResult plus job requirements.
 * Returns null if insufficient data.
 */
export function extractSkillRadarData(
  matchResult: MatchResult,
  requirements: string[],
  parsedSkills?: string[],
): SkillDimension[] | null {
  // Combine all text sources
  const strengthsText = matchResult.strengths.join(' ')
  const gapsText = matchResult.gaps.join(' ')
  const reqText = requirements.join(' ')
  const allText = `${strengthsText} ${gapsText} ${reqText} ${matchResult.explanation}`
  const candidateSkillsText = parsedSkills?.join(' ') ?? ''

  // Find which skills are mentioned anywhere
  const found = new Map<string, { inStrengths: boolean; inGaps: boolean; inReqs: boolean; inCandidateSkills: boolean }>()

  for (const [pattern, label] of SKILL_PATTERNS) {
    if (!pattern.test(allText) && !pattern.test(candidateSkillsText)) continue
    if (found.has(label)) continue
    found.set(label, {
      inStrengths: pattern.test(strengthsText),
      inGaps: pattern.test(gapsText),
      inReqs: pattern.test(reqText),
      inCandidateSkills: pattern.test(candidateSkillsText),
    })
  }

  if (found.size < 3) return null

  // Deterministic hash from skill name to get a stable offset (0-1)
  function hashName(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0
    }
    return (Math.abs(h) % 100) / 100
  }

  // Convert to scored dimensions with deterministic scores
  const dimensions: SkillDimension[] = []

  for (const [name, info] of found) {
    let candidateScore: number
    let requiredScore: number
    const h = hashName(name)

    // Determine candidate score based on presence in strengths/gaps
    if (info.inStrengths && !info.inGaps) {
      candidateScore = 78 + h * 17 // 78-95
    } else if (info.inGaps && !info.inStrengths) {
      candidateScore = 15 + h * 20 // 15-35
    } else if (info.inStrengths && info.inGaps) {
      candidateScore = 48 + h * 15 // 48-63
    } else if (info.inCandidateSkills) {
      candidateScore = 58 + h * 20 // 58-78
    } else {
      candidateScore = 38 + h * 15 // 38-53
    }

    // Determine required score
    if (info.inReqs) {
      requiredScore = 68 + h * 22 // 68-90
    } else {
      requiredScore = 42 + h * 18 // 42-60
    }

    dimensions.push({
      name,
      candidateScore: Math.round(candidateScore),
      requiredScore: Math.round(requiredScore),
    })
  }

  // Sort: prioritize skills in requirements, then strengths, then gaps
  dimensions.sort((a, b) => {
    const aInfo = found.get(a.name)!
    const bInfo = found.get(b.name)!
    const priority = (info: typeof aInfo) =>
      (info.inReqs ? 4 : 0) + (info.inStrengths ? 2 : 0) + (info.inGaps ? 1 : 0)
    return priority(bInfo) - priority(aInfo)
  })

  // Take 5-8 dimensions
  const count = Math.min(Math.max(dimensions.length, 5), 8)
  return dimensions.slice(0, count)
}
