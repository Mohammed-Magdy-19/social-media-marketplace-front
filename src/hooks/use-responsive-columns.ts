import * as React from "react"

/**
 * Tailwind `grid-cols` breakpoints (sm = 640, xl = 1280). Virtualized grids
 * slice items into rows of N, so N must match the CSS grid's rendered column
 * count or rows misalign at each breakpoint.
 */
const BREAKPOINTS: { min: number; columns: number }[] = [
  { min: 1024, columns: 3 },
  { min: 640, columns: 2 },
  { min: 0, columns: 1 },
]

export function useResponsiveColumns() {
  const [columns, setColumns] = React.useState(1)

  React.useEffect(() => {
    const mqls = BREAKPOINTS.map((b) =>
      window.matchMedia(`(min-width: ${b.min}px)`)
    )
    const update = () => {
      const matched = BREAKPOINTS.find((b) => window.innerWidth >= b.min)
      setColumns(matched?.columns ?? 1)
    }
    update()
    mqls.forEach((mql) => mql.addEventListener("change", update))
    return () => mqls.forEach((mql) => mql.removeEventListener("change", update))
  }, [])

  return columns
}
