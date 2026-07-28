import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import i18n from "@/i18n";
import AccountWishlistPage from "./AccountWishlistPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

const products = [
  {
    id: "p1",
    name: { en: "Rice 5kg" },
    description: null,
    price: 1500,
    stock: 20,
    images: [],
    tags: [],
    size: null,
    color: null,
    category: { id: "c1", name: { en: "Groceries" } },
    averageRating: null,
    reviewCount: 0,
  },
];

describe("AccountWishlistPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockedAxios.get.mockReset();
    mockedAxios.delete.mockReset();
    mockedUseSession.mockReturnValue({
      data: { user: { id: "c1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
  });

  it("renders the customer's wishlisted products", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    renderWithQuery(
      <MemoryRouter>
        <AccountWishlistPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/customer/wishlist");
  });

  it("shows an empty state when the wishlist is empty", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products: [] } });
    renderWithQuery(
      <MemoryRouter>
        <AccountWishlistPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("You haven't wishlisted any products yet."),
    ).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderWithQuery(
      <MemoryRouter>
        <AccountWishlistPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Could not load your wishlist. Please try again."),
    ).toBeInTheDocument();
  });

  it("removes a product and refetches the list", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    mockedAxios.delete.mockResolvedValue({});
    renderWithQuery(
      <MemoryRouter>
        <AccountWishlistPage />
      </MemoryRouter>,
    );

    const removeButton = await screen.findByRole("button", {
      name: "Remove Rice 5kg from wishlist",
    });
    await userEvent.click(removeButton);

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/customer/wishlist/p1"),
    );
    // Invalidation refetches: initial load + post-remove.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });

  it("shows an out-of-stock badge", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { products: [{ ...products[0]!, stock: 0 }] },
    });
    renderWithQuery(
      <MemoryRouter>
        <AccountWishlistPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Out of stock")).toBeInTheDocument();
  });
});
