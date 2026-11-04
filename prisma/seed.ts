import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "@node-rs/argon2";
import {
  type AmenityCategory,
  type BlockReason,
  type PaymentKind,
  type PaymentMethod,
  PrismaClient,
  type ReservationSource,
  type ReservationStatus,
  type UnitStatus,
  UserRole,
} from "@prisma/client";
import { addDaysDateOnly, diffNights, formatDateOnly, getPropertyToday } from "../src/lib/dates";
import { computeNetPaidIdr, derivePaymentStatus } from "../src/lib/payments";

const MIN_PASSWORD_LENGTH = 12;
const PLACEHOLDER_PATTERNS = [/^replace-with-/i, /^changeme$/i, /^password/i];

export interface SeedCredentials {
  adminEmail: string;
  adminPassword: string;
  staffEmail: string;
  staffPassword: string;
}

export function loadSeedEnvFiles(): void {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(filePath) && typeof process.loadEnvFile === "function") {
      process.loadEnvFile(filePath);
    }
  }
}

function assertValidPassword(password: string | undefined, varName: string): string {
  if (!password || password.trim() === "") {
    throw new Error(
      `Missing required environment variable ${varName}. No default password is permitted (SEC-01).`,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${varName} must be at least ${MIN_PASSWORD_LENGTH} characters long (SEC-01).`);
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(password.trim())) {
      throw new Error(
        `${varName} contains a placeholder or disallowed common value. Provide a real secret via environment variables (SEC-01).`,
      );
    }
  }
  return password;
}

export function validateSeedEnv(env: NodeJS.ProcessEnv = process.env): SeedCredentials {
  if (env.NODE_ENV === "production" && env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Refusing to run seed in production environment without ALLOW_PRODUCTION_SEED=true (SEC-02 / TC-X18).",
    );
  }

  const rawAdminEmail = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!rawAdminEmail || !rawAdminEmail.includes("@")) {
    throw new Error("Missing or invalid required environment variable SEED_ADMIN_EMAIL.");
  }

  const adminPassword = assertValidPassword(env.SEED_ADMIN_PASSWORD, "SEED_ADMIN_PASSWORD");

  const rawStaffEmail = (
    env.SEED_STAFF_EMAIL?.trim() || "staff@sagaravillas.example.com"
  ).toLowerCase();
  if (!rawStaffEmail.includes("@")) {
    throw new Error("Invalid environment variable SEED_STAFF_EMAIL.");
  }

  // Staff password falls back to SEED_ADMIN_PASSWORD only if SEED_STAFF_PASSWORD is not explicitly set,
  // ensuring no hardcoded/default password ever exists in code.
  const staffPassword = env.SEED_STAFF_PASSWORD
    ? assertValidPassword(env.SEED_STAFF_PASSWORD, "SEED_STAFF_PASSWORD")
    : adminPassword;

  return {
    adminEmail: rawAdminEmail,
    adminPassword,
    staffEmail: rawStaffEmail,
    staffPassword,
  };
}

interface SeedAmenityInput {
  key: string;
  nameEn: string;
  nameId: string;
  category: AmenityCategory;
  icon: string;
}

const SEED_AMENITIES: readonly SeedAmenityInput[] = [
  {
    key: "air_conditioning",
    nameEn: "Air Conditioning",
    nameId: "Pendingin Ruangan (AC)",
    category: "IN_VILLA",
    icon: "Wind",
  },
  {
    key: "high_speed_wifi",
    nameEn: "High-Speed Wi-Fi",
    nameId: "Wi-Fi Kecepatan Tinggi",
    category: "IN_VILLA",
    icon: "Wifi",
  },
  {
    key: "kitchenette",
    nameEn: "Equipped Kitchenette",
    nameId: "Dapur Kecil Lengkap",
    category: "IN_VILLA",
    icon: "Utensils",
  },
  {
    key: "dedicated_workspace",
    nameEn: "Dedicated Workspace",
    nameId: "Meja Kerja Khusus",
    category: "IN_VILLA",
    icon: "Laptop",
  },
  {
    key: "soaking_tub",
    nameEn: "Stone Soaking Tub",
    nameId: "Bak Mandi Batu Alam",
    category: "IN_VILLA",
    icon: "Bath",
  },
  {
    key: "private_pool",
    nameEn: "Private Plunge Pool",
    nameId: "Kolam Renang Pribadi",
    category: "OUTDOOR",
    icon: "Waves",
  },
  {
    key: "tropical_garden",
    nameEn: "Enclosed Tropical Garden",
    nameId: "Taman Tropis Tertutup",
    category: "OUTDOOR",
    icon: "Trees",
  },
  {
    key: "sun_terrace",
    nameEn: "Sun Lounger Terrace",
    nameId: "Teras Kursi Santai",
    category: "OUTDOOR",
    icon: "Sun",
  },
  {
    key: "daily_housekeeping",
    nameEn: "Daily Housekeeping",
    nameId: "Layanan Kebersihan Harian",
    category: "SERVICES",
    icon: "Sparkles",
  },
  {
    key: "on_site_parking",
    nameEn: "On-Site Parking",
    nameId: "Parkir di Area Villa",
    category: "SERVICES",
    icon: "Car",
  },
];

interface SeedUnitInput {
  slug: string;
  status: UnitStatus;
  nameEn: string;
  nameId: string;
  summaryEn: string;
  summaryId: string;
  descriptionEn: string;
  descriptionId: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  baseRateIdr: number;
  cleaningFeeIdr: number;
  minNights: number;
  maxNights: number;
  isFeatured: boolean;
  sortOrder: number;
  amenityKeys: string[];
}

const SEED_UNITS: readonly SeedUnitInput[] = [
  {
    slug: "garden-villa",
    status: "ACTIVE",
    nameEn: "Sagara Garden Villa",
    nameId: "Villa Taman Sagara",
    summaryEn: "One-bedroom courtyard villa framed by frangipani trees and a quiet veranda.",
    summaryId: "Villa satu kamar tidur dengan halaman pohon kamboja dan beranda yang tenang.",
    descriptionEn:
      "Designed for unhurried mornings, Sagara Garden Villa pairs a shaded timber terrace with an indoor-outdoor living area and stone bathroom. All rates and details shown are simulated for demonstration.",
    descriptionId:
      "Dirancang untuk pagi yang tenang, Villa Taman Sagara memadukan teras kayu teduh dengan ruang duduk semi-terbuka dan kamar mandi batu alam. Seluruh tarif dan detail merupakan simulasi demo.",
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 78,
    baseRateIdr: 1_500_000,
    cleaningFeeIdr: 250_000,
    minNights: 2,
    maxNights: 14,
    isFeatured: true,
    sortOrder: 1,
    amenityKeys: [
      "air_conditioning",
      "high_speed_wifi",
      "kitchenette",
      "tropical_garden",
      "daily_housekeeping",
      "on_site_parking",
    ],
  },
  {
    slug: "pool-villa",
    status: "ACTIVE",
    nameEn: "Sagara Pool Villa",
    nameId: "Villa Kolam Sagara",
    summaryEn: "One-bedroom sanctuary with a private plunge pool and sunlit timber deck.",
    summaryId: "Villa satu kamar tidur dengan kolam renang pribadi dan dek kayu yang cerah.",
    descriptionEn:
      "Sagara Pool Villa opens directly onto a private plunge pool bordered by coastal palms. Includes an indoor lounge, kitchenette, and soaking tub. Demo rate for portfolio evaluation.",
    descriptionId:
      "Villa Kolam Sagara menghadap langsung ke kolam renang pribadi yang dikelilingi tanaman tropis. Dilengkapi ruang santai dalam, dapur kecil, dan bak mandi batu. Tarif demo untuk evaluasi portofolio.",
    maxGuests: 3,
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 105,
    baseRateIdr: 2_200_000,
    cleaningFeeIdr: 300_000,
    minNights: 2,
    maxNights: 21,
    isFeatured: true,
    sortOrder: 2,
    amenityKeys: [
      "air_conditioning",
      "high_speed_wifi",
      "kitchenette",
      "soaking_tub",
      "private_pool",
      "sun_terrace",
      "daily_housekeeping",
      "on_site_parking",
    ],
  },
  {
    slug: "family-residence",
    status: "ACTIVE",
    nameEn: "Sagara Family Residence",
    nameId: "Residensi Keluarga Sagara",
    summaryEn: "Two-bedroom coastal residence with shared dining pavilion and private pool.",
    summaryId: "Residensi dua kamar tidur dengan paviliun makan bersama dan kolam pribadi.",
    descriptionEn:
      "Built for families or small groups, Sagara Family Residence provides two ensuite bedrooms, a breezy dining pavilion, and a walled garden pool. All details are fictional demonstration content.",
    descriptionId:
      "Dibangun untuk keluarga atau grup kecil, Residensi Keluarga Sagara menyediakan dua kamar tidur dengan kamar mandi dalam, paviliun makan, dan kolam taman tertutup. Seluruh informasi adalah konten demo fiktif.",
    maxGuests: 5,
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 165,
    baseRateIdr: 3_400_000,
    cleaningFeeIdr: 450_000,
    minNights: 2,
    maxNights: 30,
    isFeatured: true,
    sortOrder: 3,
    amenityKeys: [
      "air_conditioning",
      "high_speed_wifi",
      "kitchenette",
      "dedicated_workspace",
      "soaking_tub",
      "private_pool",
      "tropical_garden",
      "sun_terrace",
      "daily_housekeeping",
      "on_site_parking",
    ],
  },
  {
    slug: "loft-suite",
    status: "ACTIVE",
    nameEn: "Sagara Loft Suite",
    nameId: "Suite Loteng Sagara",
    summaryEn: "Elevated studio suite with a reading desk, balcony breeze, and compact pantry.",
    summaryId: "Suite studio bertingkat dengan meja baca, balkon sejuk, dan pantri ringkas.",
    descriptionEn:
      "Ideal for solo travelers or couples on a focused coastal retreat, Sagara Loft Suite offers elevated garden views and a quiet workspace. Simulated portfolio property.",
    descriptionId:
      "Cocok bagi pelancong tunggal atau pasangan, Suite Loteng Sagara menawarkan pemandangan taman dari lantai atas dan ruang kerja tenang. Properti simulasi portofolio.",
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 62,
    baseRateIdr: 1_250_000,
    cleaningFeeIdr: 200_000,
    minNights: 1,
    maxNights: 14,
    isFeatured: false,
    sortOrder: 4,
    amenityKeys: [
      "air_conditioning",
      "high_speed_wifi",
      "kitchenette",
      "dedicated_workspace",
      "daily_housekeeping",
    ],
  },
  {
    slug: "cliff-pavilion",
    status: "DRAFT",
    nameEn: "Sagara Cliff Pavilion",
    nameId: "Paviliun Tebing Sagara",
    summaryEn:
      "Upcoming two-bedroom pavilion currently in draft state (hidden from public catalog).",
    summaryId:
      "Paviliun dua kamar tidur yang masih berstatus draf (tidak tampil di katalog publik).",
    descriptionEn:
      "Draft unit included in seed data to demonstrate status filtering between public catalog and admin unit management.",
    descriptionId:
      "Unit draf pada data seed untuk mendemonstrasikan penyaringan status antara katalog publik dan manajemen unit admin.",
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 140,
    baseRateIdr: 2_900_000,
    cleaningFeeIdr: 350_000,
    minNights: 2,
    maxNights: 21,
    isFeatured: false,
    sortOrder: 5,
    amenityKeys: ["air_conditioning", "high_speed_wifi", "private_pool", "sun_terrace"],
  },
];

interface SeedGuestInput {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  preferredLocale: "en" | "id";
  notes?: string;
}

const SEED_GUESTS: readonly SeedGuestInput[] = [
  {
    fullName: "Nadia Pratama",
    email: "nadia.pratama@example.com",
    phone: "+62 812 0000 0101",
    country: "ID",
    preferredLocale: "id",
    notes: "Prefers ground-floor access.",
  },
  {
    fullName: "Liam Vance",
    email: "liam.vance@example.com",
    phone: "+61 400 000 102",
    country: "AU",
    preferredLocale: "en",
  },
  {
    fullName: "Siti Rahmawati",
    email: "siti.rahmawati@example.com",
    phone: "+62 812 0000 0103",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Clara Lindqvist",
    email: "clara.lindqvist@example.com",
    phone: "+46 70 000 0104",
    country: "SE",
    preferredLocale: "en",
  },
  {
    fullName: "Bima Wijaya",
    email: "bima.wijaya@example.com",
    phone: "+62 812 0000 0105",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Hannah Mercer",
    email: "hannah.mercer@example.com",
    phone: "+44 7700 900106",
    country: "GB",
    preferredLocale: "en",
  },
  {
    fullName: "Rendra Kusuma",
    email: "rendra.kusuma@example.com",
    phone: "+62 812 0000 0107",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Kenji Takahashi",
    email: "kenji.takahashi@example.com",
    phone: "+81 90 0000 0108",
    country: "JP",
    preferredLocale: "en",
  },
  {
    fullName: "Ayu Lestari",
    email: "ayu.lestari@example.com",
    phone: "+62 812 0000 0109",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Mateo Silva",
    email: "mateo.silva@example.com",
    phone: "+65 8000 0110",
    country: "SG",
    preferredLocale: "en",
  },
  {
    fullName: "Dewi Anggraini",
    email: "dewi.anggraini@example.com",
    phone: "+62 812 0000 0111",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Noah Bennett",
    email: "noah.bennett@example.com",
    phone: "+64 21 000 0112",
    country: "NZ",
    preferredLocale: "en",
  },
  {
    fullName: "Fajar Nugroho",
    email: "fajar.nugroho@example.com",
    phone: "+62 812 0000 0113",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Elena Rostova",
    email: "elena.rostova@example.com",
    phone: "+49 151 00000114",
    country: "DE",
    preferredLocale: "en",
  },
  {
    fullName: "Putri Maharani",
    email: "putri.maharani@example.com",
    phone: "+62 812 0000 0115",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Lucas Moreau",
    email: "lucas.moreau@example.com",
    phone: "+33 6 00 00 01 16",
    country: "FR",
    preferredLocale: "en",
  },
  {
    fullName: "Arif Budiman",
    email: "arif.budiman@example.com",
    phone: "+62 812 0000 0117",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Maya Lin",
    email: "maya.lin@example.com",
    phone: "+65 8000 0118",
    country: "SG",
    preferredLocale: "en",
  },
  {
    fullName: "Dimas Saputra",
    email: "dimas.saputra@example.com",
    phone: "+62 812 0000 0119",
    country: "ID",
    preferredLocale: "id",
  },
  {
    fullName: "Sophie Laurent",
    email: "sophie.laurent@example.com",
    phone: "+31 6 00000120",
    country: "NL",
    preferredLocale: "en",
  },
];

interface SeedPaymentSpec {
  kind: PaymentKind;
  amountIdr: number;
  method: PaymentMethod;
  reference: string;
  note?: string;
  voidReason?: string;
}

interface SeedReservationSpec {
  unitSlug: string;
  guestIndex: number;
  startOffsetDays: number;
  nights: number;
  status: ReservationStatus;
  source: ReservationSource;
  adults: number;
  children?: number;
  discountIdr?: number;
  complimentary?: boolean;
  specialRequests?: string;
  internalNotes?: string;
  cancelReason?: string;
  paymentPlan: "NONE" | "HALF" | "FULL" | "OVERPAID" | "REFUND_PARTIAL" | "VOIDED";
}

// 40 carefully non-overlapping stays per unit (including same-day turnovers!)
const SEED_RESERVATIONS: readonly SeedReservationSpec[] = [
  // --- garden-villa (10 reservations) ---
  {
    unitSlug: "garden-villa",
    guestIndex: 0,
    startOffsetDays: -35,
    nights: 3,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
    specialRequests: "Late arrival around 8 PM.",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 1,
    startOffsetDays: -32, // same-day turnover from -35.. -32
    nights: 4,
    status: "CHECKED_OUT",
    source: "ADMIN",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 2,
    startOffsetDays: -24,
    nights: 3,
    status: "CHECKED_OUT",
    source: "WHATSAPP",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 3,
    startOffsetDays: -18,
    nights: 3,
    status: "CANCELLED",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "HALF", // cancelled with netPaid > 0 -> refund pending in reports (BR-11)
    cancelReason: "Guest rescheduled travel dates.",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 4,
    startOffsetDays: -12,
    nights: 4,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 5,
    startOffsetDays: -2,
    nights: 4, // currently in-house (-2 to +2)
    status: "CHECKED_IN",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
    specialRequests: "Extra pillows please.",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 6,
    startOffsetDays: 2, // same-day turnover on day +2!
    nights: 3,
    status: "CONFIRMED",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "HALF",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 7,
    startOffsetDays: 7,
    nights: 4,
    status: "CONFIRMED",
    source: "ADMIN",
    adults: 2,
    paymentPlan: "NONE",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 8,
    startOffsetDays: 14,
    nights: 3,
    status: "PENDING",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "NONE",
    specialRequests: "Quiet courtyard room preferred.",
  },
  {
    unitSlug: "garden-villa",
    guestIndex: 9,
    startOffsetDays: 20,
    nights: 3,
    status: "CONFIRMED",
    source: "WHATSAPP",
    adults: 2,
    paymentPlan: "OVERPAID",
    internalNotes: "Guest transferred slightly above total; difference noted.",
  },

  // --- pool-villa (10 reservations) ---
  {
    unitSlug: "pool-villa",
    guestIndex: 10,
    startOffsetDays: -30,
    nights: 4,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 2,
    children: 1,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 11,
    startOffsetDays: -22,
    nights: 3,
    status: "CHECKED_OUT",
    source: "PHONE",
    adults: 2,
    paymentPlan: "REFUND_PARTIAL",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 12,
    startOffsetDays: -14,
    nights: 3,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 13,
    startOffsetDays: -7,
    nights: 3,
    status: "CHECKED_OUT",
    source: "ADMIN",
    adults: 2,
    paymentPlan: "HALF", // checked out with outstanding balance
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 14,
    startOffsetDays: -3,
    nights: 3, // checking out today (-3 to 0)
    status: "CHECKED_IN",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 15,
    startOffsetDays: 0, // checking in today (0 to +4), same-day turnover!
    nights: 4,
    status: "CONFIRMED",
    source: "WEBSITE",
    adults: 2,
    children: 1,
    paymentPlan: "HALF",
    specialRequests: "Arriving from airport around 3 PM.",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 16,
    startOffsetDays: 5,
    nights: 3,
    status: "CONFIRMED",
    source: "WHATSAPP",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 17,
    startOffsetDays: 10,
    nights: 3,
    status: "PENDING",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "NONE",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 18,
    startOffsetDays: 15,
    nights: 4,
    status: "CONFIRMED",
    source: "WEBSITE",
    adults: 3,
    paymentPlan: "VOIDED",
  },
  {
    unitSlug: "pool-villa",
    guestIndex: 19,
    startOffsetDays: 22,
    nights: 3,
    status: "CANCELLED",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "NONE",
    cancelReason: "Flight cancelled by airline.",
  },

  // --- family-residence (10 reservations) ---
  {
    unitSlug: "family-residence",
    guestIndex: 0,
    startOffsetDays: -28,
    nights: 5,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 4,
    children: 1,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 2,
    startOffsetDays: -20,
    nights: 4,
    status: "CHECKED_OUT",
    source: "ADMIN",
    adults: 3,
    children: 1,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 4,
    startOffsetDays: -11,
    nights: 4,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 4,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 6,
    startOffsetDays: -5,
    nights: 3,
    status: "CANCELLED",
    source: "WHATSAPP",
    adults: 4,
    paymentPlan: "NONE",
    cancelReason: "Duplicate inquiry.",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 8,
    startOffsetDays: -1,
    nights: 4, // in-house (-1 to +3)
    status: "CHECKED_IN",
    source: "WEBSITE",
    adults: 4,
    children: 1,
    paymentPlan: "HALF",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 10,
    startOffsetDays: 3, // same-day turnover on +3
    nights: 4,
    status: "CONFIRMED",
    source: "WEBSITE",
    adults: 4,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 12,
    startOffsetDays: 9,
    nights: 3,
    status: "CONFIRMED",
    source: "PHONE",
    adults: 3,
    children: 2,
    paymentPlan: "HALF",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 14,
    startOffsetDays: 14,
    nights: 4,
    status: "PENDING",
    source: "WEBSITE",
    adults: 4,
    paymentPlan: "NONE",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 16,
    startOffsetDays: 19,
    nights: 3,
    status: "CONFIRMED",
    source: "ADMIN",
    adults: 2,
    complimentary: true, // totalIdr = 0 -> PAID (DATABASE §5.3)
    paymentPlan: "NONE",
    internalNotes: "Complimentary partner stay.",
  },
  {
    unitSlug: "family-residence",
    guestIndex: 18,
    startOffsetDays: 25,
    nights: 4,
    status: "PENDING",
    source: "WEBSITE",
    adults: 4,
    children: 1,
    paymentPlan: "NONE",
  },

  // --- loft-suite (10 reservations) ---
  {
    unitSlug: "loft-suite",
    guestIndex: 1,
    startOffsetDays: -26,
    nights: 2,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 1,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 3,
    startOffsetDays: -19,
    nights: 3,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 5,
    startOffsetDays: -13,
    nights: 2,
    status: "CHECKED_OUT",
    source: "WHATSAPP",
    adults: 1,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 7,
    startOffsetDays: -8,
    nights: 3,
    status: "CHECKED_OUT",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 9,
    startOffsetDays: 0, // arriving today (0 to +2)
    nights: 2,
    status: "CONFIRMED",
    source: "WEBSITE",
    adults: 1,
    paymentPlan: "FULL",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 11,
    startOffsetDays: 2, // same-day turnover on +2
    nights: 3,
    status: "CONFIRMED",
    source: "ADMIN",
    adults: 2,
    paymentPlan: "HALF",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 13,
    startOffsetDays: 6,
    nights: 2,
    status: "PENDING",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "NONE",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 15,
    startOffsetDays: 10,
    nights: 3,
    status: "CONFIRMED",
    source: "WEBSITE",
    adults: 1,
    discountIdr: 250_000,
    paymentPlan: "NONE",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 17,
    startOffsetDays: 16,
    nights: 2,
    status: "CANCELLED",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "NONE",
    cancelReason: "Changed travel plans.",
  },
  {
    unitSlug: "loft-suite",
    guestIndex: 19,
    startOffsetDays: 21,
    nights: 3,
    status: "PENDING",
    source: "WEBSITE",
    adults: 2,
    paymentPlan: "NONE",
  },
];

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function buildDeterministicCode(checkIn: Date, index: number): string {
  const yy = String(checkIn.getUTCFullYear()).slice(-2);
  const mm = String(checkIn.getUTCMonth() + 1).padStart(2, "0");
  const len = CODE_ALPHABET.length;
  const n = (index + 1) * 7919;
  const c1 = CODE_ALPHABET[Math.floor(index / len) % len]!;
  const c2 = CODE_ALPHABET[index % len]!;
  const c3 = CODE_ALPHABET[Math.floor(n / len) % len]!;
  const c4 = CODE_ALPHABET[n % len]!;
  return `SGV-${yy}${mm}-${c1}${c2}${c3}${c4}`;
}

function buildPaymentSpecs(
  plan: SeedReservationSpec["paymentPlan"],
  totalIdr: number,
  index: number,
): SeedPaymentSpec[] {
  if (totalIdr <= 0 || plan === "NONE") {
    return [];
  }
  const refPrefix = `DEMO-TRX-${String(index + 1).padStart(3, "0")}`;
  switch (plan) {
    case "HALF":
      return [
        {
          kind: "PAYMENT",
          amountIdr: Math.floor(totalIdr / 2),
          method: "BANK_TRANSFER",
          reference: `${refPrefix}-A`,
          note: "50% deposit transfer",
        },
      ];
    case "FULL":
      return [
        {
          kind: "PAYMENT",
          amountIdr: totalIdr,
          method: index % 2 === 0 ? "BANK_TRANSFER" : "QRIS",
          reference: `${refPrefix}-F`,
          note: "Full settlement",
        },
      ];
    case "OVERPAID":
      return [
        {
          kind: "PAYMENT",
          amountIdr: totalIdr + 500_000,
          method: "BANK_TRANSFER",
          reference: `${refPrefix}-O`,
          note: "Transfer exceeded invoice by IDR 500,000",
        },
      ];
    case "REFUND_PARTIAL":
      return [
        {
          kind: "PAYMENT",
          amountIdr: totalIdr,
          method: "BANK_TRANSFER",
          reference: `${refPrefix}-P`,
          note: "Initial full payment",
        },
        {
          kind: "REFUND",
          amountIdr: 500_000,
          method: "BANK_TRANSFER",
          reference: `${refPrefix}-R`,
          note: "Partial refund adjustment",
        },
      ];
    case "VOIDED":
      return [
        {
          kind: "PAYMENT",
          amountIdr: totalIdr,
          method: "CASH",
          reference: `${refPrefix}-V`,
          note: "Entered on wrong reservation",
          voidReason: "Duplicate entry voided during reconciliation",
        },
      ];
  }
}

export async function runSeed(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{
  usersCount: number;
  unitsCount: number;
  amenitiesCount: number;
  guestsCount: number;
  reservationsCount: number;
}> {
  const credentials = validateSeedEnv(env);
  const today = getPropertyToday();

  const [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hash(credentials.adminPassword),
    hash(credentials.staffPassword),
  ]);

  // Clear existing demo records in safe dependency order
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.unitBlock.deleteMany(),
    prisma.rateRule.deleteMany(),
    prisma.unitImage.deleteMany(),
    prisma.unitAmenity.deleteMany(),
    prisma.amenity.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.guest.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const adminUser = await prisma.user.create({
    data: {
      email: credentials.adminEmail,
      name: "Sagara Admin",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: credentials.staffEmail,
      name: "Sagara Reservation Staff",
      passwordHash: staffPasswordHash,
      role: UserRole.STAFF,
      isActive: true,
    },
  });

  const amenityMap = new Map<string, string>();
  for (const item of SEED_AMENITIES) {
    const created = await prisma.amenity.create({ data: item });
    amenityMap.set(item.key, created.id);
  }

  const unitMap = new Map<string, { id: string; baseRateIdr: number; cleaningFeeIdr: number }>();

  for (const u of SEED_UNITS) {
    const { amenityKeys, ...unitFields } = u;
    const createdUnit = await prisma.unit.create({
      data: {
        ...unitFields,
        amenities: {
          create: amenityKeys.map((key) => ({
            amenityId: amenityMap.get(key)!,
          })),
        },
      },
    });
    unitMap.set(u.slug, {
      id: createdUnit.id,
      baseRateIdr: createdUnit.baseRateIdr,
      cleaningFeeIdr: createdUnit.cleaningFeeIdr,
    });
  }

  // Add non-overlapping UnitBlocks far in the future (+32..+35 days) and past
  const gardenUnit = unitMap.get("garden-villa")!;
  const poolUnit = unitMap.get("pool-villa")!;
  const blocksData: Array<{
    unitId: string;
    startDate: Date;
    endDate: Date;
    reason: BlockReason;
    note: string;
    createdById: string;
  }> = [
    {
      unitId: gardenUnit.id,
      startDate: addDaysDateOnly(today, 32),
      endDate: addDaysDateOnly(today, 35),
      reason: "MAINTENANCE",
      note: "Scheduled timber deck refinishing",
      createdById: adminUser.id,
    },
    {
      unitId: poolUnit.id,
      startDate: addDaysDateOnly(today, 36),
      endDate: addDaysDateOnly(today, 39),
      reason: "OWNER_USE",
      note: "Owner inspection visit",
      createdById: adminUser.id,
    },
  ];

  for (const block of blocksData) {
    await prisma.unitBlock.create({ data: block });
  }

  // Add illustrative seasonal RateRules (+40..+55 days)
  await prisma.rateRule.create({
    data: {
      unitId: gardenUnit.id,
      label: "Coastal High Season (Demo)",
      startDate: addDaysDateOnly(today, 40),
      endDate: addDaysDateOnly(today, 55),
      nightlyRateIdr: 1_850_000,
      minNights: 3,
    },
  });

  const createdGuests = [];
  for (const g of SEED_GUESTS) {
    const guest = await prisma.guest.create({
      data: {
        fullName: g.fullName,
        email: g.email,
        emailNormalized: g.email.trim().toLowerCase(),
        phone: g.phone,
        phoneNormalized: g.phone.replace(/[^\d+]/g, ""),
        country: g.country,
        preferredLocale: g.preferredLocale,
        notes: g.notes ?? null,
      },
    });
    createdGuests.push(guest);
  }

  for (let i = 0; i < SEED_RESERVATIONS.length; i++) {
    const spec = SEED_RESERVATIONS[i]!;
    const unit = unitMap.get(spec.unitSlug)!;
    const guest = createdGuests[spec.guestIndex % createdGuests.length]!;

    const checkIn = addDaysDateOnly(today, spec.startOffsetDays);
    const checkOut = addDaysDateOnly(checkIn, spec.nights);
    const nights = diffNights(checkIn, checkOut);

    const nightlySubtotalIdr = spec.complimentary ? 0 : unit.baseRateIdr * nights;
    const cleaningFeeIdr = spec.complimentary ? 0 : unit.cleaningFeeIdr;
    const discountIdr = spec.complimentary ? 0 : (spec.discountIdr ?? 0);
    const totalIdr = Math.max(0, nightlySubtotalIdr + cleaningFeeIdr - discountIdr);

    const nightBreakdown = [];
    for (let n = 0; n < nights; n++) {
      nightBreakdown.push({
        date: formatDateOnly(addDaysDateOnly(checkIn, n)),
        rateIdr: spec.complimentary ? 0 : unit.baseRateIdr,
      });
    }

    const paymentSpecs = buildPaymentSpecs(spec.paymentPlan, totalIdr, i);
    const paymentEntriesForCalc = paymentSpecs.map((p) => ({
      kind: p.kind,
      amountIdr: p.amountIdr,
      voidedAt: p.voidReason ? new Date() : null,
    }));

    const netPaidIdr = computeNetPaidIdr(paymentEntriesForCalc);
    const paymentStatus = derivePaymentStatus(totalIdr, netPaidIdr);
    const code = buildDeterministicCode(checkIn, i);

    const nowTs = new Date();
    const reservation = await prisma.reservation.create({
      data: {
        code,
        unitId: unit.id,
        guestId: guest.id,
        status: spec.status,
        source: spec.source,
        checkIn,
        checkOut,
        nights,
        adults: spec.adults,
        children: spec.children ?? 0,
        nightlySubtotalIdr,
        cleaningFeeIdr,
        discountIdr,
        totalIdr,
        netPaidIdr,
        paymentStatus,
        pricingSnapshot: {
          nights: nightBreakdown,
          cleaningFeeIdr,
          discountIdr,
        },
        locale: guest.preferredLocale,
        specialRequests: spec.specialRequests ?? null,
        internalNotes: spec.internalNotes ?? null,
        confirmedAt:
          spec.status === "CONFIRMED" ||
          spec.status === "CHECKED_IN" ||
          spec.status === "CHECKED_OUT"
            ? nowTs
            : null,
        checkedInAt: spec.status === "CHECKED_IN" || spec.status === "CHECKED_OUT" ? nowTs : null,
        checkedOutAt: spec.status === "CHECKED_OUT" ? nowTs : null,
        cancelledAt: spec.status === "CANCELLED" ? nowTs : null,
        cancelReason: spec.cancelReason ?? null,
        createdById: spec.source === "WEBSITE" ? null : staffUser.id,
      },
    });

    for (const p of paymentSpecs) {
      await prisma.payment.create({
        data: {
          reservationId: reservation.id,
          kind: p.kind,
          amountIdr: p.amountIdr,
          method: p.method,
          paidAt: nowTs,
          reference: p.reference,
          note: p.note ?? null,
          recordedById: staffUser.id,
          voidedAt: p.voidReason ? nowTs : null,
          voidReason: p.voidReason ?? null,
          voidedById: p.voidReason ? adminUser.id : null,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: spec.source === "WEBSITE" ? null : staffUser.id,
        action: "reservation.seed",
        entityType: "Reservation",
        entityId: reservation.id,
        metadata: {
          code: reservation.code,
          status: reservation.status,
          paymentStatus: reservation.paymentStatus,
        },
      },
    });
  }

  return {
    usersCount: 2,
    unitsCount: SEED_UNITS.length,
    amenitiesCount: SEED_AMENITIES.length,
    guestsCount: createdGuests.length,
    reservationsCount: SEED_RESERVATIONS.length,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";

if (import.meta.url === invokedPath) {
  loadSeedEnvFiles();
  const prisma = new PrismaClient();
  runSeed(prisma)
    .then((summary) => {
      console.log(
        `[db:seed] Seeded ${summary.usersCount} users, ${summary.unitsCount} units, ${summary.amenitiesCount} amenities, ${summary.guestsCount} guests, ${summary.reservationsCount} reservations.`,
      );
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[db:seed FAILED] ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
