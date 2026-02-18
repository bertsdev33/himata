import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAppContext } from "@/app/state";
import { useSettingsContext } from "@/app/settings-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GripVertical, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "@/i18n/LocaleProvider";

interface SortableItemProps {
  id: string;
  originalName: string;
  customName: string;
  onNameChange: (name: string) => void;
  aliasPlaceholder: string;
  clearAliasLabel: string;
}

function SortableItem({
  id,
  originalName,
  customName,
  onNameChange,
  aliasPlaceholder,
  clearAliasLabel,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-1 gap-2 rounded-md border bg-background px-3 py-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground sm:justify-self-auto"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm text-muted-foreground truncate" title={originalName}>
        {originalName}
      </span>
      <Input
        value={customName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={aliasPlaceholder}
        className="h-8 text-sm"
      />
      <button
        type="button"
        onClick={() => onNameChange("")}
        className={`text-muted-foreground hover:text-foreground transition-opacity ${
          customName ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        tabIndex={customName ? 0 : -1}
        aria-hidden={!customName}
        aria-label={clearAliasLabel}
        title={clearAliasLabel}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SettingsTab() {
  const { state } = useAppContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("settings", { lng: locale });
  const {
    settings,
    setListingName,
    setAccountName,
    setListingOrder,
    setAccountOrder,
    setMlForecastAutoRefresh,
    setShowAllQuickListings,
    resetAll,
  } = useSettingsContext();

  const analytics = state.analytics;
  if (!analytics) return null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  // Merge custom order with actual listings (add any new listings not in saved order)
  const orderedListings = useMemo(() => {
    const all = analytics.listings;
    if (!settings.listingOrder) return all;

    const byId = new Map(all.map((l) => [l.listingId, l]));
    const ordered: typeof all = [];

    for (const id of settings.listingOrder) {
      const listing = byId.get(id);
      if (listing) {
        ordered.push(listing);
        byId.delete(id);
      }
    }
    // Append any new listings not in saved order
    for (const listing of byId.values()) {
      ordered.push(listing);
    }
    return ordered;
  }, [analytics.listings, settings.listingOrder]);

  const orderedAccounts = useMemo(() => {
    const all = analytics.accountIds;
    if (!settings.accountOrder) return all;

    const remaining = new Set(all);
    const ordered: string[] = [];

    for (const id of settings.accountOrder) {
      if (remaining.has(id)) {
        ordered.push(id);
        remaining.delete(id);
      }
    }
    for (const id of remaining) {
      ordered.push(id);
    }
    return ordered;
  }, [analytics.accountIds, settings.accountOrder]);

  const handleListingDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = orderedListings.map((l) => l.listingId);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    setListingOrder(arrayMove(ids, oldIndex, newIndex));
  };

  const handleAccountDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = [...orderedAccounts];
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    setAccountOrder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{t("page.title")}</h2>
        <Button variant="outline" size="sm" onClick={resetAll} className="w-full sm:w-auto">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {t("page.actions.reset_all")}
        </Button>
      </div>

      {/* Listings section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("listings.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">
            {t("listings.description")}
          </p>
          <div className="hidden grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground sm:grid">
            <span />
            <span>{t("listings.columns.original_name")}</span>
            <span>{t("listings.columns.custom_alias")}</span>
            <span />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleListingDragEnd}
          >
            <SortableContext
              items={orderedListings.map((l) => l.listingId)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {orderedListings.map((l) => (
                  <SortableItem
                    key={l.listingId}
                    id={l.listingId}
                    originalName={l.listingName}
                    customName={settings.listingNames[l.listingId] ?? ""}
                    onNameChange={(name) => setListingName(l.listingId, name)}
                    aliasPlaceholder={t("fields.custom_alias_placeholder")}
                    clearAliasLabel={t("fields.clear_alias")}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Separator />

      {/* Accounts section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accounts.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">
            {t("accounts.description")}
          </p>
          <div className="hidden grid-cols-[auto_1fr_1fr_auto] gap-3 px-3 pb-1 text-xs font-medium text-muted-foreground sm:grid">
            <span />
            <span>{t("accounts.columns.account_id")}</span>
            <span>{t("accounts.columns.custom_alias")}</span>
            <span />
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAccountDragEnd}
          >
            <SortableContext
              items={orderedAccounts}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {orderedAccounts.map((id) => (
                  <SortableItem
                    key={id}
                    id={id}
                    originalName={id}
                    customName={settings.accountNames[id] ?? ""}
                    onNameChange={(name) => setAccountName(id, name)}
                    aliasPlaceholder={t("fields.custom_alias_placeholder")}
                    clearAliasLabel={t("fields.clear_alias")}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Separator />

      {/* Forecast behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("forecast_refresh.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("forecast_refresh.description")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={settings.mlForecastAutoRefresh ? "default" : "outline"}
              onClick={() => setMlForecastAutoRefresh(true)}
            >
              {t("forecast_refresh.actions.auto_async")}
            </Button>
            <Button
              size="sm"
              variant={!settings.mlForecastAutoRefresh ? "default" : "outline"}
              onClick={() => setMlForecastAutoRefresh(false)}
            >
              {t("forecast_refresh.actions.manual_only")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Quick filter behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("quick_filters.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("quick_filters.description")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={settings.showAllQuickListings ? "default" : "outline"}
              onClick={() => setShowAllQuickListings(true)}
            >
              {t("quick_filters.actions.show_all_listings")}
            </Button>
            <Button
              size="sm"
              variant={!settings.showAllQuickListings ? "default" : "outline"}
              onClick={() => setShowAllQuickListings(false)}
            >
              {t("quick_filters.actions.auto_limit")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
