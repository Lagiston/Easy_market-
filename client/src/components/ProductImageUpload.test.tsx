import "@/i18n";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import ProductImageUpload from "./ProductImageUpload";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const uploadedProduct = {
  id: "1",
  name: { en: "Rice 5kg" },
  description: null,
  stock: 20,
  images: ["/api/uploads/products/1.jpg"],
  category: { id: "c1", name: { en: "Groceries" } },
};

describe("ProductImageUpload", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows an add-images button and a no-image placeholder when there are no images", () => {
    renderWithQuery(<ProductImageUpload productId="1" images={[]} />);

    expect(screen.getByRole("button", { name: "Add images" })).toBeInTheDocument();
    expect(screen.getByLabelText("No image")).toBeInTheDocument();
  });

  it("shows an image thumbnail with a remove button for each existing image", () => {
    renderWithQuery(
      <ProductImageUpload
        productId="1"
        images={["/api/uploads/products/1.jpg", "/api/uploads/products/2.jpg"]}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Remove image" })).toHaveLength(2);
  });

  it("uploads the selected files and calls onUploaded", async () => {
    mockedAxios.post.mockResolvedValue({ data: { product: uploadedProduct } });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<ProductImageUpload productId="1" images={[]} onUploaded={onUploaded} />);

    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Product images"), file);

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products/1/images",
        expect.any(FormData),
      ),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(uploadedProduct));
  });

  it("shows the server error on a failed upload", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Each image must be 5MB or smaller" } },
    });
    const user = userEvent.setup();
    renderWithQuery(<ProductImageUpload productId="1" images={[]} />);

    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Product images"), file);

    expect(
      await screen.findByText("Each image must be 5MB or smaller"),
    ).toBeInTheDocument();
  });

  it("removes an image and calls onUploaded with the updated product", async () => {
    const productAfterDelete = { ...uploadedProduct, images: [] };
    mockedAxios.delete.mockResolvedValue({ data: { product: productAfterDelete } });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ProductImageUpload
        productId="1"
        images={["/api/uploads/products/1.jpg"]}
        onUploaded={onUploaded}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove image" }));

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/products/1/images/1.jpg"),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(productAfterDelete));
  });

  it("disables the add-images button once at the maximum", () => {
    const images = Array.from({ length: 8 }, (_, i) => `/api/uploads/products/${i}.jpg`);
    renderWithQuery(<ProductImageUpload productId="1" images={images} />);

    expect(screen.getByRole("button", { name: "Maximum 8 images" })).toBeDisabled();
  });
});
