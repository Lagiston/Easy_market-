import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import ReviewsPage from "./ReviewsPage";
import type { ReviewRow } from "@/components/ReviewsTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const reviews: ReviewRow[] = [
  {
    id: "r1",
    authorName: "Amina",
    rating: 5,
    comment: "Excellent quality",
    verifiedPurchase: true,
    staffReply: null,
    staffReplyAt: null,
    createdAt: "2026-07-20T10:00:00.000Z",
    product: { id: "p1", name: { en: "Rice 5kg" } },
    customer: { id: "c1", name: "Amina Yusuf" },
  },
  {
    id: "r2",
    authorName: "Joseph",
    rating: 2,
    comment: null,
    verifiedPurchase: false,
    staffReply: "Sorry to hear that — please reach out so we can help.",
    staffReplyAt: "2026-07-22T10:00:00.000Z",
    createdAt: "2026-07-21T10:00:00.000Z",
    product: { id: "p2", name: { en: "Olive oil" } },
    customer: null,
  },
];

describe("ReviewsPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("lists reviews with product, author, verified badge, and count", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews } });
    renderWithQuery(<ReviewsPage />);

    expect(await screen.findByText("Rice 5kg")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/reviews");
    expect(screen.getByText("2 reviews")).toBeInTheDocument();
    expect(screen.getByText("Amina")).toBeInTheDocument();
    expect(screen.getByText("Joseph")).toBeInTheDocument();
    expect(screen.getByText("Excellent quality")).toBeInTheDocument();
    // Only Amina's review is verified.
    expect(screen.getAllByText("Verified")).toHaveLength(1);
  });

  it("shows an empty state when there are no reviews", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews: [] } });
    renderWithQuery(<ReviewsPage />);

    expect(await screen.findByText("No reviews yet.")).toBeInTheDocument();
  });

  it("shows an error message when loading fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("network"));
    renderWithQuery(<ReviewsPage />);

    expect(
      await screen.findByText("Could not load reviews. Please try again."),
    ).toBeInTheDocument();
  });

  it("deletes a review via the confirmation dialog and refetches", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithQuery(<ReviewsPage />);

    await user.click(
      await screen.findByRole("button", { name: "Delete review by Amina" }),
    );
    expect(
      screen.getByRole("heading", { name: "Delete Amina's review of Rice 5kg?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedAxios.delete).toHaveBeenCalledWith("/api/reviews/r1"));
    // Invalidation refetches the list: initial load + post-delete.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });

  it("cancelling the dialog does not delete", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews } });
    const user = userEvent.setup();
    renderWithQuery(<ReviewsPage />);

    await user.click(
      await screen.findByRole("button", { name: "Delete review by Amina" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("shows an existing reply in the table and opens it pre-filled", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews } });
    const user = userEvent.setup();
    renderWithQuery(<ReviewsPage />);

    expect(
      await screen.findByText("Sorry to hear that — please reach out so we can help."),
    ).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: "Reply to review by Joseph" }),
    );
    expect(
      screen.getByRole("heading", { name: "Reply to Joseph's review" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Reply")).toHaveValue(
      "Sorry to hear that — please reach out so we can help.",
    );
    expect(screen.getByRole("button", { name: "Clear reply" })).toBeInTheDocument();
  });

  it("saves a new reply and refetches the list", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews } });
    mockedAxios.post.mockResolvedValueOnce({ data: { review: reviews[0] } });
    const user = userEvent.setup();
    renderWithQuery(<ReviewsPage />);

    await user.click(
      await screen.findByRole("button", { name: "Reply to review by Amina" }),
    );
    expect(screen.queryByRole("button", { name: "Clear reply" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Reply"), "Thanks for the kind words!");
    await user.click(screen.getByRole("button", { name: "Save reply" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/reviews/r1/reply", {
        reply: "Thanks for the kind words!",
      }),
    );
    // Invalidation refetches the list: initial load + post-save.
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });

  it("clears an existing reply", async () => {
    mockedAxios.get.mockResolvedValue({ data: { reviews } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithQuery(<ReviewsPage />);

    await user.click(
      await screen.findByRole("button", { name: "Reply to review by Joseph" }),
    );
    await user.click(screen.getByRole("button", { name: "Clear reply" }));

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/reviews/r2/reply"),
    );
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
  });
});
