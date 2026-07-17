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
  name: "Rice 5kg",
  stock: 20,
  imageUrl: "/api/uploads/products/1.jpg",
  category: { id: "c1", name: "Groceries" },
};

describe("ProductImageUpload", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows an upload button when there is no image", () => {
    renderWithQuery(<ProductImageUpload productId="1" imageUrl={null} />);

    expect(screen.getByRole("button", { name: "Upload image" })).toBeInTheDocument();
  });

  it("shows a change button when an image already exists", () => {
    renderWithQuery(
      <ProductImageUpload productId="1" imageUrl="/api/uploads/products/1.jpg" />,
    );

    expect(screen.getByRole("button", { name: "Change image" })).toBeInTheDocument();
  });

  it("uploads the selected file and calls onUploaded", async () => {
    mockedAxios.post.mockResolvedValue({ data: { product: uploadedProduct } });
    const onUploaded = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ProductImageUpload productId="1" imageUrl={null} onUploaded={onUploaded} />,
    );

    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Product image"), file);

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/products/1/image",
        expect.any(FormData),
      ),
    );
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(uploadedProduct));
  });

  it("shows the server error on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Image must be 5MB or smaller" } },
    });
    const user = userEvent.setup();
    renderWithQuery(<ProductImageUpload productId="1" imageUrl={null} />);

    const file = new File(["image"], "product.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Product image"), file);

    expect(
      await screen.findByText("Image must be 5MB or smaller"),
    ).toBeInTheDocument();
  });
});
