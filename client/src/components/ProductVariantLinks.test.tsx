import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import ProductVariantLinks from "./ProductVariantLinks";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const redShirt = {
  id: "2",
  name: { en: "Shirt - Red" },
  price: 1500,
  images: ["/api/uploads/products/red.jpg"],
  stock: 10,
  size: "M",
  color: "Red",
};

function mockSelf(variants: unknown[] = []) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === "/api/products/1") {
      return Promise.resolve({ data: { product: { id: "1" }, variants } });
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

describe("ProductVariantLinks", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("renders linked variants with a remove button each", async () => {
    mockSelf([redShirt]);
    renderWithQuery(<ProductVariantLinks productId="1" />);

    expect(await screen.findByText("Shirt - Red")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Shirt - Red" })).toBeInTheDocument();
  });

  it("shows a size/color caption on a linked variant when set", async () => {
    mockSelf([redShirt]);
    renderWithQuery(<ProductVariantLinks productId="1" />);

    await screen.findByText("Shirt - Red");
    expect(screen.getByText("M / Red")).toBeInTheDocument();
  });

  it("renders no caption when a linked variant has no size or color", async () => {
    mockSelf([{ ...redShirt, size: null, color: null }]);
    renderWithQuery(<ProductVariantLinks productId="1" />);

    await screen.findByText("Shirt - Red");
    expect(screen.queryByText("M / Red")).not.toBeInTheDocument();
  });

  it("shows no variant rows when there are none linked", async () => {
    mockSelf([]);
    renderWithQuery(<ProductVariantLinks productId="1" />);

    await screen.findByLabelText("Search products to link as a variant");
    expect(screen.queryByRole("button", { name: /^Remove /i })).not.toBeInTheDocument();
  });

  it("searches for candidates and shows results excluding self and already-linked", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/products/1") {
        return Promise.resolve({ data: { product: { id: "1" }, variants: [redShirt] } });
      }
      if (url === "/api/products") {
        return Promise.resolve({
          data: {
            products: [
              redShirt,
              { id: "1", name: { en: "Shirt - Blue" }, price: 1500, images: [], stock: 5 },
              { id: "3", name: { en: "Shirt - Green" }, price: 1500, images: [], stock: 5 },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    const user = userEvent.setup({ delay: null });
    renderWithQuery(<ProductVariantLinks productId="1" />);
    await screen.findByText("Shirt - Red");

    await user.type(
      screen.getByLabelText("Search products to link as a variant"),
      "shirt",
    );
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/products", {
        params: { search: "shirt", page: 1 },
      }),
    );
    expect(await screen.findByText("Shirt - Green")).toBeInTheDocument();
    // Self (id "1") and the already-linked variant (id "2") are excluded.
    expect(screen.queryByText("Shirt - Blue")).not.toBeInTheDocument();
    expect(screen.getAllByText("Shirt - Red")).toHaveLength(1);
    vi.useRealTimers();
  });

  it("links a candidate on click", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/products/1") {
        return Promise.resolve({ data: { product: { id: "1" }, variants: [] } });
      }
      return Promise.resolve({ data: { products: [redShirt] } });
    });
    mockedAxios.post.mockResolvedValue({ data: { product: {}, variants: [redShirt] } });
    const user = userEvent.setup({ delay: null });
    renderWithQuery(<ProductVariantLinks productId="1" />);
    await screen.findByLabelText("Search products to link as a variant");

    await user.type(
      screen.getByLabelText("Search products to link as a variant"),
      "red",
    );
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText("Shirt - Red");

    await user.click(screen.getByText("Shirt - Red"));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/products/1/variants", {
        productId: "2",
      }),
    );
    vi.useRealTimers();
  });

  it("unlinks a variant on click", async () => {
    mockSelf([redShirt]);
    mockedAxios.delete.mockResolvedValue({ data: { product: {}, variants: [] } });
    const user = userEvent.setup();
    renderWithQuery(<ProductVariantLinks productId="1" />);
    await screen.findByText("Shirt - Red");

    await user.click(screen.getByRole("button", { name: "Remove Shirt - Red" }));

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/products/1/variants/2"),
    );
  });

  it("shows the server error when linking fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/products/1") {
        return Promise.resolve({ data: { product: { id: "1" }, variants: [] } });
      }
      return Promise.resolve({ data: { products: [redShirt] } });
    });
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: { error: "That product already belongs to a different variant group — remove it from that group first" },
      },
    });
    const user = userEvent.setup({ delay: null });
    renderWithQuery(<ProductVariantLinks productId="1" />);
    await screen.findByLabelText("Search products to link as a variant");

    await user.type(
      screen.getByLabelText("Search products to link as a variant"),
      "red",
    );
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText("Shirt - Red");
    await user.click(screen.getByText("Shirt - Red"));

    expect(
      await screen.findByText(
        "That product already belongs to a different variant group — remove it from that group first",
      ),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the server error when linking would duplicate a size/color already in the group", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === "/api/products/1") {
        return Promise.resolve({ data: { product: { id: "1" }, variants: [redShirt] } });
      }
      return Promise.resolve({
        data: { products: [{ ...redShirt, id: "3", name: { en: "Shirt - Red 2" } }] },
      });
    });
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: { error: "A variant with that size and color is already in this group" },
      },
    });
    const user = userEvent.setup({ delay: null });
    renderWithQuery(<ProductVariantLinks productId="1" />);
    await screen.findByText("Shirt - Red");

    await user.type(
      screen.getByLabelText("Search products to link as a variant"),
      "red",
    );
    await vi.advanceTimersByTimeAsync(300);
    await screen.findByText("Shirt - Red 2");
    await user.click(screen.getByText("Shirt - Red 2"));

    expect(
      await screen.findByText("A variant with that size and color is already in this group"),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });
});
