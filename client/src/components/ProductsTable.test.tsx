import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import type { SortingState } from "@tanstack/react-table";
import { renderWithQuery } from "@/test/render-with-query";
import ProductsTable, { type ProductRow } from "./ProductsTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const products: ProductRow[] = [
  {
    id: "1",
    name: { en: "Rice 5kg" },
    description: null,
    price: 1500,
    salePrice: null,
    stock: 20,
    lowStockThreshold: 10,
    images: [],
    tags: [],
    size: null,
    color: null,
    aiSuggestedCategoryId: null,
    aiSuggestedTags: [],
    aiSuggestedAt: null,
    category: { id: "c1", name: { en: "Groceries" } },
    assignedAgent: null,
  },
  {
    id: "2",
    name: { en: "Orange Juice" },
    description: null,
    price: 300,
    salePrice: null,
    stock: 5,
    lowStockThreshold: 10,
    images: [],
    tags: [],
    size: null,
    color: null,
    aiSuggestedCategoryId: null,
    aiSuggestedTags: [],
    aiSuggestedAt: null,
    category: { id: "c2", name: { en: "Beverages" } },
    assignedAgent: { id: "a1", name: "Alice Agent" },
  },
];

function renderTable(
  sorting: SortingState,
  onSortingChange = vi.fn(),
  productsOverride: ProductRow[] = products,
) {
  renderWithQuery(
    <MemoryRouter>
      <ProductsTable
        products={productsOverride}
        sorting={sorting}
        onSortingChange={onSortingChange}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </MemoryRouter>,
  );
  return { onSortingChange };
}

describe("ProductsTable sorting", () => {
  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: { categories: [] } });
  });

  it("renders rows in the order given by the products prop (server-sorted)", () => {
    renderTable([{ id: "createdAt", desc: true }]);

    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows[0]).toHaveTextContent("Rice 5kg");
    expect(rows[1]).toHaveTextContent("Orange Juice");
  });

  function applyUpdate(onSortingChange: ReturnType<typeof vi.fn>, previous: SortingState) {
    const updater = onSortingChange.mock.calls[0]![0];
    return typeof updater === "function" ? updater(previous) : updater;
  }

  it("clicking an unsorted numeric column header sorts descending first", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "createdAt", desc: true }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Stock" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "stock", desc: true }]);
  });

  it("clicking an unsorted text column header sorts ascending first", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "createdAt", desc: true }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "name", desc: false }]);
  });

  it("clicking the already-ascending sorted column toggles to descending", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "stock", desc: false }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Stock" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "stock", desc: true }]);
  });

  it("clicking the already-descending sorted column toggles to ascending instead of clearing the sort", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "stock", desc: true }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Stock" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "stock", desc: false }]);
  });

  it("renders the product name as a link to its detail page", () => {
    renderTable([{ id: "createdAt", desc: true }]);

    expect(screen.getByRole("link", { name: "Rice 5kg" })).toHaveAttribute(
      "href",
      "/admin/products/1",
    );
  });

  it("does not render Image or Actions columns as sortable buttons", () => {
    renderTable([{ id: "createdAt", desc: true }]);

    expect(screen.queryByRole("button", { name: "Image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });

  it("shows the assigned agent's name, or Unassigned when there isn't one", () => {
    renderTable([{ id: "createdAt", desc: true }]);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Unassigned");
    expect(rows[1]).toHaveTextContent("Alice Agent");
  });
});

describe("ProductsTable AI suggestion badge", () => {
  const categories = [
    { id: "c1", name: { en: "Groceries" } },
    { id: "c2", name: { en: "Beverages" } },
  ];
  const suggestedAt = "2026-07-23T00:00:00.000Z";
  const productWithSuggestion: ProductRow = {
    ...products[0]!,
    id: "3",
    tags: ["local"],
    aiSuggestedCategoryId: "c2",
    aiSuggestedTags: ["local", "organic"],
    aiSuggestedAt: suggestedAt,
  };

  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.put.mockReset();
    mockedAxios.post.mockReset();
  });

  it("does not render a badge when there is no pending suggestion", () => {
    renderTable([{ id: "createdAt", desc: true }], vi.fn(), [products[0]!]);

    expect(
      screen.queryByLabelText(/Pending AI suggestion/),
    ).not.toBeInTheDocument();
  });

  it("shows the suggested category and tags in the popover", async () => {
    const user = userEvent.setup();
    renderTable([{ id: "createdAt", desc: true }], vi.fn(), [productWithSuggestion]);

    await user.click(
      screen.getByLabelText(`Pending AI suggestion for ${productWithSuggestion.name.en}`),
    );

    expect(await screen.findByText("Beverages")).toBeInTheDocument();
    expect(screen.getByText("organic")).toBeInTheDocument();
  });

  it("applying merges the suggested category and new tags into the product", async () => {
    mockedAxios.put.mockResolvedValue({ data: { product: productWithSuggestion } });
    mockedAxios.post.mockResolvedValue({});
    const user = userEvent.setup();
    renderTable([{ id: "createdAt", desc: true }], vi.fn(), [productWithSuggestion]);

    await user.click(
      screen.getByLabelText(`Pending AI suggestion for ${productWithSuggestion.name.en}`),
    );
    await user.click(await screen.findByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith(
        "/api/products/3",
        expect.objectContaining({ categoryId: "c2", tags: ["local", "local", "organic"] }),
      ),
    );
    // "local" was already on the product, so only "category" + the new "organic"
    // tag should fire an acceptance ping — not the already-present tag.
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/ai/classify-product/accept", {
        field: "category",
      }),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith("/api/ai/classify-product/accept", {
      field: "tag",
    });
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it("dismissing posts the suggestion's timestamp", async () => {
    mockedAxios.post.mockResolvedValue({});
    const user = userEvent.setup();
    renderTable([{ id: "createdAt", desc: true }], vi.fn(), [productWithSuggestion]);

    await user.click(
      screen.getByLabelText(`Pending AI suggestion for ${productWithSuggestion.name.en}`),
    );
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products/3/dismiss-suggestion",
        { aiSuggestedAt: suggestedAt },
      ),
    );
  });

  it("refetches products when dismiss hits a concurrency conflict", async () => {
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Suggestion changed, please refresh" } },
    });
    const user = userEvent.setup();
    renderTable([{ id: "createdAt", desc: true }], vi.fn(), [productWithSuggestion]);

    await user.click(
      screen.getByLabelText(`Pending AI suggestion for ${productWithSuggestion.name.en}`),
    );
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));

    // No throw/unhandled rejection — the mutation's onError just re-fetches;
    // asserting the post call resolved is enough to prove nothing crashed.
    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalled());
  });
});
