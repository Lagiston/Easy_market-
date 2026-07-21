import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import CreateKbArticleDialog from "./CreateKbArticleDialog";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const createdKbArticle = {
  id: "3",
  title: { en: "How to track my order" },
  body: { en: "Use the order status page." },
  topic: "orders",
};

async function openDialog() {
  const user = userEvent.setup();
  renderWithQuery(<CreateKbArticleDialog />);
  await user.click(screen.getByRole("button", { name: /create article/i }));
  await screen.findByRole("dialog");
  return user;
}

describe("CreateKbArticleDialog", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("opens the modal from the trigger button", async () => {
    await openDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
    expect(screen.getByLabelText("Topic")).toBeInTheDocument();
  });

  it("shows a validation error and does not submit invalid input", async () => {
    const user = await openDialog();
    await user.click(screen.getByRole("button", { name: "Create article" }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("creates the article and closes the modal on success", async () => {
    mockedAxios.post.mockResolvedValue({ data: { kbArticle: createdKbArticle } });

    const user = await openDialog();
    await user.type(screen.getByLabelText("Title"), "How to track my order");
    await user.type(screen.getByLabelText("Body"), "Use the order status page.");
    await user.type(screen.getByLabelText("Topic"), "orders");
    await user.click(screen.getByRole("button", { name: "Create article" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/kb-articles", {
        title: { en: "How to track my order" },
        body: { en: "Use the order status page." },
        topic: "orders",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the server error and keeps the modal open on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Body is required" } },
    });

    const user = await openDialog();
    await user.type(screen.getByLabelText("Title"), "How to track my order");
    await user.type(screen.getByLabelText("Body"), "Use the order status page.");
    await user.click(screen.getByRole("button", { name: "Create article" }));

    expect(await screen.findByText("Body is required")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
