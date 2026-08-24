import { ALL_CLASSES } from "@sketch2ui/shared-types";

interface ClassPickerProps {
  value: string;
  onChange: (className: string) => void;
}

export default function ClassPicker({ value, onChange }: ClassPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
    >
      {ALL_CLASSES.map((cls) => (
        <option key={cls} value={cls}>
          {cls}
        </option>
      ))}
    </select>
  );
}
