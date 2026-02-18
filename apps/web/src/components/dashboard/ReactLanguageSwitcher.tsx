import { useLocaleContext } from "@/i18n/LocaleProvider";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { Select } from "@/components/ui/select";

export function ReactLanguageSwitcher() {
  const { locale, setLocale } = useLocaleContext();
  const options = locales.map((loc) => ({ value: loc, label: localeLabels[loc] }));

  return (
    <Select
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
      options={options}
      ariaLabel="Language"
      className="h-9 w-[140px]"
    />
  );
}
