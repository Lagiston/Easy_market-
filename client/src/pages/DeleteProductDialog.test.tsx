import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import DeleteProductDialog from "./DeleteProductDialog";
import type { ProductRow } from "@/components/ProductsTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const product: ProductRow = {
  id: "1",
  name: { en: "Rice 5kg" },
  description: null,
  price: 1500,
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
};

describe("DeleteProductDialog", () => {
  beforeEach(() => {
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows the confirmation heading with the product name", () => {
    renderWithQuery(<DeleteProductDialog product={product} onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Delete Rice 5kg?" }),
    ).toBeInTheDocument();
  });

  it("is not open when product is null", () => {
    renderWithQuery(<DeleteProductDialog product={null} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirming calls delete and closes the dialog", async () => {
    mockedAxios.delete.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<DeleteProductDialog product={product} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/products/1"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("cancelling closes the dialog without calling delete", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<DeleteProductDialog product={product} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the server error and keeps the dialog open on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.delete.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Product is referenced by an order" } },
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<DeleteProductDialog product={product} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Product is referenced by an order"),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
