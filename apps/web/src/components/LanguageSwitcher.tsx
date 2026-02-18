import { Select, type SelectOption } from "@/components/ui/select";

interface LanguageSwitcherProps {
  value: string;
  options: SelectOption[];
}

export default function LanguageSwitcher({ value, options }: LanguageSwitcherProps) {
  return (
    <Select
      value={value}
      options={options}
      onChange={(event) => {
        window.location.href = event.target.value;
      }}
      ariaLabel="Language"
      className="h-8 w-[140px]"
    />
  );
}
