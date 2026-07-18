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
  { id: "c1", name: { en: "Groceries" } },
  { id: "c2", name: { en: "Beverages" } },
];
const users = [{ id: "a1", name: "Alice Agent", role: "AGENT" }];

function mockGet() {
  mockedAxios.get.mockImplementation((url: string) =>
    url === "/api/users"
      ? Promise.resolve({ data: { users } })
      : Promise.resolve({ data: { categories } }),
  );
}

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

async function selectAgent(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByLabelText("Assigned agent"));
  await user.click(await screen.findByRole("option", { name }));
}

describe("ProductForm (create mode)", () => {
  beforeEach(() => {
    mockGet();
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("renders the name, description, price, stock, category, and image fields", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Price")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Image")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeInTheDocument();
  });

  it("defaults the assigned agent field to Unassigned and lists agents to choose from", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByLabelText("Assigned agent")).toHaveTextContent("Unassigned");

    await user.click(screen.getByLabelText("Assigned agent"));

    expect(await screen.findByRole("option", { name: "Alice Agent" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Unassigned" })).toBeInTheDocument();
  });

  it("submits the selected agent's id when assigning a product on creation", async () => {
    const createdProduct = {
      id: "3",
      name: { en: "Rice 5kg" },
      description: undefined,
      stock: 10,
      imageUrl: null,
      category: categories[0],
      assignedAgent: users[0],
    };
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/products"
        ? Promise.resolve({ data: { product: createdProduct } })
        : Promise.resolve({
            data: { product: { ...createdProduct, imageUrl: "/api/uploads/products/3.jpg" } },
          }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await selectAgent(user, "Alice Agent");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products",
        expect.objectContaining({ assignedAgentId: "a1" }),
      ),
    );
  });

  it("shows the server error when the assigned agent is invalid", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Agent not found" } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await selectAgent(user, "Alice Agent");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Agent not found")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
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

  it("rejects a description longer than 1000 characters and does not submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name"), "Rice 5kg");
    // Uses spaces so the textarea wraps normally instead of rendering as one
    // unbroken line.
    await user.type(screen.getByLabelText("Description"), "lorem ipsum ".repeat(90));
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Image"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(
      await screen.findByText("Description must be 1000 characters or fewer"),
    ).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("creates the product, uploads the image, and calls onSuccess", async () => {
    const createdProduct = {
      id: "3",
      name: { en: "Rice 5kg" },
      description: { en: "Long grain rice" },
      stock: 10,
      imageUrl: null,
      category: categories[0],
      assignedAgent: null,
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
        name: { en: "Rice 5kg" },
        description: { en: "Long grain rice" },
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
    name: { en: "Rice 5kg" },
    description: { en: "Long grain rice" },
    price: 1500,
    stock: 20,
    lowStockThreshold: 10,
    imageUrl: null,
    category: categories[0]!,
    assignedAgent: null,
  };

  beforeEach(() => {
    mockGet();
    mockedAxios.put.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("pre-fills name and stock, and submits the current category", async () => {
    mockedAxios.put.mockResolvedValue({ data: { product: existingProduct } });
    const user = userEvent.setup();
    renderForm(vi.fn(), existingProduct);

    expect(screen.getByLabelText("Name")).toHaveValue("Rice 5kg");
    expect(screen.getByLabelText("Description")).toHaveValue("Long grain rice");
    expect(screen.getByLabelText("Price")).toHaveValue(1500);
    expect(screen.getByLabelText("Stock")).toHaveValue(20);
    expect(screen.getByLabelText("Low stock threshold")).toHaveValue(10);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith("/api/products/42", {
        name: { en: "Rice 5kg" },
        description: { en: "Long grain rice" },
        price: 1500,
        stock: 20,
        lowStockThreshold: 10,
        categoryId: "c1",
      }),
    );
  });

  it("submits the update and calls onSuccess", async () => {
    mockedAxios.put.mockResolvedValue({
      data: { product: { ...existingProduct, name: { en: "Rice 10kg" } } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm(vi.fn(), existingProduct);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Rice 10kg");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockedAxios.put).toHaveBeenCalledWith("/api/products/42", {
      name: { en: "Rice 10kg" },
      description: { en: "Long grain rice" },
      price: 1500,
      stock: 20,
      lowStockThreshold: 10,
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

  it("rejects an empty name and does not submit", async () => {
    const user = userEvent.setup();
    const { onSuccess } = renderForm(vi.fn(), existingProduct);

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Name must be at least 2 characters"),
    ).toBeInTheDocument();
    expect(mockedAxios.put).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("pre-fills the assigned agent field from the existing product and submits it unchanged", async () => {
    const assignedProduct: ProductRow = { ...existingProduct, assignedAgent: users[0]! };
    mockedAxios.put.mockResolvedValue({ data: { product: assignedProduct } });
    const user = userEvent.setup();
    renderForm(vi.fn(), assignedProduct);

    await waitFor(() =>
      expect(screen.getByLabelText("Assigned agent")).toHaveTextContent("Alice Agent"),
    );

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith(
        "/api/products/42",
        expect.objectContaining({ assignedAgentId: "a1" }),
      ),
    );
  });

  it("un-assigns the agent when switched back to Unassigned", async () => {
    const assignedProduct: ProductRow = { ...existingProduct, assignedAgent: users[0]! };
    mockedAxios.put.mockResolvedValue({ data: { product: existingProduct } });
    const user = userEvent.setup();
    renderForm(vi.fn(), assignedProduct);

    await selectAgent(user, "Unassigned");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockedAxios.put).toHaveBeenCalled());
    const [, payload] = mockedAxios.put.mock.calls[0]!;
    expect((payload as { assignedAgentId?: string }).assignedAgentId).toBeUndefined();
  });
});
