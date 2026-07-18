import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import CreateProductDialog from "./CreateProductDialog";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const categories = [
  { id: "c1", name: { en: "Groceries" } },
  { id: "c2", name: { en: "Beverages" } },
];

const createdProduct = {
  id: "3",
  name: { en: "Rice 5kg" },
  description: null,
  stock: 10,
  imageUrl: null,
  category: categories[0],
};

async function openDialog() {
  mockedAxios.get.mockResolvedValue({ data: { categories } });
  const user = userEvent.setup();
  renderWithQuery(<CreateProductDialog />);
  await user.click(screen.getByRole("button", { name: /create product/i }));
  await screen.findByRole("dialog");
  return user;
}

async function selectCategory(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByLabelText("Category"));
  await user.click(await screen.findByRole("option", { name }));
}

describe("CreateProductDialog", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("opens the modal from the trigger button", async () => {
    await openDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Image")).toBeInTheDocument();
  });

  it("shows validation errors and does not submit invalid input", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText("Name"), "A");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(
      await screen.findByText("Name must be at least 2 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("requires an image before submitting", async () => {
    const user = await openDialog();
    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("An image is required")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("creates the product with its image and closes the modal on success", async () => {
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/products"
        ? Promise.resolve({ data: { product: createdProduct } })
        : Promise.resolve({
            data: { product: { ...createdProduct, imageUrl: "/api/uploads/products/3.jpg" } },
          }),
    );

    const user = await openDialog();
    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/products", {
        name: { en: "Rice 5kg" },
        description: undefined,
        price: 0,
        stock: 10,
        lowStockThreshold: 10,
        categoryId: "c1",
      }),
    );
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products/3/image",
        expect.any(FormData),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("shows the server error and keeps the modal open on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Category not found" } },
    });

    const user = await openDialog();
    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
