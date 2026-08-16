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
    <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
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
    </div>
  )
}
