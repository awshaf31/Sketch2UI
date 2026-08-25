import { ALL_CLASSES } from "@sketch2ui/shared-types";
import { Select } from "../../components/Select.js";

// Phase 2K QA pass — this file was never touched across 2A–2J (it's a small,
// self-contained dependency of CanvasPanel, always passed through unchanged) and
// still carried its original gray-300/orange-500 classes. Reuses the Select
// primitive directly rather than hand-rewriting the same border/focus classes a
// third time.

interface ClassPickerProps {
  value: string;
  onChange: (className: string) => void;
}

export default function ClassPicker({ value, onChange }: ClassPickerProps) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} size="sm">
      {ALL_CLASSES.map((cls) => (
        <option key={cls} value={cls}>
          {cls}
        </option>
      ))}
    </Select>
  );
}
