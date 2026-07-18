import { useMemo } from "react";
import { Link } from "react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ImageOff, Pencil, Trash2 } from "lucide-react";
import type { LocalizedDescription, LocalizedName } from "@es-market/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ProductRow = {
  id: string;
  name: LocalizedName;
  description: LocalizedDescription | null;
  price: number;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  category: { id: string; name: LocalizedName };
  assignedAgent: { id: string; name: string } | null;
};

export const STOCK_STATUSES = ["in-stock", "low-stock", "out-of-stock"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export function getStockStatus(product: {
  stock: number;
  lowStockThreshold: number;
}): StockStatus {
  if (product.stock === 0) return "out-of-stock";
  if (product.stock < product.lowStockThreshold) return "low-stock";
  return "in-stock";
}

const columnHelper = createColumnHelper<ProductRow>();

export default function ProductsTable({
  products,
  sorting,
  onSortingChange,
  onEdit,
  onDelete,
}: {
  products: ProductRow[] | null;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onEdit: (product: ProductRow) => void;
  onDelete: (product: ProductRow) => void;
}) {
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "image",
        header: () => <span className="sr-only">Image</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Avatar>
            {row.original.imageUrl && <AvatarImage src={row.original.imageUrl} alt="" />}
            <AvatarFallback aria-label="No image">
              <ImageOff className="size-4" />
            </AvatarFallback>
          </Avatar>
        ),
      }),
      columnHelper.accessor((row) => row.name.en, {
        id: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            to={`/admin/products/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name.en}
          </Link>
        ),
      }),
      columnHelper.accessor((row) => row.category.name.en, {
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.category.name.en}</span>
        ),
      }),
      columnHelper.accessor((row) => row.assignedAgent?.name ?? "", {
        id: "agent",
        header: "Agent",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.assignedAgent?.name ?? "Unassigned"}
          </span>
        ),
      }),
      columnHelper.accessor("price", {
        id: "price",
        header: "Price",
        cell: ({ getValue }) => <div className="text-right">{getValue()}</div>,
      }),
      columnHelper.accessor("stock", {
        id: "stock",
        header: "Stock",
        cell: ({ getValue }) => <div className="text-right">{getValue()}</div>,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${row.original.name.en}`}
              onClick={() => onEdit(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${row.original.name.en}`}
              onClick={() => onDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete],
  );

  const table = useReactTable({
    data: products ?? [],
    columns,
    state: { sorting },
    onSortingChange,
    // The server always needs a sortBy/sortOrder to query with, so a column
    // stays sorted rather than cycling to an "unsorted" third state.
    enableSortingRemoval: false,
    enableMultiSort: false,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const sortIcon = {
    asc: <ArrowUp className="ml-1.5 size-3.5" />,
    desc: <ArrowDown className="ml-1.5 size-3.5" />,
    false: <ArrowUpDown className="ml-1.5 size-3.5 text-muted-foreground" />,
  } as const;

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={
                  header.column.id === "price" || header.column.id === "stock"
                    ? "text-right"
                    : undefined
                }
              >
                {header.column.getCanSort() ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8 has-[>svg]:px-2"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sortIcon[header.column.getIsSorted().toString() as "asc" | "desc" | "false"]}
                  </Button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {products === null
          ? Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="size-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-3 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-3 w-10" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))
          : table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
