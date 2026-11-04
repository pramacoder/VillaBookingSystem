import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Table({
  className = "",
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[8px] border border-gray-100 bg-white">
      <table
        className={`w-full border-collapse text-left font-sans text-sm text-gray-800 ${className}`.trim()}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`sticky top-0 z-10 border-b border-gray-100 bg-gray-100 font-sans text-xs font-semibold tracking-wider text-gray-600 uppercase ${className}`.trim()}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-gray-100 ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`h-12 transition-colors hover:bg-gray-100/60 ${className}`.trim()} {...props}>
      {children}
    </tr>
  );
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function TableHead({ numeric = false, className = "", children, ...props }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-semibold ${
        numeric ? "text-right tabular-nums" : "text-left"
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  );
}

export type SortDirection = "ascending" | "descending" | "none";

export interface SortableTableHeadProps extends TableHeadProps {
  sortDirection?: SortDirection;
  onSort?: () => void;
}

export function SortableTableHead({
  sortDirection = "none",
  onSort,
  numeric = false,
  className = "",
  children,
  ...props
}: SortableTableHeadProps) {
  const Icon =
    sortDirection === "ascending"
      ? ArrowUp
      : sortDirection === "descending"
        ? ArrowDown
        : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={sortDirection}
      className={`px-4 py-3 font-semibold ${
        numeric ? "text-right tabular-nums" : "text-left"
      } ${className}`.trim()}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex items-center gap-1.5 rounded-[6px] py-0.5 text-xs font-semibold tracking-wider text-gray-600 uppercase hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          numeric ? "ml-auto" : ""
        }`.trim()}
      >
        <span>{children}</span>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </button>
    </th>
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

export function TableCell({ numeric = false, className = "", children, ...props }: TableCellProps) {
  return (
    <td
      className={`px-4 py-3 align-middle ${
        numeric ? "text-right tabular-nums" : "text-left"
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </td>
  );
}

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (nextPage: number) => void;
  previousLabel?: string;
  nextLabel?: string;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  previousLabel = "Previous",
  nextLabel = "Next",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-b-[8px] border border-t-0 border-gray-100 bg-white px-4 py-3 font-sans text-xs text-gray-600">
      <p className="tabular-nums">
        Showing <strong className="font-semibold text-gray-800">{from}</strong>–
        <strong className="font-semibold text-gray-800">{to}</strong> of{" "}
        <strong className="font-semibold text-gray-800">{total}</strong>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          {previousLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
