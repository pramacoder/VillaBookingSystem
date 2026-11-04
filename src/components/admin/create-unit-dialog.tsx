"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

interface CreateUnitDialogProps {
  locale: AppLocale;
  messages: AppMessages;
  canCreate: boolean;
}

export function CreateUnitDialog({ locale, messages, canCreate }: CreateUnitDialogProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [isOpen, setIsOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Form state
  const [nameEn, setNameEn] = React.useState("");
  const [nameId, setNameId] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [summaryEn, setSummaryEn] = React.useState("");
  const [summaryId, setSummaryId] = React.useState("");
  const [descriptionEn, setDescriptionEn] = React.useState("");
  const [descriptionId, setDescriptionId] = React.useState("");
  const [maxGuests, setMaxGuests] = React.useState(2);
  const [bedrooms, setBedrooms] = React.useState(1);
  const [bathrooms, setBathrooms] = React.useState(1);
  const [areaSqm, setAreaSqm] = React.useState<number | "">("");
  const [baseRateIdr, setBaseRateIdr] = React.useState(2500000);
  const [cleaningFeeIdr, setCleaningFeeIdr] = React.useState(0);
  const [minNights, setMinNights] = React.useState(1);
  const [sortOrder, setSortOrder] = React.useState(0);

  if (!canCreate) {
    return null;
  }

  function handleNameChange(val: string) {
    setNameEn(val);
    if (
      !slug ||
      slug ===
        nameEn
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
    ) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const payload = {
        nameEn: nameEn.trim(),
        nameId: nameId.trim(),
        slug: slug.trim().toLowerCase(),
        summaryEn: summaryEn.trim(),
        summaryId: summaryId.trim(),
        descriptionEn: descriptionEn.trim(),
        descriptionId: descriptionId.trim(),
        maxGuests: Number(maxGuests),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        areaSqm: areaSqm === "" ? null : Number(areaSqm),
        baseRateIdr: Number(baseRateIdr),
        cleaningFeeIdr: Number(cleaningFeeIdr),
        minNights: Number(minNights),
        sortOrder: Number(sortOrder),
        status: "DRAFT" as const,
      };

      const res = await fetch("/api/admin/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          body?.error?.message ??
          (locale === "id" ? "Gagal membuat unit villa." : "Failed to create villa unit.");
        setErrorMessage(errorMsg);
        setSubmitting(false);
        return;
      }

      pushToast({
        kind: "success",
        title: locale === "id" ? "Unit Dibuat" : "Unit Created",
        description:
          locale === "id"
            ? `Unit "${payload.nameId}" berhasil dibuat sebagai DRAFT.`
            : `Unit "${payload.nameEn}" successfully created as DRAFT.`,
      });

      setIsOpen(false);
      const newUnitId = body?.data?.id;
      if (newUnitId) {
        router.push(`/admin/units/${newUnitId}`);
      } else {
        router.refresh();
      }
    } catch {
      setErrorMessage(
        locale === "id" ? "Terjadi kesalahan jaringan." : "A network error occurred.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setErrorMessage(null);
          setIsOpen(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>{messages.admin.unitsPage.createUnitButton}</span>
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          if (!submitting) setIsOpen(false);
        }}
        title={messages.admin.unitsPage.createUnitButton}
        description={
          locale === "id"
            ? "Buat unit villa baru dalam status DRAFT. Anda dapat menambahkan foto, fasilitas, dan mengaktifkannya setelah selesai."
            : "Create a new villa unit in DRAFT status. You can add photos, amenities, and activate it once finalized."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-3 text-xs text-status-danger-fg"
            >
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="unit-name-en"
              label={locale === "id" ? "Nama Unit (English)" : "Unit Name (English)"}
              required
            >
              <Input
                id="unit-name-en"
                value={nameEn}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Ocean Breeze Pool Villa"
                required
                maxLength={120}
              />
            </FormField>

            <FormField
              id="unit-name-id"
              label={locale === "id" ? "Nama Unit (Bahasa Indonesia)" : "Unit Name (Indonesian)"}
              required
            >
              <Input
                id="unit-name-id"
                value={nameId}
                onChange={(e) => setNameId(e.target.value)}
                placeholder="cth. Villa Kolam Renang Ocean Breeze"
                required
                maxLength={120}
              />
            </FormField>
          </div>

          <FormField
            id="unit-slug"
            label="Slug (URL identifier)"
            helperText={
              locale === "id"
                ? "Hanya huruf kecil, angka, dan tanda hubung (-) tunggal."
                : "Only lowercase letters, numbers, and single hyphens (-)."
            }
            required
          >
            <Input
              id="unit-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="ocean-breeze-pool-villa"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              required
              maxLength={100}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="unit-summary-en"
              label={locale === "id" ? "Ringkasan Singkat (EN)" : "Short Summary (EN)"}
              required
            >
              <Textarea
                id="unit-summary-en"
                rows={2}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                placeholder="One-line summary for cards and search results…"
                required
                maxLength={500}
              />
            </FormField>

            <FormField
              id="unit-summary-id"
              label={locale === "id" ? "Ringkasan Singkat (ID)" : "Short Summary (ID)"}
              required
            >
              <Textarea
                id="unit-summary-id"
                rows={2}
                value={summaryId}
                onChange={(e) => setSummaryId(e.target.value)}
                placeholder="Ringkasan satu kalimat untuk kartu katalog…"
                required
                maxLength={500}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="unit-desc-en"
              label={locale === "id" ? "Deskripsi Lengkap (EN)" : "Full Description (EN)"}
              required
            >
              <Textarea
                id="unit-desc-en"
                rows={3}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Detailed description of features, ambiance, and layout…"
                required
                maxLength={5000}
              />
            </FormField>

            <FormField
              id="unit-desc-id"
              label={locale === "id" ? "Deskripsi Lengkap (ID)" : "Full Description (ID)"}
              required
            >
              <Textarea
                id="unit-desc-id"
                rows={3}
                value={descriptionId}
                onChange={(e) => setDescriptionId(e.target.value)}
                placeholder="Deskripsi mendalam tentang fasilitas, suasana, dan tata letak…"
                required
                maxLength={5000}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField
              id="unit-max-guests"
              label={locale === "id" ? "Maks. Tamu" : "Max Guests"}
              required
            >
              <Input
                id="unit-max-guests"
                type="number"
                min={1}
                max={30}
                value={maxGuests}
                onChange={(e) => setMaxGuests(Number(e.target.value))}
                required
              />
            </FormField>

            <FormField
              id="unit-bedrooms"
              label={locale === "id" ? "Kamar Tidur" : "Bedrooms"}
              required
            >
              <Input
                id="unit-bedrooms"
                type="number"
                min={1}
                max={20}
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value))}
                required
              />
            </FormField>

            <FormField
              id="unit-bathrooms"
              label={locale === "id" ? "Kamar Mandi" : "Bathrooms"}
              required
            >
              <Input
                id="unit-bathrooms"
                type="number"
                min={1}
                max={20}
                value={bathrooms}
                onChange={(e) => setBathrooms(Number(e.target.value))}
                required
              />
            </FormField>

            <FormField id="unit-area" label={locale === "id" ? "Luas (m²)" : "Area (m²)"}>
              <Input
                id="unit-area"
                type="number"
                min={1}
                max={2000}
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 150"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField
              id="unit-base-rate"
              label={locale === "id" ? "Tarif Dasar (IDR/malam)" : "Base Rate (IDR/night)"}
              required
            >
              <Input
                id="unit-base-rate"
                type="number"
                min={100000}
                step={50000}
                value={baseRateIdr}
                onChange={(e) => setBaseRateIdr(Number(e.target.value))}
                required
              />
            </FormField>

            <FormField
              id="unit-cleaning-fee"
              label={locale === "id" ? "Biaya Kebersihan (IDR)" : "Cleaning Fee (IDR)"}
            >
              <Input
                id="unit-cleaning-fee"
                type="number"
                min={0}
                step={25000}
                value={cleaningFeeIdr}
                onChange={(e) => setCleaningFeeIdr(Number(e.target.value))}
              />
            </FormField>

            <FormField
              id="unit-min-nights"
              label={locale === "id" ? "Min. Menginap" : "Min. Stay"}
              required
            >
              <Input
                id="unit-min-nights"
                type="number"
                min={1}
                max={30}
                value={minNights}
                onChange={(e) => setMinNights(Number(e.target.value))}
                required
              />
            </FormField>

            <FormField id="unit-sort-order" label={locale === "id" ? "Urutan" : "Sort Order"}>
              <Input
                id="unit-sort-order"
                type="number"
                min={0}
                max={1000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => setIsOpen(false)}
            >
              {messages.admin.common.cancel}
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {messages.admin.common.save}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
