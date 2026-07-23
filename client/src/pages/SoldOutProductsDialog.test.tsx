import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { renderWithQuery } from "@/test/render-with-query";
import SoldOutProductsDialog from "./SoldOutProductsDialog";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

function renderDialog(date: string | null, onOpenChange = vi.fn()) {
  return renderWithQuery(
    <MemoryRouter>
      <SoldOutProductsDialog date={date} onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
}

describe("SoldOutProductsDialog", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it("is not open when date is null", () => {
    renderDialog(null);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while the products request is pending", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderDialog("2026-07-23");

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("shows an empty-state message when no products were sold out", async () => {
    mockedAxios.get.mockResolvedValue({ data: { date: "2026-07-23", products: [] } });
    renderDialog("2026-07-23");

    expect(
      await screen.findByText("No products were sold out that day."),
    ).toBeInTheDocument();
  });

  it("lists sold-out products as links to their product page and closes on click", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        date: "2026-07-23",
        products: [
          { id: "p1", name: "Red Bull Energy Drink 250ml" },
          { id: "p2", name: "Heinz Tomato Ketchup 400g" },
        ],
      },
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog("2026-07-23", onOpenChange);

    expect(mockedAxios.get).toHaveBeenCalledWith("/api/dashboard/sold-out-history/2026-07-23");

    const link = await screen.findByRole("link", { name: "Red Bull Energy Drink 250ml" });
    expect(link).toHaveAttribute("href", "/admin/products/p1");
    expect(screen.getByRole("link", { name: "Heinz Tomato Ketchup 400g" })).toBeInTheDocument();

    await user.click(link);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the date in the dialog title", async () => {
    mockedAxios.get.mockResolvedValue({ data: { date: "2026-07-23", products: [] } });
    renderDialog("2026-07-23");

    expect(
      await screen.findByRole("heading", { name: "Sold out on 2026-07-23" }),
    ).toBeInTheDocument();
  });
});
