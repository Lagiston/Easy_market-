import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { PRODUCTS_PAGE_SIZE } from "@es-market/core";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import ProductsPage from "./ProductsPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const products = [
  {
    id: "1",
    name: { en: "Rice 5kg" },
    description: null,
    price: 1500,
    stock: 20,
    lowStockThreshold: 10,
    images: [],
    tags: [],
    category: { id: "c1", name: { en: "Groceries" } },
  },
  {
    id: "2",
    name: { en: "Orange Juice" },
    description: null,
    price: 300,
    stock: 5,
    lowStockThreshold: 10,
    images: [],
    tags: [],
    category: { id: "c2", name: { en: "Beverages" } },
  },
];

const categories = [
  { id: "c1", name: "Groceries" },
  { id: "c2", name: "Beverages" },
];

describe("ProductsPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
  });

  it("renders products once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });

    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
    expect(screen.getByText("Beverages")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    expect(await screen.findByText("2 products")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByText("Could not load products. Please try again."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the create product dialog when the button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("hides the create product dialog when clicking outside", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /create product/i }));
    await screen.findByRole("dialog");

    await user.click(document.body);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("opens the edit dialog pre-filled and saves changes", async () => {
    mockedAxios.get.mockImplementation((url: string) =>
      url === "/api/categories"
        ? Promise.resolve({ data: { categories } })
        : Promise.resolve({ data: { products, total: products.length } }),
    );
    mockedAxios.put.mockResolvedValue({
      data: { product: { ...products[0], name: { en: "Rice 10kg" } } },
    });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "Edit Rice 5kg" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Rice 5kg");

    const nameInput = within(dialog).getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Rice 10kg");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith("/api/products/1", {
        name: { en: "Rice 10kg" },
        description: undefined,
        price: 1500,
        stock: 20,
        lowStockThreshold: 10,
        categoryId: "c1",
        tags: [],
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("fetches products sorted by createdAt desc by default, on page 1", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
      params: { sortBy: "createdAt", sortOrder: "desc", page: 1 },
    });
  });

  it("clicking a column header refetches with the new sort params", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    // Stock is a numeric column, so its first click sorts descending.
    await user.click(screen.getByRole("button", { name: "Stock" }));

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { sortBy: "stock", sortOrder: "desc", page: 1 },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Stock" }));

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { sortBy: "stock", sortOrder: "asc", page: 1 },
      }),
    );
  });

  it("debounces the search box and refetches with the search param", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });
    const user = userEvent.setup({ delay: null });
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.type(screen.getByLabelText("Search products"), "rice");

    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { sortBy: "createdAt", sortOrder: "desc", search: "rice", page: 1 },
      }),
    );
    vi.useRealTimers();
  });

  it("clicking Next fetches the next page, and Previous is disabled on page 1", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { products, total: PRODUCTS_PAGE_SIZE + 1 },
    });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    expect(screen.getByText("Previous").closest("a")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByText("Next").closest("a")!);

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { sortBy: "createdAt", sortOrder: "desc", page: 2 },
      }),
    );
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("opens the delete confirmation and removes the product on confirm", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products, total: products.length } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "Delete Rice 5kg" }));
    expect(await screen.findByText("Delete Rice 5kg?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/products/1"));
  });
});

describe("ProductsPage reclassify all", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  function mockProductsList(completed = 0) {
    mockedAxios.get.mockImplementation((url: string) =>
      url === "/api/products/reclassify-status"
        ? Promise.resolve({ data: { completed } })
        : Promise.resolve({ data: { products, total: products.length } }),
    );
  }

  it("starts a batch, posts to reclassify-all, and disables the button", async () => {
    mockProductsList();
    mockedAxios.post.mockResolvedValue({
      data: { total: 2, since: "2026-07-23T00:00:00.000Z" },
    });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /reclassify all/i }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/products/reclassify-all"),
    );
    expect(await screen.findByText("Reclassifying products… 0/2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reclassify all/i })).toBeDisabled();
  });

  it("clears the progress line and re-enables the button once the batch completes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let completed = 0;
    mockedAxios.get.mockImplementation((url: string) =>
      url === "/api/products/reclassify-status"
        ? Promise.resolve({ data: { completed } })
        : Promise.resolve({ data: { products, total: products.length } }),
    );
    mockedAxios.post.mockResolvedValue({
      data: { total: 2, since: "2026-07-23T00:00:00.000Z" },
    });
    const user = userEvent.setup({ delay: null });
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /reclassify all/i }));
    expect(await screen.findByText("Reclassifying products… 0/2")).toBeInTheDocument();

    completed = 2;
    await vi.advanceTimersByTimeAsync(2000);

    await waitFor(() =>
      expect(screen.queryByText(/Reclassifying products/)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /reclassify all/i })).toBeEnabled();
    vi.useRealTimers();
  });

  it("shows an inline error and does not start a batch when one is already running", async () => {
    mockProductsList();
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "A reclassify batch is already running" } },
    });
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <ProductsPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /reclassify all/i }));

    expect(
      await screen.findByText("A reclassify batch is already running"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Reclassifying products/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reclassify all/i })).toBeEnabled();
  });
});
