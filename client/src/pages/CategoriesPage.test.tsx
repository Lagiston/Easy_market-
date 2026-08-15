import "@/i18n";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import CategoriesPage from "./CategoriesPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const categories = [
  { id: "c1", name: { en: "Groceries" } },
  { id: "c2", name: { en: "Beverages" } },
];

function renderPage() {
  renderWithQuery(<CategoriesPage />);
}

describe("CategoriesPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.put.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("Catalog categories")).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
  });

  it("renders categories once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    renderPage();

    expect(await screen.findByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("Beverages")).toBeInTheDocument();
    expect(await screen.findByText("2 categories")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderPage();

    expect(
      await screen.findByText("Could not load categories. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("creates a category and closes the dialog", async () => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.post.mockResolvedValue({
      data: { category: { id: "c3", name: { en: "Snacks" } } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Groceries");

    await user.click(screen.getByRole("button", { name: "Create category" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(screen.getByLabelText("Name (English)"), "Snacks");
    await user.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/categories", {
        name: { en: "Snacks" },
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("shows a 409 conflict error when creating a duplicate name", async () => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "A category with this name already exists" } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Groceries");

    await user.click(screen.getByRole("button", { name: "Create category" }));
    await user.type(screen.getByLabelText("Name (English)"), "Groceries");
    await user.click(screen.getByRole("button", { name: "Create category" }));

    expect(
      await screen.findByText("A category with this name already exists"),
    ).toBeInTheDocument();
  });

  it("opens the edit dialog pre-filled and saves changes", async () => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.put.mockResolvedValue({
      data: { category: { id: "c1", name: { en: "Groceries & Produce" } } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Groceries");

    await user.click(screen.getByRole("button", { name: "Edit Groceries" }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByLabelText("Name (English)")).toHaveValue("Groceries");

    const nameInput = screen.getByLabelText("Name (English)");
    await user.clear(nameInput);
    await user.type(nameInput, "Groceries & Produce");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith("/api/categories/c1", {
        name: { en: "Groceries & Produce" },
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("opens the delete confirmation and removes the category on confirm", async () => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Groceries");

    await user.click(screen.getByRole("button", { name: "Delete Groceries" }));
    expect(await screen.findByText("Delete Groceries?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/categories/c1"));
  });

  it("shows a server error and keeps the dialog open when delete fails", async () => {
    mockedAxios.get.mockResolvedValue({ data: { categories } });
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.delete.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Category not found" } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Groceries");

    await user.click(screen.getByRole("button", { name: "Delete Groceries" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Category not found")).toBeInTheDocument();
  });
});
