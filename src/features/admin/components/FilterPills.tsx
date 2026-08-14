import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/**
 * Single-select filter pill row (spec §6.2 / §6.4). Built on the ToggleGroup
 * primitive — not a row of individually-styled buttons.
 */
export function FilterPills({
  pills,
  value,
  onChange,
}: {
  pills: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        onChange(next[0] ?? "")
      }}
      size="sm"
      variant="outline"
      spacing={2}
    >
      {pills.map((pill) => (
        <ToggleGroupItem key={pill} value={pill}>
          {pill}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
