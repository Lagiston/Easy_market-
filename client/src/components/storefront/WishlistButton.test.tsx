import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import i18n from "@/i18n";
import WishlistButton from "./WishlistButton";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);
const mockedDelete = vi.mocked(axios.delete);

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

function renderButton(productId = "p1") {
  renderWithQuery(
    <MemoryRouter>
      <WishlistButton productId={productId} />
    </MemoryRouter>,
  );
}

describe("WishlistButton", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedDelete.mockReset();
    mockedUseSession.mockReset();
    await i18n.changeLanguage("en");
  });

  it("renders a sign-in link for a guest and makes no API call", async () => {
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    renderButton();

    const link = screen.getByRole("link", { name: "Add to wishlist" });
    expect(link).toHaveAttribute("href", "/account/login");
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("signed in and not wishlisted: shows an outline heart and adds on click", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { id: "c1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedGet.mockResolvedValue({ data: { products: [] } });
    mockedPost.mockResolvedValueOnce({});
    renderButton("p1");

    const button = await screen.findByRole("button", { name: "Add to wishlist" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    await waitFor(() => expect(mockedPost).toHaveBeenCalledWith("/api/customer/wishlist/p1"));
  });

  it("signed in and wishlisted: shows a pressed heart and removes on click", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { id: "c1", name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockedGet.mockResolvedValue({
      data: {
        products: [
          {
            id: "p1",
            name: { en: "Shirt" },
            description: null,
            price: 1000,
            stock: 5,
            images: [],
            tags: [],
            size: null,
            color: null,
            category: { id: "c1", name: { en: "Clothing" } },
            averageRating: null,
            reviewCount: 0,
          },
        ],
      },
    });
    mockedDelete.mockResolvedValueOnce({});
    renderButton("p1");

    const button = await screen.findByRole("button", { name: "Remove from wishlist" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(button);

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith("/api/customer/wishlist/p1"));
  });
});
