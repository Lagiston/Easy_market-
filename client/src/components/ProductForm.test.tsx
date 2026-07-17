import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import { Dialog } from "@/components/ui/dialog";
import ProductForm from "./ProductForm";
import type { ProductRow } from "./ProductsTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const categories = [
  { id: "c1", name: "Groceries" },
  { id: "c2", name: "Beverages" },
];

function renderForm(onSuccess = vi.fn(), product?: ProductRow) {
  renderWithQuery(
    <Dialog open>
      <ProductForm product={product} onSuccess={onSuccess} />
    </Dialog>,
  );
  return { onSuccess };
}

async function selectCategory(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByLabelText("Category"));
  await user.click(await screen.findByRole("option", { name }));
}

describe("ProductForm (create mode)", () => {
  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("renders the name, description, stock, category, and image fields", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeInTheDocument();
  });

  it("shows validation errors and does not submit invalid input", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name"), "A");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(
      await screen.findByText("Name must be at least 2 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("requires an image before submitting", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("An image is required")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("creates the product, uploads the image, and calls onSuccess", async () => {
    const createdProduct = {
      id: "3",
      name: "Rice 5kg",
      description: "Long grain rice",
      stock: 10,
      imageUrl: null,
      category: categories[0],
    };
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/products"
        ? Promise.resolve({ data: { product: createdProduct } })
        : Promise.resolve({
            data: { product: { ...createdProduct, imageUrl: "/api/uploads/products/3.jpg" } },
          }),
    );
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.type(screen.getByLabelText("Description"), "Long grain rice");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/products", {
        name: "Rice 5kg",
        description: "Long grain rice",
        stock: 10,
        categoryId: "c1",
      }),
    );
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products/3/image",
        expect.any(FormData),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows the server error and does not call onSuccess on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Category not found" } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("ProductForm (edit mode)", () => {
  const existingProduct: ProductRow = {
    id: "42",
    name: "Rice 5kg",
    description: "Long grain rice",
    stock: 20,
    imageUrl: null,
    category: categories[0]!,
  };

  beforeEach(() => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.put.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("pre-fills name and stock, and submits the current category", async () => {
    mockedAxios.put.mockResolvedValue({ data: { product: existingProduct } });
    const user = userEvent.setup();
    renderForm(vi.fn(), existingProduct);

    expect(screen.getByLabelText("Name")).toHaveValue("Rice 5kg");
    expect(screen.getByLabelText("Description")).toHaveValue("Long grain rice");
    expect(screen.getByLabelText("Stock")).toHaveValue(20);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith("/api/products/42", {
        name: "Rice 5kg",
        description: "Long grain rice",
        stock: 20,
        categoryId: "c1",
      }),
    );
  });

  it("submits the update and calls onSuccess", async () => {
    mockedAxios.put.mockResolvedValue({
      data: { product: { ...existingProduct, name: "Rice 10kg" } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm(vi.fn(), existingProduct);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Rice 10kg");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockedAxios.put).toHaveBeenCalledWith("/api/products/42", {
      name: "Rice 10kg",
      description: "Long grain rice",
      stock: 20,
      categoryId: "c1",
    });
  });

  it("shows the server error and does not call onSuccess on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.put.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Category not found" } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm(vi.fn(), existingProduct);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
