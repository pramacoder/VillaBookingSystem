"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { LanguageToggle } from "@/components/admin/language-toggle";
import { ToastProvider } from "@/components/ui/toast";
import type { AppMessages, SupportedLocale } from "@/lib/i18n/messages";

export interface AdminShellUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AdminNavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export function isNavItemActive(pathname: string, itemHref: string): boolean {
  if (itemHref === "/admin") {
    return pathname === "/admin";
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

export function AdminShell({
  user,
  locale,
  messages,
  children,
}: {
  user: AdminShellUser;
  locale: SupportedLocale;
  messages: AppMessages;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/admin";
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const navItems: AdminNavItem[] = React.useMemo(() => {
    const base: AdminNavItem[] = [
      {
        key: "dashboard",
        href: "/admin",
        label: messages.admin.nav.dashboard,
        icon: LayoutDashboard,
      },
      {
        key: "calendar",
        href: "/admin/calendar",
        label: messages.admin.nav.calendar,
        icon: CalendarRange,
      },
      {
        key: "reservations",
        href: "/admin/reservations",
        label: messages.admin.nav.reservations,
        icon: ClipboardList,
      },
      {
        key: "guests",
        href: "/admin/guests",
        label: messages.admin.nav.guests,
        icon: Users,
      },
      {
        key: "units",
        href: "/admin/units",
        label: messages.admin.nav.units,
        icon: Home,
      },
      {
        key: "reports",
        href: "/admin/reports",
        label: messages.admin.nav.reports,
        icon: BarChart3,
      },
    ];

    if (user.role === "ADMIN") {
      base.push({
        key: "users",
        href: "/admin/users",
        label: messages.admin.nav.users,
        icon: ShieldCheck,
        adminOnly: true,
      });
    }

    return base;
  }, [messages.admin.nav, user.role]);

  const activeNav = navItems.find((item) => isNavItemActive(pathname, item.href)) ?? navItems[0];

  React.useEffect(() => {
    if (!isDrawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDrawerOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
        {/* Top bar teal-300 accent strip (DESIGN.md §7.1 — dark text only on teal-300) */}
        <div className="bg-teal-300 px-4 py-1 text-xs font-medium text-gray-800 lg:px-6">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between">
            <span>
              {messages.brand.name} — {messages.admin.consoleBadge}
            </span>
            <span className="hidden sm:inline">Asia/Makassar (WITA)</span>
          </div>
        </div>

        <div className="flex min-h-[calc(100vh-24px)]">
          {/* Desktop Fixed Sidebar (>1024px / lg): 248px expanded, 72px icon rail collapsed (DESIGN.md §5 & §7.1) */}
          <aside
            aria-label="Primary admin navigation"
            className={`hidden shrink-0 flex-col border-r border-gray-100 bg-white transition-[width] duration-200 lg:flex ${
              isCollapsed ? "w-[72px]" : "w-[248px]"
            }`}
          >
            <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
              {!isCollapsed ? (
                <Link
                  href="/admin"
                  className="font-display text-2xl font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {messages.brand.name}
                </Link>
              ) : (
                <Link
                  href="/admin"
                  aria-label={messages.brand.name}
                  className="mx-auto font-display text-xl font-bold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  SV
                </Link>
              )}
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-label={
                  isCollapsed
                    ? messages.admin.nav.expandSidebar
                    : messages.admin.nav.collapseSidebar
                }
                title={
                  isCollapsed
                    ? messages.admin.nav.expandSidebar
                    : messages.admin.nav.collapseSidebar
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            <nav className="flex-1 space-y-1 p-2" aria-label="Main modules">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      active
                        ? "border-l-4 border-blue-600 bg-gray-100 font-semibold text-gray-800"
                        : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-800"
                    } ${isCollapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!isCollapsed ? <span>{item.label}</span> : null}
                    {isCollapsed ? <span className="sr-only">{item.label}</span> : null}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Tablet / Mobile Overlay Drawer (<=1024px) (DESIGN.md §5 & §11) */}
          {isDrawerOpen ? (
            <div
              className="fixed inset-0 z-50 flex lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation drawer"
            >
              <div
                className="fixed inset-0 bg-gray-900/50"
                onClick={() => setIsDrawerOpen(false)}
              />
              <aside className="relative z-10 flex w-[248px] flex-col border-r border-gray-100 bg-white">
                <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
                  <Link
                    href="/admin"
                    onClick={() => setIsDrawerOpen(false)}
                    className="font-display text-2xl font-semibold text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    {messages.brand.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    aria-label={messages.admin.nav.closeMenu}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] text-gray-600 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <nav className="flex-1 space-y-1 p-3" aria-label="Mobile modules">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(pathname, item.href);
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setIsDrawerOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                          active
                            ? "border-l-4 border-blue-600 bg-gray-100 font-semibold text-gray-800"
                            : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-800"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </aside>
            </div>
          ) : null}

          {/* Main Column: 64px Top Bar + Content Area (max 1440px, padding 24px desktop / 16px tablet) */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label={messages.admin.nav.openMenu}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[6px] border border-gray-100 text-gray-800 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <span className="font-sans text-sm font-semibold text-gray-800">
                  {activeNav?.label ?? messages.admin.nav.dashboard}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <LanguageToggle locale={locale} label={messages.admin.nav.languageLabel} />

                <span className="hidden items-center gap-1.5 rounded-[6px] bg-teal-300 px-2.5 py-1 text-xs font-medium text-gray-800 sm:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{user.role}</span>
                </span>

                <span className="hidden text-xs text-gray-600 md:inline">
                  {messages.admin.nav.signedInAs}{" "}
                  <strong className="font-medium text-gray-800">{user.email}</strong>
                </span>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-gray-600/35 bg-white px-3.5 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{messages.admin.nav.signOut}</span>
                  </button>
                </form>
              </div>
            </header>

            <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
