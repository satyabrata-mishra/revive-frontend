import { useEffect, useState } from 'react'

/** Integer field that allows empty while typing and never shows leading zeros (e.g. 04 → 4). */
export function IntInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  'aria-label': ariaLabel,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  className?: string
  'aria-label'?: string
}) {
  const [text, setText] = useState(() => String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  function commit(raw: string) {
    if (raw.trim() === '') {
      setText(String(min))
      onChange(min)
      return
    }
    let n = parseInt(raw, 10)
    if (Number.isNaN(n)) {
      setText(String(value))
      return
    }
    if (max != null) n = Math.min(max, n)
    n = Math.max(min, n)
    setText(String(n))
    onChange(n)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={className}
      aria-label={ariaLabel}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') {
          setText('')
          return
        }
        if (!/^\d+$/.test(raw)) return
        let n = parseInt(raw, 10)
        if (Number.isNaN(n)) return
        if (max != null) n = Math.min(max, n)
        setText(String(n))
        onChange(n)
      }}
      onBlur={() => {
        setFocused(false)
        commit(text)
      }}
    />
  )
}
