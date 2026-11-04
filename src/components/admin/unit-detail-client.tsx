"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Layers,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import type { Amenity, UserRole } from "@prisma/client";
import type { UnitDetailResult } from "@/server/services/unit-service";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { addDays, formatDateOnly, parseDateOnly } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog, Dialog } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { UnitStatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/view-states";

interface UnitDetailClientProps {
  unit: UnitDetailResult;
  allAmenities: Amenity[];
  locale: AppLocale;
  messages: AppMessages;
  userRole: UserRole;
  todayString: string;
}

export function UnitDetailClient({
  unit,
  allAmenities,
  locale,
  messages,
  userRole,
  todayString,
}: UnitDetailClientProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const isAdmin = userRole === "ADMIN";

  const [activeTab, setActiveTab] = React.useState<"specs" | "amenities" | "images" | "blocks">(
    "specs",
  );

  // Specifications form state
  const [nameEn, setNameEn] = React.useState(unit.nameEn);
  const [nameId, setNameId] = React.useState(unit.nameId);
  const [slug, setSlug] = React.useState(unit.slug);
  const [status, setStatus] = React.useState(unit.status);
  const [summaryEn, setSummaryEn] = React.useState(unit.summaryEn);
  const [summaryId, setSummaryId] = React.useState(unit.summaryId);
  const [descriptionEn, setDescriptionEn] = React.useState(unit.descriptionEn);
  const [descriptionId, setDescriptionId] = React.useState(unit.descriptionId);
  const [maxGuests, setMaxGuests] = React.useState(unit.maxGuests);
  const [bedrooms, setBedrooms] = React.useState(unit.bedrooms);
  const [bathrooms, setBathrooms] = React.useState(unit.bathrooms);
  const [areaSqm, setAreaSqm] = React.useState<number | "">(unit.areaSqm ?? "");
  const [baseRateIdr, setBaseRateIdr] = React.useState(unit.baseRateIdr);
  const [cleaningFeeIdr, setCleaningFeeIdr] = React.useState(unit.cleaningFeeIdr);
  const [minNights, setMinNights] = React.useState(unit.minNights);
  const [maxNights, setMaxNights] = React.useState<number | "">(unit.maxNights ?? "");
  const [isFeatured, setIsFeatured] = React.useState(unit.isFeatured);
  const [sortOrder, setSortOrder] = React.useState(unit.sortOrder);
  const [savingSpecs, setSavingSpecs] = React.useState(false);
  const [specsError, setSpecsError] = React.useState<string | null>(null);

  // Amenities state
  const [selectedAmenityIds, setSelectedAmenityIds] = React.useState<Set<string>>(
    new Set(unit.amenities.map((a) => a.id)),
  );
  const [savingAmenities, setSavingAmenities] = React.useState(false);
  const [amenitiesError, setAmenitiesError] = React.useState<string | null>(null);

  // Add Image modal state
  const [addImageOpen, setAddImageOpen] = React.useState(false);
  const [imagePath, setImagePath] = React.useState("");
  const [imageAltEn, setImageAltEn] = React.useState("");
  const [imageAltId, setImageAltId] = React.useState("");
  const [imageSource, setImageSource] = React.useState("");
  const [imageLicense, setImageLicense] = React.useState("");
  const [imageCredit, setImageCredit] = React.useState("");
  const [imageSortOrder, setImageSortOrder] = React.useState(0);
  const [imageIsCover, setImageIsCover] = React.useState(false);
  const [savingImage, setSavingImage] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);

  // Delete Image confirm state
  const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null);
  const [isDeletingImage, setIsDeletingImage] = React.useState(false);

  // Archive modal state
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  // Block modal state
  const [addBlockOpen, setAddBlockOpen] = React.useState(false);
  const [blockStartDate, setBlockStartDate] = React.useState(todayString);
  const [blockEndDate, setBlockEndDate] = React.useState(
    formatDateOnly(addDays(parseDateOnly(todayString), 2)),
  );
  const [blockReason, setBlockReason] = React.useState<"MAINTENANCE" | "OWNER_USE" | "OTHER">(
    "MAINTENANCE",
  );
  const [blockNote, setBlockNote] = React.useState("");
  const [savingBlock, setSavingBlock] = React.useState(false);
  const [blockError, setBlockError] = React.useState<string | null>(null);

  // Delete block state
  const [deletingBlockId, setDeletingBlockId] = React.useState<string | null>(null);
  const [isDeletingBlock, setIsDeletingBlock] = React.useState(false);

  const isDraft = unit.status === "DRAFT";

  // Specs save handler
  async function handleSaveSpecs(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSpecsError(null);
    setSavingSpecs(true);

    try {
      const payload: Record<string, unknown> = {
        nameEn: nameEn.trim(),
        nameId: nameId.trim(),
        status,
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
        maxNights: maxNights === "" ? null : Number(maxNights),
        isFeatured,
        sortOrder: Number(sortOrder),
      };

      if (isDraft && slug !== unit.slug) {
        payload.slug = slug.trim().toLowerCase();
      }

      const res = await fetch(`/api/admin/units/${unit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setSpecsError(body?.error?.message ?? "Failed to update unit specifications.");
        setSavingSpecs(false);
        return;
      }

      pushToast({
        kind: "success",
        title: locale === "id" ? "Spesifikasi Disimpan" : "Specifications Saved",
        description:
          locale === "id"
            ? "Data unit berhasil diperbarui."
            : "Unit specifications updated successfully.",
      });

      router.refresh();
    } catch {
      setSpecsError(locale === "id" ? "Kesalahan jaringan." : "A network error occurred.");
    } finally {
      setSavingSpecs(false);
    }
  }

  // Amenities save handler
  async function handleSaveAmenities() {
    if (!isAdmin) return;
    setAmenitiesError(null);
    setSavingAmenities(true);

    try {
      const res = await fetch(`/api/admin/units/${unit.id}/amenities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amenityIds: Array.from(selectedAmenityIds) }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setAmenitiesError(body?.error?.message ?? "Failed to update amenities.");
        setSavingAmenities(false);
        return;
      }

      pushToast({
        kind: "success",
        title: locale === "id" ? "Fasilitas Disimpan" : "Amenities Saved",
        description:
          locale === "id"
            ? `${selectedAmenityIds.size} fasilitas berhasil ditautkan ke unit.`
            : `${selectedAmenityIds.size} amenities successfully linked to this unit.`,
      });

      router.refresh();
    } catch {
      setAmenitiesError(locale === "id" ? "Kesalahan jaringan." : "A network error occurred.");
    } finally {
      setSavingAmenities(false);
    }
  }

  // Add Image handler
  async function handleAddImage(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setImageError(null);
    setSavingImage(true);

    try {
      const payload = {
        path: imagePath.trim(),
        altEn: imageAltEn.trim(),
        altId: imageAltId.trim(),
        source: imageSource.trim(),
        license: imageLicense.trim(),
        credit: imageCredit.trim() || null,
        isCover: imageIsCover,
        sortOrder: Number(imageSortOrder),
      };

      const res = await fetch(`/api/admin/units/${unit.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setImageError(body?.error?.message ?? "Failed to add unit image.");
        setSavingImage(false);
        return;
      }

      pushToast({
        kind: "success",
        title: locale === "id" ? "Foto Ditambahkan" : "Image Added",
        description:
          locale === "id"
            ? "Foto dan manifes aset berhasil disimpan."
            : "Image and asset manifest successfully registered.",
      });

      setAddImageOpen(false);
      setImagePath("");
      setImageAltEn("");
      setImageAltId("");
      setImageSource("");
      setImageLicense("");
      setImageCredit("");
      router.refresh();
    } catch {
      setImageError(locale === "id" ? "Kesalahan jaringan." : "A network error occurred.");
    } finally {
      setSavingImage(false);
    }
  }

  // Delete Image handler
  async function handleDeleteImage() {
    if (!deletingImageId || !isAdmin) return;
    setIsDeletingImage(true);

    try {
      const res = await fetch(`/api/admin/units/${unit.id}/images/${deletingImageId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Failed to delete image.");
      }

      pushToast({
        kind: "info",
        title: locale === "id" ? "Foto Dihapus" : "Image Deleted",
        description:
          locale === "id" ? "Foto telah dihapus dari unit." : "Image removed from unit gallery.",
      });

      setDeletingImageId(null);
      router.refresh();
    } catch (err: unknown) {
      pushToast({
        kind: "error",
        title: locale === "id" ? "Gagal Menghapus" : "Delete Failed",
        description: err instanceof Error ? err.message : "Could not delete image.",
      });
    } finally {
      setIsDeletingImage(false);
    }
  }

  // Archive Unit handler
  async function handleArchiveUnit() {
    if (!isAdmin) return;
    setArchiveError(null);
    setArchiving(true);

    try {
      const res = await fetch(`/api/admin/units/${unit.id}/archive`, {
        method: "POST",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409) {
          setArchiveError(
            locale === "id"
              ? "Tidak dapat mengarsipkan: Unit ini masih memiliki reservasi aktif atau mendatang (409 HAS_DEPENDENCIES)."
              : "Cannot archive: This unit still has active or future reservations (409 HAS_DEPENDENCIES).",
          );
        } else {
          setArchiveError(body?.error?.message ?? "Failed to archive unit.");
        }
        setArchiving(false);
        return;
      }

      pushToast({
        kind: "info",
        title: locale === "id" ? "Unit Diarsipkan" : "Unit Archived",
        description:
          locale === "id"
            ? `Unit "${unit.nameId}" telah diarsipkan.`
            : `Unit "${unit.nameEn}" has been archived.`,
      });

      setArchiveOpen(false);
      router.refresh();
    } catch {
      setArchiveError(locale === "id" ? "Kesalahan jaringan." : "A network error occurred.");
    } finally {
      setArchiving(false);
    }
  }

  // Add Block handler
  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    setBlockError(null);
    setSavingBlock(true);

    try {
      const payload = {
        unitId: unit.id,
        startDate: blockStartDate,
        endDate: blockEndDate,
        reason: blockReason,
        note: blockNote.trim() || null,
      };

      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setBlockError(body?.error?.message ?? "Failed to create block.");
        setSavingBlock(false);
        return;
      }

      pushToast({
        kind: "success",
        title: locale === "id" ? "Blok Disimpan" : "Block Created",
        description:
          locale === "id"
            ? "Blok pemeliharaan telah diterapkan."
            : "Maintenance block successfully recorded.",
      });

      setAddBlockOpen(false);
      setBlockNote("");
      router.refresh();
    } catch {
      setBlockError(locale === "id" ? "Kesalahan jaringan." : "A network error occurred.");
    } finally {
      setSavingBlock(false);
    }
  }

  // Delete Block handler
  async function handleDeleteBlock() {
    if (!deletingBlockId) return;
    setIsDeletingBlock(true);

    try {
      const res = await fetch(`/api/admin/blocks/${deletingBlockId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Failed to delete block.");
      }

      pushToast({
        kind: "info",
        title: locale === "id" ? "Blok Dihapus" : "Block Removed",
        description:
          locale === "id"
            ? "Rentang tanggal telah dibuka kembali."
            : "Date range reopened for bookings.",
      });

      setDeletingBlockId(null);
      router.refresh();
    } catch (err: unknown) {
      pushToast({
        kind: "error",
        title: locale === "id" ? "Gagal Menghapus" : "Delete Failed",
        description: err instanceof Error ? err.message : "Could not delete block.",
      });
    } finally {
      setIsDeletingBlock(false);
    }
  }

  // Group amenities by category
  const amenitiesByCategory = React.useMemo(() => {
    const map = new Map<string, Amenity[]>();
    for (const item of allAmenities) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [allAmenities]);

  const displayName = locale === "id" ? unit.nameId : unit.nameEn;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/units"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-gray-600/40 bg-white text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-label={messages.admin.unitDetail.backToList}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold text-gray-800">{displayName}</h1>
              <UnitStatusBadge status={unit.status} locale={locale} />
              {unit.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-[6px] bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
                  <Sparkles className="h-3 w-3" />
                  <span>Featured</span>
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-gray-500">slug: {unit.slug}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && unit.status !== "ARCHIVED" && (
            <Button
              variant="secondary"
              onClick={() => {
                setArchiveError(null);
                setArchiveOpen(true);
              }}
            >
              <Archive className="h-4 w-4" />
              <span>{messages.admin.unitDetail.archiveButton}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Navigation tabs */}
      <nav
        aria-label="Unit management sections"
        className="flex space-x-2 border-b border-gray-200"
      >
        <button
          type="button"
          onClick={() => setActiveTab("specs")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
            activeTab === "specs"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>{messages.admin.unitDetail.editTitle}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("amenities")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
            activeTab === "amenities"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>{messages.admin.unitDetail.amenitiesSectionTitle}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {selectedAmenityIds.size}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("images")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
            activeTab === "images"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          <span>{messages.admin.unitDetail.imagesSectionTitle}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {unit.images.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blocks")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-sm font-medium transition-colors ${
            activeTab === "blocks"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>{messages.admin.unitDetail.blocksSectionTitle}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {unit.blocks.length}
          </span>
        </button>
      </nav>

      {/* Tab 1: Specifications & Rates */}
      {activeTab === "specs" && (
        <form
          onSubmit={handleSaveSpecs}
          className="rounded-[8px] border border-gray-100 bg-white p-6 shadow-sm space-y-6"
        >
          {specsError && (
            <div
              role="alert"
              className="rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-4 text-xs text-status-danger-fg"
            >
              {specsError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="spec-name-en"
              label={locale === "id" ? "Nama Unit (English)" : "Unit Name (English)"}
              required
            >
              <Input
                id="spec-name-en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                disabled={!isAdmin}
                required
                maxLength={120}
              />
            </FormField>

            <FormField
              id="spec-name-id"
              label={locale === "id" ? "Nama Unit (Bahasa Indonesia)" : "Unit Name (Indonesian)"}
              required
            >
              <Input
                id="spec-name-id"
                value={nameId}
                onChange={(e) => setNameId(e.target.value)}
                disabled={!isAdmin}
                required
                maxLength={120}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="spec-slug"
              label="Slug"
              helperText={
                isDraft
                  ? locale === "id"
                    ? "Dapat diubah selama status masih DRAFT."
                    : "Can be modified while unit is in DRAFT status."
                  : messages.admin.unitDetail.slugHelp
              }
              required
            >
              <Input
                id="spec-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                disabled={!isAdmin || !isDraft}
                className={!isDraft ? "bg-gray-100 cursor-not-allowed" : ""}
                required
                maxLength={100}
              />
            </FormField>

            <FormField id="spec-status" label={messages.admin.unitsPage.colStatus} required>
              <Select
                id="spec-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "DRAFT" | "ACTIVE" | "ARCHIVED")}
                disabled={!isAdmin}
              >
                <option value="DRAFT">{messages.statuses.unit.DRAFT}</option>
                <option value="ACTIVE">{messages.statuses.unit.ACTIVE}</option>
                <option value="ARCHIVED">{messages.statuses.unit.ARCHIVED}</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="spec-summary-en"
              label={locale === "id" ? "Ringkasan Singkat (EN)" : "Short Summary (EN)"}
              required
            >
              <Textarea
                id="spec-summary-en"
                rows={2}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                disabled={!isAdmin}
                required
                maxLength={500}
              />
            </FormField>

            <FormField
              id="spec-summary-id"
              label={locale === "id" ? "Ringkasan Singkat (ID)" : "Short Summary (ID)"}
              required
            >
              <Textarea
                id="spec-summary-id"
                rows={2}
                value={summaryId}
                onChange={(e) => setSummaryId(e.target.value)}
                disabled={!isAdmin}
                required
                maxLength={500}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="spec-desc-en"
              label={locale === "id" ? "Deskripsi Lengkap (EN)" : "Full Description (EN)"}
              required
            >
              <Textarea
                id="spec-desc-en"
                rows={4}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                disabled={!isAdmin}
                required
                maxLength={5000}
              />
            </FormField>

            <FormField
              id="spec-desc-id"
              label={locale === "id" ? "Deskripsi Lengkap (ID)" : "Full Description (ID)"}
              required
            >
              <Textarea
                id="spec-desc-id"
                rows={4}
                value={descriptionId}
                onChange={(e) => setDescriptionId(e.target.value)}
                disabled={!isAdmin}
                required
                maxLength={5000}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField
              id="spec-max-guests"
              label={locale === "id" ? "Maks. Tamu" : "Max Guests"}
              required
            >
              <Input
                id="spec-max-guests"
                type="number"
                min={1}
                max={30}
                value={maxGuests}
                onChange={(e) => setMaxGuests(Number(e.target.value))}
                disabled={!isAdmin}
                required
              />
            </FormField>

            <FormField
              id="spec-bedrooms"
              label={locale === "id" ? "Kamar Tidur" : "Bedrooms"}
              required
            >
              <Input
                id="spec-bedrooms"
                type="number"
                min={1}
                max={20}
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value))}
                disabled={!isAdmin}
                required
              />
            </FormField>

            <FormField
              id="spec-bathrooms"
              label={locale === "id" ? "Kamar Mandi" : "Bathrooms"}
              required
            >
              <Input
                id="spec-bathrooms"
                type="number"
                min={1}
                max={20}
                value={bathrooms}
                onChange={(e) => setBathrooms(Number(e.target.value))}
                disabled={!isAdmin}
                required
              />
            </FormField>

            <FormField id="spec-area" label={locale === "id" ? "Luas (m²)" : "Area (m²)"}>
              <Input
                id="spec-area"
                type="number"
                min={1}
                max={2000}
                value={areaSqm}
                onChange={(e) => setAreaSqm(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={!isAdmin}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <FormField
              id="spec-base-rate"
              label={locale === "id" ? "Tarif Dasar (IDR/malam)" : "Base Rate (IDR/night)"}
              required
            >
              <Input
                id="spec-base-rate"
                type="number"
                min={100000}
                step={50000}
                value={baseRateIdr}
                onChange={(e) => setBaseRateIdr(Number(e.target.value))}
                disabled={!isAdmin}
                required
              />
            </FormField>

            <FormField
              id="spec-cleaning-fee"
              label={locale === "id" ? "Biaya Kebersihan (IDR)" : "Cleaning Fee (IDR)"}
            >
              <Input
                id="spec-cleaning-fee"
                type="number"
                min={0}
                step={25000}
                value={cleaningFeeIdr}
                onChange={(e) => setCleaningFeeIdr(Number(e.target.value))}
                disabled={!isAdmin}
              />
            </FormField>

            <FormField
              id="spec-min-nights"
              label={locale === "id" ? "Min. Menginap" : "Min. Stay (nights)"}
              required
            >
              <Input
                id="spec-min-nights"
                type="number"
                min={1}
                max={30}
                value={minNights}
                onChange={(e) => setMinNights(Number(e.target.value))}
                disabled={!isAdmin}
                required
              />
            </FormField>

            <FormField
              id="spec-max-nights"
              label={locale === "id" ? "Maks. Menginap" : "Max. Stay (nights)"}
            >
              <Input
                id="spec-max-nights"
                type="number"
                min={1}
                max={365}
                value={maxNights}
                onChange={(e) => setMaxNights(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={!isAdmin}
              />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer font-sans text-sm text-gray-800">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                disabled={!isAdmin}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
              />
              <span>
                {locale === "id"
                  ? "Tampilkan sebagai Villa Unggulan (Featured)"
                  : "Mark as Featured Villa"}
              </span>
            </label>

            <div className="flex items-center gap-2">
              <label htmlFor="unitSortOrder" className="font-sans text-sm text-gray-700">
                {locale === "id" ? "Urutan Tampil:" : "Sort Order:"}
              </label>
              <Input
                id="unitSortOrder"
                type="number"
                min={0}
                max={1000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                disabled={!isAdmin}
                className="w-24"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <Button type="submit" variant="primary" isLoading={savingSpecs}>
                {messages.admin.common.save}
              </Button>
            </div>
          )}
        </form>
      )}

      {/* Tab 2: Amenities */}
      {activeTab === "amenities" && (
        <div className="rounded-[8px] border border-gray-100 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-4">
            <div>
              <h2 className="font-sans text-base font-semibold text-gray-800">
                {messages.admin.unitDetail.amenitiesSectionTitle}
              </h2>
              <p className="font-sans text-xs text-gray-500">
                {locale === "id"
                  ? "Pilih fasilitas yang tersedia di unit villa ini."
                  : "Select amenities and features available in this villa unit."}
              </p>
            </div>
            {isAdmin && (
              <Button variant="primary" isLoading={savingAmenities} onClick={handleSaveAmenities}>
                <Check className="h-4 w-4" />
                <span>{messages.admin.unitDetail.saveAmenities}</span>
              </Button>
            )}
          </div>

          {amenitiesError && (
            <div
              role="alert"
              className="rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-4 text-xs text-status-danger-fg"
            >
              {amenitiesError}
            </div>
          )}

          <div className="space-y-6">
            {Array.from(amenitiesByCategory.entries()).map(([category, items]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {category}
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                  {items.map((amenity) => {
                    const checked = selectedAmenityIds.has(amenity.id);
                    const label = locale === "id" ? amenity.nameId : amenity.nameEn;
                    return (
                      <label
                        key={amenity.id}
                        className={`flex items-center gap-3 rounded-[6px] border p-3 cursor-pointer transition-colors ${
                          checked
                            ? "border-blue-600 bg-blue-50/40 text-blue-900"
                            : "border-gray-200 bg-gray-50/30 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!isAdmin}
                          onChange={(e) => {
                            const next = new Set(selectedAmenityIds);
                            if (e.target.checked) {
                              next.add(amenity.id);
                            } else {
                              next.delete(amenity.id);
                            }
                            setSelectedAmenityIds(next);
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                        />
                        <span className="font-sans text-xs font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Images & Asset Manifest */}
      {activeTab === "images" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-base font-semibold text-gray-800">
                {messages.admin.unitDetail.imagesSectionTitle}
              </h2>
              <p className="font-sans text-xs text-gray-500">
                {locale === "id"
                  ? "Setiap foto wajib memiliki teks alternatif, sumber, dan lisensi (CONTENT_GUIDE §8)."
                  : "Every image must declare alt text, source, and license per CONTENT_GUIDE §8."}
              </p>
            </div>

            {isAdmin && (
              <Button
                variant="primary"
                onClick={() => {
                  setImageError(null);
                  setAddImageOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                <span>{messages.admin.unitDetail.addImageButton}</span>
              </Button>
            )}
          </div>

          {unit.images.length === 0 ? (
            <EmptyState
              title={locale === "id" ? "Belum ada foto" : "No images registered"}
              description={
                locale === "id"
                  ? "Tambahkan foto berkualitas tinggi beserta lisensi untuk katalog villa."
                  : "Add high-quality villa photos and their license metadata for catalog presentation."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {unit.images.map((img) => (
                <div
                  key={img.id}
                  className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm flex flex-col justify-between"
                >
                  <div className="relative aspect-[16/10] bg-gray-100 flex items-center justify-center border-b border-gray-200">
                    <div className="flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                      <ImageIcon className="h-8 w-8 mb-1" />
                      <span className="font-mono text-xs break-all text-gray-700">{img.path}</span>
                    </div>

                    {img.isCover && (
                      <span className="absolute top-2 left-2 rounded-[6px] bg-blue-600 px-2 py-0.5 font-sans text-xs font-semibold text-white shadow-sm">
                        Cover
                      </span>
                    )}
                    <span className="absolute top-2 right-2 rounded-[6px] bg-black/60 px-2 py-0.5 font-mono text-xs text-white">
                      #{img.sortOrder}
                    </span>
                  </div>

                  <div className="p-4 space-y-2 text-xs text-gray-600 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div>
                        <span className="font-semibold text-gray-800">EN: </span>
                        <span>{img.altEn}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-800">ID: </span>
                        <span>{img.altId}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-0.5 font-mono">
                        <div>Source: {img.source}</div>
                        <div>License: {img.license}</div>
                        {img.credit && <div>Credit: {img.credit}</div>}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="pt-3 border-t border-gray-100 flex justify-end">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeletingImageId(img.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{messages.admin.unitDetail.deleteImage}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Unit Blocks */}
      {activeTab === "blocks" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-sans text-base font-semibold text-gray-800">
                {messages.admin.unitDetail.blocksSectionTitle}
              </h2>
              <p className="font-sans text-xs text-gray-500">
                {locale === "id"
                  ? "Rentang tanggal yang diblokir untuk pemeliharaan atau keperluan pemilik."
                  : "Dates closed for villa maintenance, repairs, or owner private use."}
              </p>
            </div>

            <Button
              variant="primary"
              onClick={() => {
                setBlockError(null);
                setAddBlockOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>{messages.admin.calendarPage.addBlockButton}</span>
            </Button>
          </div>

          {unit.blocks.length === 0 ? (
            <EmptyState
              title={locale === "id" ? "Tidak ada blok aktif" : "No maintenance blocks"}
              description={
                locale === "id"
                  ? "Unit ini tersedia penuh tanpa ada penutupan jadwal pemeliharaan."
                  : "Unit is completely open with no active maintenance or owner-use blocks."
              }
            />
          ) : (
            <div className="overflow-hidden rounded-[8px] border border-gray-100 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{locale === "id" ? "Tanggal Mulai" : "Start Date"}</TableHead>
                    <TableHead>{locale === "id" ? "Tanggal Selesai" : "End Date"}</TableHead>
                    <TableHead>{locale === "id" ? "Alasan" : "Reason"}</TableHead>
                    <TableHead>{locale === "id" ? "Catatan" : "Note"}</TableHead>
                    <TableHead className="text-right">
                      {messages.admin.unitsPage.colActions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unit.blocks.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">
                        {formatDateOnly(b.startDate)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDateOnly(b.endDate)}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-[6px] bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-800">
                          {b.reason}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">{b.note ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingBlockId(b.id)}
                          className="text-status-danger-fg hover:bg-status-danger-bg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Add Image Dialog */}
      <Dialog
        open={addImageOpen}
        onClose={() => {
          if (!savingImage) setAddImageOpen(false);
        }}
        title={messages.admin.unitDetail.addImageButton}
        description={
          locale === "id"
            ? "Daftarkan aset foto baru dengan kepatuhan manifes lisensi penuh (CONTENT_GUIDE §8)."
            : "Register a new photo asset with full license attribution (CONTENT_GUIDE §8)."
        }
      >
        <form onSubmit={handleAddImage} className="space-y-4">
          {imageError && (
            <div
              role="alert"
              className="rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-3 text-xs text-status-danger-fg"
            >
              {imageError}
            </div>
          )}

          <FormField id="image-path" label={messages.admin.unitDetail.imagePathLabel} required>
            <Input
              id="image-path"
              value={imagePath}
              onChange={(e) => setImagePath(e.target.value)}
              placeholder="/images/units/deluxe-garden-bedroom.webp"
              required
              maxLength={300}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="image-alt-en" label={messages.admin.unitDetail.imageAltEnLabel} required>
              <Input
                id="image-alt-en"
                value={imageAltEn}
                onChange={(e) => setImageAltEn(e.target.value)}
                placeholder="King bedroom overlooking private plunge pool"
                required
                maxLength={200}
              />
            </FormField>

            <FormField id="image-alt-id" label={messages.admin.unitDetail.imageAltIdLabel} required>
              <Input
                id="image-alt-id"
                value={imageAltId}
                onChange={(e) => setImageAltId(e.target.value)}
                placeholder="Kamar tidur utama menghadap kolam renang pribadi"
                required
                maxLength={200}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="image-source"
              label={messages.admin.unitDetail.imageSourceLabel}
              required
            >
              <Input
                id="image-source"
                value={imageSource}
                onChange={(e) => setImageSource(e.target.value)}
                placeholder="e.g. Unsplash / In-house Photography"
                required
                maxLength={200}
              />
            </FormField>

            <FormField
              id="image-license"
              label={messages.admin.unitDetail.imageLicenseLabel}
              required
            >
              <Input
                id="image-license"
                value={imageLicense}
                onChange={(e) => setImageLicense(e.target.value)}
                placeholder="e.g. Unsplash License / CC-BY-4.0"
                required
                maxLength={100}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="image-credit" label={messages.admin.unitDetail.imageCreditLabel}>
              <Input
                id="image-credit"
                value={imageCredit}
                onChange={(e) => setImageCredit(e.target.value)}
                placeholder="e.g. Photo by Jane Doe"
                maxLength={200}
              />
            </FormField>

            <FormField id="image-sort" label={messages.admin.unitDetail.imageSortOrderLabel}>
              <Input
                id="image-sort"
                type="number"
                min={0}
                max={100}
                value={imageSortOrder}
                onChange={(e) => setImageSortOrder(Number(e.target.value))}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-sans text-sm text-gray-800">
            <input
              type="checkbox"
              checked={imageIsCover}
              onChange={(e) => setImageIsCover(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
            />
            <span>{messages.admin.unitDetail.imageCoverLabel}</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              disabled={savingImage}
              onClick={() => setAddImageOpen(false)}
            >
              {messages.admin.common.cancel}
            </Button>
            <Button type="submit" variant="primary" isLoading={savingImage}>
              {messages.admin.common.save}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Image Dialog */}
      <ConfirmActionDialog
        open={deletingImageId !== null}
        onClose={() => setDeletingImageId(null)}
        onConfirm={handleDeleteImage}
        title={messages.admin.unitDetail.deleteImageConfirmTitle}
        description={messages.admin.unitDetail.deleteImageConfirmDescription}
        confirmActionLabel={messages.admin.unitDetail.deleteImage}
        isDestructive
        isSubmitting={isDeletingImage}
      />

      {/* Archive Unit Dialog */}
      <Dialog
        open={archiveOpen}
        onClose={() => {
          if (!archiving) setArchiveOpen(false);
        }}
        title={messages.admin.unitDetail.archiveDialogTitle.replace("{name}", displayName)}
        description={messages.admin.unitDetail.archiveDialogDescription}
      >
        <div className="space-y-4">
          {archiveError && (
            <div
              role="alert"
              className="rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-3 text-xs text-status-danger-fg"
            >
              {archiveError}
            </div>
          )}

          <p className="font-sans text-sm text-gray-600">
            {locale === "id"
              ? "Apakah Anda yakin ingin mengarsipkan unit ini? Unit tidak lagi dapat dipesan di katalog publik."
              : "Are you sure you want to archive this unit? It will be removed from public catalog listings."}
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              disabled={archiving}
              onClick={() => setArchiveOpen(false)}
            >
              {messages.admin.common.cancel}
            </Button>
            <Button
              type="button"
              variant="destructiveSolid"
              isLoading={archiving}
              onClick={handleArchiveUnit}
            >
              {messages.admin.unitDetail.archiveButton}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Block Dialog */}
      <Dialog
        open={addBlockOpen}
        onClose={() => {
          if (!savingBlock) setAddBlockOpen(false);
        }}
        title={messages.admin.calendarPage.dialogAddBlockTitle}
        description={
          locale === "id"
            ? "Tentukan tanggal penutupan jadwal untuk pemeliharaan unit villa ini."
            : "Set closed dates for villa repairs or maintenance on this unit."
        }
      >
        <form onSubmit={handleAddBlock} className="space-y-4">
          {blockError && (
            <div
              role="alert"
              className="rounded-[6px] border border-status-danger-fg/30 bg-status-danger-bg p-3 text-xs text-status-danger-fg"
            >
              {blockError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="block-start-date"
              label={messages.admin.calendarPage.blockStartDate}
              required
            >
              <Input
                id="block-start-date"
                type="date"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
                required
              />
            </FormField>

            <FormField
              id="block-end-date"
              label={messages.admin.calendarPage.blockEndDate}
              required
            >
              <Input
                id="block-end-date"
                type="date"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField id="block-reason" label={messages.admin.calendarPage.blockReason} required>
            <Select
              id="block-reason"
              value={blockReason}
              onChange={(e) =>
                setBlockReason(e.target.value as "MAINTENANCE" | "OWNER_USE" | "OTHER")
              }
            >
              <option value="MAINTENANCE">
                {messages.admin.calendarPage.blockReasonMaintenance}
              </option>
              <option value="OWNER_USE">{messages.admin.calendarPage.blockReasonOwner}</option>
              <option value="OTHER">{messages.admin.calendarPage.blockReasonOther}</option>
            </Select>
          </FormField>

          <FormField id="block-note" label={messages.admin.calendarPage.blockNote}>
            <Textarea
              id="block-note"
              rows={2}
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              placeholder="e.g. Annual pool resurfacing"
              maxLength={200}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              disabled={savingBlock}
              onClick={() => setAddBlockOpen(false)}
            >
              {messages.admin.common.cancel}
            </Button>
            <Button type="submit" variant="primary" isLoading={savingBlock}>
              {messages.admin.common.save}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Block Dialog */}
      <ConfirmActionDialog
        open={deletingBlockId !== null}
        onClose={() => setDeletingBlockId(null)}
        onConfirm={handleDeleteBlock}
        title={messages.admin.calendarPage.deleteBlockConfirmTitle}
        description={messages.admin.calendarPage.deleteBlockConfirmDescription}
        confirmActionLabel={messages.admin.calendarPage.deleteBlock}
        isDestructive
        isSubmitting={isDeletingBlock}
      />
    </div>
  );
}
