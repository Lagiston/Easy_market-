import "@/i18n";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByLabelText("Name (English)")).toBeInTheDocument();
    expect(screen.getByLabelText("Description (English)")).toBeInTheDocument();
    expect(screen.getByLabelText("Price")).toBeInTheDocument();
    expect(screen.getByLabelText("Stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Images")).toBeInTheDocument();
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
      images: [],
      category: categories[0],
      assignedAgent: users[0],
    };
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/products"
        ? Promise.resolve({ data: { product: createdProduct } })
        : Promise.resolve({
            data: { product: { ...createdProduct, images: ["/api/uploads/products/3.jpg"] } },
          }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await selectAgent(user, "Alice Agent");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Images"), file);
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

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await selectAgent(user, "Alice Agent");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Images"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Agent not found")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows validation errors and does not submit invalid input", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "A");
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

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("At least one image is required")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("rejects a description longer than 1000 characters and does not submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    // fireEvent.change sets the whole value in one go — typing 1000+ chars
    // key-by-key via user.type is slow enough to flake against the test timeout.
    fireEvent.change(screen.getByLabelText("Description (English)"), {
      target: { value: "lorem ipsum ".repeat(90) },
    });
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Images"), file);
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
      images: [],
      category: categories[0],
      assignedAgent: null,
    };
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/products"
        ? Promise.resolve({ data: { product: createdProduct } })
        : Promise.resolve({
            data: { product: { ...createdProduct, images: ["/api/uploads/products/3.jpg"] } },
          }),
    );
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.type(screen.getByLabelText("Description (English)"), "Long grain rice");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Images"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/products", {
        name: { en: "Rice 5kg" },
        description: { en: "Long grain rice" },
        price: 0,
        stock: 10,
        lowStockThreshold: 10,
        categoryId: "c1",
        tags: [],
      }),
    );
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products/3/images",
        expect.any(FormData),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("submits size and color when filled in", async () => {
    const createdProduct = {
      id: "4",
      name: { en: "Shirt" },
      description: null,
      stock: 5,
      images: [],
      category: categories[0],
      assignedAgent: null,
    };
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/products"
        ? Promise.resolve({ data: { product: createdProduct } })
        : Promise.resolve({
            data: { product: { ...createdProduct, images: ["/api/uploads/products/4.jpg"] } },
          }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Shirt");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "5");
    await selectCategory(user, "Groceries");
    await user.type(screen.getByLabelText("Size"), "M");
    await user.type(screen.getByLabelText("Color"), "Red");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Images"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products",
        expect.objectContaining({ size: "M", color: "Red" }),
      ),
    );
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

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "10");
    await selectCategory(user, "Groceries");
    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Images"), file);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("ProductForm AI suggestions", () => {
  beforeEach(() => {
    mockGet();
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  function mockClassify(
    result:
      | { categoryId: string | null; tags: string[]; confidence: number }
      | Promise<{ data: unknown }>,
  ) {
    mockedAxios.post.mockImplementation((url: string) => {
      if (url === "/api/ai/classify-product") {
        return result instanceof Promise ? result : Promise.resolve({ data: result });
      }
      if (url === "/api/ai/classify-product/accept") {
        return Promise.resolve({});
      }
      return Promise.reject(new Error(`Unexpected POST to ${url}`));
    });
  }

  it("disables Suggest with AI until a name is entered", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByRole("button", { name: "Suggest with AI" })).toBeDisabled();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");

    expect(screen.getByRole("button", { name: "Suggest with AI" })).toBeEnabled();
  });

  it("requests a suggestion with the current name and description", async () => {
    mockClassify({ categoryId: null, tags: [], confidence: 0.9 });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.type(screen.getByLabelText("Description (English)"), "Long grain rice");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/ai/classify-product", {
        name: "Rice 5kg",
        description: "Long grain rice",
      }),
    );
  });

  it("shows a pending state while the suggestion request is in flight", async () => {
    let resolveRequest!: (value: { data: unknown }) => void;
    mockClassify(new Promise<{ data: unknown }>((resolve) => (resolveRequest = resolve)));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    expect(await screen.findByRole("button", { name: "Suggesting…" })).toBeDisabled();

    resolveRequest({ data: { categoryId: null, tags: [], confidence: 0.5 } });
  });

  it("shows a category suggestion and applies it", async () => {
    mockClassify({ categoryId: "c1", tags: [], confidence: 0.9 });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByLabelText("Category")).toHaveTextContent("Groceries");
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/ai/classify-product/accept", {
        field: "category",
      }),
    );
  });

  it("shows 'No confident match' when no category is suggested", async () => {
    mockClassify({ categoryId: null, tags: [], confidence: 0.2 });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    expect(await screen.findByText("No confident match")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("shows tag suggestions, applies one, and disables already-added tags", async () => {
    mockClassify({ categoryId: null, tags: ["organic", "bulk"], confidence: 0.7 });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    const organicButton = await screen.findByRole("button", { name: "+ organic" });
    expect(screen.getByRole("button", { name: "+ bulk" })).toBeInTheDocument();

    await user.click(organicButton);

    expect(screen.getByRole("button", { name: "Remove organic" })).toBeInTheDocument();
    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/ai/classify-product/accept", {
        field: "tag",
      }),
    );
    expect(screen.getByRole("button", { name: "organic" })).toBeDisabled();
  });

  it("shows the server error when the suggestion request fails", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/ai/classify-product"
        ? Promise.reject({
            isAxiosError: true,
            response: { data: { error: "AI service unavailable" } },
          })
        : Promise.resolve({}),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    expect(await screen.findByText("AI service unavailable")).toBeInTheDocument();
  });

  it("shows a generic error message for a non-axios failure", async () => {
    mockedAxios.isAxiosError.mockReturnValue(false);
    mockedAxios.post.mockImplementation((url: string) =>
      url === "/api/ai/classify-product"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({}),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    expect(
      await screen.findByText("Could not get AI suggestions. Please try again."),
    ).toBeInTheDocument();
  });

  it("dismisses a suggestion back to the pre-suggestion view", async () => {
    mockClassify({ categoryId: "c1", tags: ["organic"], confidence: 0.9 });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Name (English)"), "Rice 5kg");
    await user.click(screen.getByRole("button", { name: "Suggest with AI" }));

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suggest with AI" })).toBeInTheDocument();
  });
});

describe("ProductForm (edit mode)", () => {
  const existingProduct: ProductRow = {
    id: "42",
    name: { en: "Rice 5kg" },
    description: { en: "Long grain rice" },
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

    expect(screen.getByLabelText("Name (English)")).toHaveValue("Rice 5kg");
    expect(screen.getByLabelText("Description (English)")).toHaveValue("Long grain rice");
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
        tags: [],
      }),
    );
  });

  it("pre-fills size and color and submits them unchanged", async () => {
    const variantProduct = { ...existingProduct, size: "M", color: "Red" };
    mockedAxios.put.mockResolvedValue({ data: { product: variantProduct } });
    const user = userEvent.setup();
    renderForm(vi.fn(), variantProduct);

    expect(screen.getByLabelText("Size")).toHaveValue("M");
    expect(screen.getByLabelText("Color")).toHaveValue("Red");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith(
        "/api/products/42",
        expect.objectContaining({ size: "M", color: "Red" }),
      ),
    );
  });

  it("submits the update and calls onSuccess", async () => {
    mockedAxios.put.mockResolvedValue({
      data: { product: { ...existingProduct, name: { en: "Rice 10kg" } } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm(vi.fn(), existingProduct);

    const nameInput = screen.getByLabelText("Name (English)");
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
      tags: [],
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

    await user.clear(screen.getByLabelText("Name (English)"));
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
