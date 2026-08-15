import { useMemo } from "react";
import { Link } from "react-router";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ImageOff,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { LocalizedDescription, LocalizedName, UpdateProductInput } from "@es-market/core";
import { pingClassificationAccepted } from "@/lib/product-classification";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  salePrice: number | null;
  stock: number;
  lowStockThreshold: number;
  images: string[];
  tags: string[];
  size: string | null;
  color: string | null;
  category: { id: string; name: LocalizedName };
  assignedAgent: { id: string; name: string } | null;
  aiSuggestedCategoryId: string | null;
  aiSuggestedTags: string[];
  aiSuggestedAt: string | null;
};

type Category = { id: string; name: LocalizedName };

// Reviews a bulk-reclassify job's pending suggestion for one product — Apply
// merges it into the product (via the existing PUT route, which also clears
// the suggestion fields), Dismiss just clears them without changing the
// product. Self-contained so it doesn't need to touch ProductForm.tsx.
export function SuggestionBadge({ product }: { product: ProductRow }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      axios
        .get<{ categories: Category[] }>("/api/categories")
        .then((res) => res.data.categories),
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      const body: UpdateProductInput = {
        name: product.name,
        description: product.description ?? undefined,
        price: product.price,
        salePrice: product.salePrice ?? undefined,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        categoryId: product.aiSuggestedCategoryId!,
        assignedAgentId: product.assignedAgent?.id,
        tags: [...product.tags, ...product.aiSuggestedTags],
      };
      return axios.put(`/api/products/${product.id}`, body);
    },
    onSuccess: () => {
      if (product.aiSuggestedCategoryId) pingClassificationAccepted("category");
      for (const tag of product.aiSuggestedTags) {
        if (!product.tags.includes(tag)) pingClassificationAccepted("tag");
      }
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/products/${product.id}/dismiss-suggestion`, {
        aiSuggestedAt: product.aiSuggestedAt,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    // A 409 means the suggestion changed underneath this stale click (e.g. a
    // concurrent bulk-reclassify run) — refetch so the badge reflects
    // whatever's actually current instead of leaving a stale suggestion
    // stuck on screen.
    onError: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  if (!product.aiSuggestedAt) return null;

  const suggestedCategory = categories?.find((c) => c.id === product.aiSuggestedCategoryId);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("admin.products.table.suggestionAria", { name: product.name.en })}
          />
        }
      >
        <Sparkles className="text-primary" />
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-2 text-sm">
          <p className="font-medium">{t("admin.products.table.suggested")}</p>
          {suggestedCategory && (
            <p>
              {t("admin.products.table.categoryPrefix")}{" "}
              <span className="text-muted-foreground">{suggestedCategory.name.en}</span>
            </p>
          )}
          {product.aiSuggestedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {product.aiSuggestedTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
              {t("admin.products.table.apply")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => dismissMutation.mutate()}
              disabled={dismissMutation.isPending}
            >
              {t("admin.products.table.dismiss")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
  const { t } = useTranslation();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "image",
        header: () => <span className="sr-only">{t("admin.products.table.image")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <Avatar>
            {row.original.images[0] && <AvatarImage src={row.original.images[0]} alt="" />}
            <AvatarFallback aria-label={t("admin.products.table.noImageAria")}>
              <ImageOff className="size-4" />
            </AvatarFallback>
          </Avatar>
        ),
      }),
      columnHelper.accessor((row) => row.name.en, {
        id: "name",
        header: t("admin.products.table.name"),
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
        header: t("admin.products.table.category"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.category.name.en}</span>
        ),
      }),
      columnHelper.display({
        id: "tags",
        header: t("admin.products.table.tags"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ),
      }),
      columnHelper.display({
        id: "suggestion",
        header: () => <span className="sr-only">{t("admin.products.table.suggested")}</span>,
        enableSorting: false,
        cell: ({ row }) => <SuggestionBadge product={row.original} />,
      }),
      columnHelper.accessor((row) => row.assignedAgent?.name ?? "", {
        id: "agent",
        header: t("admin.products.table.agent"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.assignedAgent?.name ?? t("admin.products.table.unassigned")}
          </span>
        ),
      }),
      columnHelper.accessor("price", {
        id: "price",
        header: t("admin.products.table.price"),
        cell: ({ getValue, row }) => {
          const salePrice = row.original.salePrice;
          if (salePrice === null) {
            return <div className="text-right">{getValue()}</div>;
          }
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Badge variant="secondary" className="shrink-0">
                {t("admin.products.table.sale")}
              </Badge>
              <span className="text-muted-foreground line-through">{getValue()}</span>
              <span className="font-medium">{salePrice}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("stock", {
        id: "stock",
        header: t("admin.products.table.stock"),
        cell: ({ getValue }) => <div className="text-right">{getValue()}</div>,
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">{t("admin.products.table.actionsSr")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("admin.products.table.editAria", { name: row.original.name.en })}
              onClick={() => onEdit(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("admin.products.table.deleteAria", { name: row.original.name.en })}
              onClick={() => onDelete(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      }),
    ],
    [onEdit, onDelete, t],
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
                  <Skeleton className="h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
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
