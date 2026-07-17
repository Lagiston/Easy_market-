import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import ProductsPage from "./ProductsPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const products = [
  {
    id: "1",
    name: "Rice 5kg",
    stock: 20,
    category: { id: "c1", name: "Groceries" },
  },
  {
    id: "2",
    name: "Orange Juice",
    stock: 5,
    category: { id: "c2", name: "Beverages" },
  },
];

describe("ProductsPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<ProductsPage />);

    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
  });

  it("renders products once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });

    renderWithQuery(<ProductsPage />);

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
    expect(screen.getByText("Beverages")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();

    expect(await screen.findByText("2 products")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderWithQuery(<ProductsPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Could not load products. Please try again."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the create product dialog when the button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /create product/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("hides the create product dialog when clicking outside", async () => {
    mockedAxios.get.mockResolvedValue({ data: { products } });
    const user = userEvent.setup();
    renderWithQuery(<ProductsPage />);
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByRole("button", { name: /create product/i }));
    await screen.findByRole("dialog");

    await user.click(document.body);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
