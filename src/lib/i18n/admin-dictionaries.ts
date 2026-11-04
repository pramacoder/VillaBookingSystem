export type SupportedLocale = "en" | "id";

export interface AdminAuthDictionary {
  brandName: string;
  adminBadge: string;
  login: {
    eyebrow: string;
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    submitButton: string;
    submittingButton: string;
    invalidCredentials: string;
    rateLimited: string;
    demoNotice: string;
  };
  nav: {
    dashboard: string;
    users: string;
    signOut: string;
    signedInAs: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    forbiddenNotice: string;
    roleCardTitle: string;
    roleCardBody: string;
    sessionStatusLabel: string;
    sessionActiveBadge: string;
  };
  usersPage: {
    title: string;
    subtitle: string;
    tableCaption: string;
    colName: string;
    colEmail: string;
    colRole: string;
    colStatus: string;
    statusActive: string;
    statusInactive: string;
  };
}

export const adminAuthDictionaries: Record<SupportedLocale, AdminAuthDictionary> = {
  en: {
    brandName: "Sagara Villas",
    adminBadge: "Operations Console",
    login: {
      eyebrow: "Staff & Administrator Access",
      title: "Sign in to Sagara Villas",
      subtitle:
        "Enter your operational account credentials to manage reservations, availability, and manual payments.",
      emailLabel: "Work email",
      emailPlaceholder: "name@sagaravillas.example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter your password",
      submitButton: "Sign in",
      submittingButton: "Signing in…",
      invalidCredentials: "Email or password is incorrect.",
      rateLimited: "Too many sign-in attempts. Please wait 15 minutes.",
      demoNotice: "Portfolio demonstration environment — authorized staff accounts only.",
    },
    nav: {
      dashboard: "Overview",
      users: "Users (Admin)",
      signOut: "Sign out",
      signedInAs: "Signed in as",
    },
    dashboard: {
      title: "Operations Overview",
      subtitle:
        "Authenticated operational workspace. Reservations, calendar, payments, and reporting modules are enabled in upcoming milestones.",
      forbiddenNotice:
        "Your account role (STAFF) does not have permission to access Administrator-only settings.",
      roleCardTitle: "Current Session & Role",
      roleCardBody:
        "Server-side role verification (requireRole) is active on all admin routes and API endpoints.",
      sessionStatusLabel: "Account status",
      sessionActiveBadge: "Active session",
    },
    usersPage: {
      title: "User Accounts",
      subtitle:
        "Administrator-only directory of operational accounts. Password hashes are never exposed.",
      tableCaption: "Registered operational users",
      colName: "Name",
      colEmail: "Email",
      colRole: "Role",
      colStatus: "Status",
      statusActive: "Active",
      statusInactive: "Inactive",
    },
  },
  id: {
    brandName: "Sagara Villas",
    adminBadge: "Konsol Operasional",
    login: {
      eyebrow: "Akses Staf & Administrator",
      title: "Masuk ke Sagara Villas",
      subtitle:
        "Masukkan kredensial akun operasional Anda untuk mengelola reservasi, ketersediaan unit, dan pembayaran manual.",
      emailLabel: "Email kerja",
      emailPlaceholder: "nama@sagaravillas.example.com",
      passwordLabel: "Kata sandi",
      passwordPlaceholder: "Masukkan kata sandi Anda",
      submitButton: "Masuk",
      submittingButton: "Sedang masuk…",
      invalidCredentials: "Email atau kata sandi salah.",
      rateLimited: "Terlalu banyak percobaan masuk. Silakan tunggu 15 menit.",
      demoNotice: "Lingkungan demonstrasi portofolio — khusus akun staf resmi.",
    },
    nav: {
      dashboard: "Ringkasan",
      users: "Pengguna (Admin)",
      signOut: "Keluar",
      signedInAs: "Masuk sebagai",
    },
    dashboard: {
      title: "Ringkasan Operasional",
      subtitle:
        "Ruang kerja operasional terautentikasi. Modul reservasi, kalender, pembayaran, dan laporan diaktifkan pada milestone berikutnya.",
      forbiddenNotice:
        "Peran akun Anda (STAFF) tidak memiliki izin untuk mengakses pengaturan khusus Administrator.",
      roleCardTitle: "Sesi & Peran Saat Ini",
      roleCardBody:
        "Verifikasi peran sisi server (requireRole) aktif pada seluruh rute dan endpoint API admin.",
      sessionStatusLabel: "Status akun",
      sessionActiveBadge: "Sesi aktif",
    },
    usersPage: {
      title: "Akun Pengguna",
      subtitle:
        "Direktori akun operasional khusus Administrator. Hash kata sandi tidak pernah ditampilkan.",
      tableCaption: "Daftar pengguna operasional terdaftar",
      colName: "Nama",
      colEmail: "Email",
      colRole: "Peran",
      colStatus: "Status",
      statusActive: "Aktif",
      statusInactive: "Nonaktif",
    },
  },
};

export function getAdminAuthDictionary(locale: SupportedLocale = "en"): AdminAuthDictionary {
  return adminAuthDictionaries[locale] ?? adminAuthDictionaries.en;
}
