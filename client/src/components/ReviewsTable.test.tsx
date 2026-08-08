import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ReviewsTable, { type ReviewRow } from "./ReviewsTable";

const review: ReviewRow = {
  id: "r1",
  authorName: "Amina",
  rating: 5,
  headline: "Great value",
  comment: "Excellent quality",
  verifiedPurchase: true,
  staffReply: null,
  staffReplyAt: null,
  createdAt: "2026-01-15T00:00:00.000Z",
  product: { id: "p1", name: { en: "Rice 5kg" } },
  customer: { id: "c1", name: "Amina" },
};

describe("ReviewsTable", () => {
  it("renders loading skeleton rows when reviews is null", () => {
    const { container } = render(
      <ReviewsTable reviews={null} onDelete={vi.fn()} onReply={vi.fn()} />,
    );

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("No reviews yet.")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no reviews", () => {
    render(<ReviewsTable reviews={[]} onDelete={vi.fn()} onReply={vi.fn()} />);

    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
  });

  it("renders a review row with product, rating, author, verified badge, headline, and comment", () => {
    render(<ReviewsTable reviews={[review]} onDelete={vi.fn()} onReply={vi.fn()} />);

    expect(screen.getByText("Rice 5kg")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Amina")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Great value")).toBeInTheDocument();
    expect(screen.getByText("Excellent quality")).toBeInTheDocument();
  });

  it("renders em-dashes for a review with no headline, comment, or staff reply", () => {
    render(
      <ReviewsTable
        reviews={[{ ...review, headline: null, comment: null, verifiedPurchase: false }]}
        onDelete={vi.fn()}
        onReply={vi.fn()}
      />,
    );

    // Headline, Comment, and Reply columns each fall back to "—".
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("shows the staff reply text when present", () => {
    render(
      <ReviewsTable
        reviews={[{ ...review, staffReply: "Thanks for the feedback!" }]}
        onDelete={vi.fn()}
        onReply={vi.fn()}
      />,
    );

    expect(screen.getByText("Thanks for the feedback!")).toBeInTheDocument();
  });

  it("calls onReply and onDelete with the clicked review", async () => {
    const user = userEvent.setup();
    const onReply = vi.fn();
    const onDelete = vi.fn();
    render(<ReviewsTable reviews={[review]} onDelete={onDelete} onReply={onReply} />);

    await user.click(screen.getByRole("button", { name: "Reply to review by Amina" }));
    expect(onReply).toHaveBeenCalledWith(review);

    await user.click(screen.getByRole("button", { name: "Delete review by Amina" }));
    expect(onDelete).toHaveBeenCalledWith(review);
  });
});
