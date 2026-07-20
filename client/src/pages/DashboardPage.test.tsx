import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import DashboardPage from "./DashboardPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const products = [
  {
    id: "1",
    name: { en: "Rice 5kg" },
    description: null,
    price: 1500,
    stock: 20,
    lowStockThreshold: 10,
    imageUrl: null,
    category: { id: "c1", name: { en: "Groceries" } },
  },
  {
    id: "2",
    name: { en: "Orange Juice" },
    description: null,
    price: 300,
    stock: 5,
    lowStockThreshold: 10,
    imageUrl: null,
    category: { id: "c2", name: { en: "Beverages" } },
  },
  {
    id: "3",
    name: { en: "Bottled Water" },
    description: null,
    price: 100,
    stock: 0,
    lowStockThreshold: 10,
    imageUrl: null,
    category: { id: "c2", name: { en: "Beverages" } },
  },
];

const categories = [
  { id: "c1", name: { en: "Groceries" } },
  { id: "c2", name: { en: "Beverages" } },
];

const stats = { products: 3, orders: 12, lowStock: 1, openInquiries: 4, escalatedInquiries: 2 };

describe("DashboardPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.get.mockImplementation((url: string) =>
      url === "/api/categories"
        ? Promise.resolve({ data: { categories } })
        : url === "/api/dashboard/stats"
          ? Promise.resolve({ data: { stats } })
          : Promise.resolve({ data: { products } }),
    );
  });

  it("shows product, order, low-stock, and inquiry counts", async () => {
    renderWithQuery(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Products")).toBeInTheDocument();
    const productsTile = screen.getByText("Products").closest("[data-slot=card]")!;
    const ordersTile = screen.getByText("Orders").closest("[data-slot=card]")!;
    const lowStockTile = screen.getByText("Low-stock items").closest("[data-slot=card]")!;
    const openInquiriesTile = screen.getByText("Open inquiries").closest("[data-slot=card]")!;
    const escalatedTile = screen.getByText("Escalated inquiries").closest("[data-slot=card]")!;
    expect(await within(productsTile as HTMLElement).findByText("3")).toBeInTheDocument();
    expect(within(ordersTile as HTMLElement).getByText("12")).toBeInTheDocument();
    expect(within(lowStockTile as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(openInquiriesTile as HTMLElement).getByText("4")).toBeInTheDocument();
    expect(within(escalatedTile as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("shows all products by default", async () => {
    renderWithQuery(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("Orange Juice")).toBeInTheDocument();
    expect(screen.getByText("Bottled Water")).toBeInTheDocument();
  });

  it("filters to only low-stock products", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(await screen.findByRole("option", { name: "Low stock" }));

    await waitFor(() => {
      expect(screen.getByText("Orange Juice")).toBeInTheDocument();
      expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
      expect(screen.queryByText("Bottled Water")).not.toBeInTheDocument();
    });
  });

  it("filters to only out-of-stock products", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText("Rice 5kg");

    await user.click(screen.getByLabelText("Filter by status"));
    await user.click(await screen.findByRole("option", { name: "Out of stock" }));

    await waitFor(() => {
      expect(screen.getByText("Bottled Water")).toBeInTheDocument();
      expect(screen.queryByText("Rice 5kg")).not.toBeInTheDocument();
      expect(screen.queryByText("Orange Juice")).not.toBeInTheDocument();
    });
  });
});
