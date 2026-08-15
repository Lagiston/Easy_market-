import "@/i18n";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import DeleteKbArticleDialog from "./DeleteKbArticleDialog";
import type { KbArticleRow } from "@/components/KbArticlesTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const kbArticle: KbArticleRow = {
  id: "1",
  title: { en: "How to track my order" },
  body: { en: "Use the order status page with your code and phone number." },
  topic: "orders",
};

describe("DeleteKbArticleDialog", () => {
  beforeEach(() => {
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows the confirmation heading with the article title", () => {
    renderWithQuery(<DeleteKbArticleDialog kbArticle={kbArticle} onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Delete How to track my order?" }),
    ).toBeInTheDocument();
  });

  it("is not open when kbArticle is null", () => {
    renderWithQuery(<DeleteKbArticleDialog kbArticle={null} onOpenChange={vi.fn()} />);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("confirming calls delete and closes the dialog", async () => {
    mockedAxios.delete.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<DeleteKbArticleDialog kbArticle={kbArticle} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/kb-articles/1"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("cancelling closes the dialog without calling delete", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<DeleteKbArticleDialog kbArticle={kbArticle} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedAxios.delete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the server error and keeps the dialog open on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.delete.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Article is referenced elsewhere" } },
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<DeleteKbArticleDialog kbArticle={kbArticle} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Article is referenced elsewhere"),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
