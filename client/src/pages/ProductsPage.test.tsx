import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import ProductsPage from "./ProductsPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const products = [
  {
    id: "1",
    name: { en: "Rice 5kg" },
    description: null,
    stock: 20,
    lowStockThreshold: 10,
    imageUrl: null,
    category: { id: "c1", name: { en: "Groceries" } },
  },
  {
    id: "2",
    name: { en: "Orange Juice" },
    description: null,
    stock: 5,
    lowStockThreshold: 10,
    imageUrl: null,
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
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<ProductsPage />);

    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
  });

  it("renders products once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });

    renderWithQuery(<ProductsPage />);

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
    expect(screen.getByText("Beverages")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    expect(await screen.findByText("2 products")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderWithQuery(<ProductsPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Could not load products. Please try again."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the create product dialog when the button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("hides the create product dialog when clicking outside", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
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
        : Promise.resolve({ data: { products } }),
    );
    mockedAxios.put.mockResolvedValue({
      data: { product: { ...products[0], name: { en: "Rice 10kg" } } },
    });
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
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
        stock: 20,
        lowStockThreshold: 10,
        categoryId: "c1",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("fetches products sorted by createdAt desc by default", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderWithQuery(<ProductsPage />);
    await screen.findByText("Rice 5kg");

    expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
      params: { sortBy: "createdAt", sortOrder: "desc" },
    });
  });

  it("clicking a column header refetches with the new sort params", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
    await screen.findByText("Rice 5kg");

    // Stock is a numeric column, so its first click sorts descending.
    await user.click(screen.getByRole("button", { name: "Stock" }));

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { sortBy: "stock", sortOrder: "desc" },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Stock" }));

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { sortBy: "stock", sortOrder: "asc" },
      }),
    );
  });

  it("opens the delete confirmation and removes the product on confirm", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: "Delete Rice 5kg" }));
    expect(await screen.findByText("Delete Rice 5kg?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/products/1"));
  });
});
