"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { AppLocale, AppMessages } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface CreateGuestDialogProps {
  locale: AppLocale;
  messages: AppMessages;
}

export function CreateGuestDialog({ locale, messages }: CreateGuestDialogProps) {
  const router = useRouter();
  const { pushToast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [preferredLocale, setPreferredLocale] = React.useState<"en" | "id">(locale);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const g = messages.admin.guestsPage;
  const f = messages.admin.reservationForm;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/guests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
          preferredLocale,
          notes: notes.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        data?: { id: string; fullName: string };
        error?: { code?: string; message?: string };
      };

      if (!response.ok || !payload.data) {
        pushToast({
          kind: "error",
          title: payload.error?.code ?? "Error",
          description: payload.error?.message ?? "Failed to create guest.",
        });
        setSubmitting(false);
        return;
      }

      setOpen(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setCountry("");
      setNotes("");
      setSubmitting(false);

      pushToast({
        kind: "success",
        title: payload.data.fullName,
        description: g.createGuestTitle,
      });

      router.push(`/admin/guests/${payload.data.id}`);
      router.refresh();
    } catch {
      pushToast({
        kind: "error",
        title: "Error",
        description: "Network error while creating guest.",
      });
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{g.createGuestButton}</span>
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title={g.createGuestTitle}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            id="guest-new-name"
            label={f.fullNameLabel}
            required
            requiredSrLabel={messages.admin.common.required}
          >
            <Input
              id="guest-new-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ayu Pratiwi"
            />
          </FormField>

          <FormField id="guest-new-email" label={f.emailLabel}>
            <Input
              id="guest-new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@example.com"
            />
          </FormField>

          <FormField id="guest-new-phone" label={f.phoneLabel}>
            <Input
              id="guest-new-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62 812 0000 0000"
            />
          </FormField>

          <FormField id="guest-new-country" label={f.countryLabel}>
            <Input
              id="guest-new-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Indonesia"
            />
          </FormField>

          <FormField id="guest-new-locale" label={f.localeLabel}>
            <Select
              id="guest-new-locale"
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value as "en" | "id")}
            >
              <option value="en">English (EN)</option>
              <option value="id">Bahasa Indonesia (ID)</option>
            </Select>
          </FormField>

          <FormField id="guest-new-notes" label={f.internalNotesLabel}>
            <Textarea
              id="guest-new-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {messages.admin.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || fullName.trim().length === 0}
            >
              {submitting ? messages.admin.common.saving : g.createGuestButton}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
