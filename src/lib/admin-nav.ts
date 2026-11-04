export function isNavItemActive(pathname: string, itemHref: string): boolean {
  if (itemHref === "/admin") {
    return pathname === "/admin";
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
