import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { customerAuthClient } from "@/lib/customer-auth-client";
import ProductReviews, { type StorefrontReview } from "./ProductReviews";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPost = vi.mocked(axios.post);
const mockedPut = vi.mocked(axios.put);
const mockedDelete = vi.mocked(axios.delete);

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn() },
}));
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

const reviews: StorefrontReview[] = [
  {
    id: "r1",
    authorName: "Amina",
    rating: 5,
    comment: "Excellent quality",
    verifiedPurchase: true,
    staffReply: null,
    staffReplyAt: null,
    createdAt: "2026-07-20T10:00:00.000Z",
    isOwnReview: false,
  },
  {
    id: "r2",
    authorName: "Joseph",
    rating: 3,
    comment: null,
    verifiedPurchase: false,
    staffReply: null,
    staffReplyAt: null,
    createdAt: "2026-07-21T10:00:00.000Z",
    isOwnReview: false,
  },
];

const ZERO_RATING_COUNTS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

function mockReviews(data: {
  reviews: StorefrontReview[];
  total: number;
  averageRating: number | null;
  ratingCounts?: Record<number, number>;
  matchingTotal?: number;
}) {
  mockedGet.mockResolvedValue({
    data: {
      ratingCounts: ZERO_RATING_COUNTS,
      matchingTotal: data.total,
      ...data,
      page: 1,
      pageSize: 10,
    },
  });
}

describe("ProductReviews", () => {
  beforeEach(async () => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedPut.mockReset();
    mockedDelete.mockReset();
    mockedUseSession.mockReset();
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    await i18n.changeLanguage("en");
  });

  it("renders the review list with authors, comments, and the average", async () => {
    mockReviews({ reviews, total: 2, averageRating: 4 });
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(await screen.findByText("Amina")).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith("/api/storefront/products/p1/reviews", {
      params: { page: 1, sort: "newest" },
    });
    expect(screen.getByText("Excellent quality")).toBeInTheDocument();
    expect(screen.getByText("Joseph")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("2 reviews")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Rated 5 out of 5" })).toBeInTheDocument();
    // Only Amina's review is a verified purchase.
    expect(screen.getAllByText("Verified purchase")).toHaveLength(1);
  });

  it("renders a rating distribution bar per star when there are reviews", async () => {
    mockReviews({
      reviews,
      total: 5,
      averageRating: 4,
      ratingCounts: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 3 },
    });
    renderWithQuery(<ProductReviews productId="p1" />);

    await screen.findByText("Amina");
    expect(screen.getByRole("progressbar", { name: "5 star: 3" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "4 star: 1" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "3 star: 1" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "2 star: 0" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 star: 0" })).toBeInTheDocument();
  });

  it("renders no distribution bars when there are no reviews", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);

    await screen.findByText("No reviews yet — be the first to review this product.");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("prefills the name field from the signed-in customer's session", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: "Signed-In Customer" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(await screen.findByLabelText("Name")).toHaveValue("Signed-In Customer");
  });

  it("leaves the name field blank for a guest", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(await screen.findByLabelText("Name")).toHaveValue("");
  });

  it("shows the empty state (and no average) when there are no reviews", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(
      await screen.findByText("No reviews yet — be the first to review this product."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/out of 5/)).not.toBeInTheDocument();
  });

  it("appends the next page via the show-more button, hiding it on the last page", async () => {
    const firstPage = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`,
      authorName: `Reviewer ${i}`,
      rating: 4,
      comment: null,
      verifiedPurchase: false,
      staffReply: null,
      staffReplyAt: null,
      createdAt: "2026-07-20T10:00:00.000Z",
      isOwnReview: false,
    }));
    const lastReview = { ...reviews[0]!, id: "r-last", authorName: "Last Reviewer" };
    mockedGet.mockImplementation((_url, config) => {
      const page = (config?.params as { page: number }).page;
      return Promise.resolve({
        data:
          page === 1
            ? {
                reviews: firstPage,
                total: 11,
                matchingTotal: 11,
                averageRating: 4,
                ratingCounts: ZERO_RATING_COUNTS,
                page: 1,
                pageSize: 10,
              }
            : {
                reviews: [lastReview],
                total: 11,
                matchingTotal: 11,
                averageRating: 4,
                ratingCounts: ZERO_RATING_COUNTS,
                page: 2,
                pageSize: 10,
              },
      });
    });
    renderWithQuery(<ProductReviews productId="p1" />);

    await screen.findByText("Reviewer 0");
    expect(screen.queryByText("Last Reviewer")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show more reviews" }));

    expect(await screen.findByText("Last Reviewer")).toBeInTheDocument();
    // First page stays appended above the new one, and no page remains to load.
    expect(screen.getByText("Reviewer 0")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show more reviews" }),
    ).not.toBeInTheDocument();
  });

  it("shows a staff reply under a review's comment", async () => {
    const repliedReview: StorefrontReview = {
      ...reviews[0]!,
      staffReply: "Thank you for shopping with us!",
      staffReplyAt: "2026-07-22T10:00:00.000Z",
    };
    mockReviews({ reviews: [repliedReview, reviews[1]!], total: 2, averageRating: 4 });
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(await screen.findByText("Thank you for shopping with us!")).toBeInTheDocument();
    expect(screen.getByText("Response from the store")).toBeInTheDocument();
  });

  it("re-requests with the selected sort and hides the sort/filter controls when unreviewed", async () => {
    mockReviews({ reviews, total: 2, averageRating: 4 });
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Amina");

    await userEvent.click(screen.getByLabelText("Sort by"));
    await userEvent.click(await screen.findByRole("option", { name: "Highest rated" }));

    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith("/api/storefront/products/p1/reviews", {
        params: { page: 1, sort: "highest" },
      }),
    );
  });

  it("hides the sort/filter controls when the product has no reviews", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);

    await screen.findByText("No reviews yet — be the first to review this product.");
    expect(screen.queryByLabelText("Sort by")).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText("Verified reviews only")).toHaveLength(0);
  });

  it("re-requests with verifiedOnly when the checkbox is checked", async () => {
    mockReviews({ reviews, total: 2, averageRating: 4 });
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Amina");

    // Base UI's Checkbox renders a visible span plus a hidden native <input>
    // for form semantics, both label-associated — click the visible one.
    await userEvent.click(screen.getAllByLabelText("Verified reviews only")[0]!);

    await waitFor(() =>
      expect(mockedGet).toHaveBeenLastCalledWith("/api/storefront/products/p1/reviews", {
        params: { page: 1, sort: "newest", verifiedOnly: true },
      }),
    );
  });

  it("shows a distinct message when a filter matches no reviews (vs. none at all)", async () => {
    mockReviews({
      reviews: [],
      total: 2,
      matchingTotal: 0,
      averageRating: 4,
      ratingCounts: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
    });
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(await screen.findByText("No reviews match this filter.")).toBeInTheDocument();
    expect(
      screen.queryByText("No reviews yet — be the first to review this product."),
    ).not.toBeInTheDocument();
  });

  it("shows no edit/delete controls on reviews that aren't the customer's own", async () => {
    mockReviews({ reviews, total: 2, averageRating: 4 });
    renderWithQuery(<ProductReviews productId="p1" />);

    await screen.findByText("Amina");
    expect(screen.queryByLabelText("Edit your review")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete your review")).not.toBeInTheDocument();
  });

  it("edits the customer's own review inline and refetches on save", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    mockedPut.mockResolvedValueOnce({ data: { review: ownReview } });
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Edit your review"));
    // Both the inline edit form and the "write a review" form below have a
    // "Name" field — the edit form's comes first in the DOM.
    const nameInput = screen.getAllByLabelText("Name")[0]!;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Amina Updated");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith("/api/customer/reviews/r1", {
        authorName: "Amina Updated",
        rating: 5,
        comment: "Excellent quality",
      }),
    );
    // Invalidation refetches: initial load + post-edit.
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
    // The inline form closes back to the static view.
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("cancelling the inline edit discards changes without calling the API", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Edit your review"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedPut).not.toHaveBeenCalled();
    expect(await screen.findByText("Amina")).toBeInTheDocument();
  });

  it("shows an update error when saving the edit fails", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    mockedPut.mockRejectedValueOnce(new Error("network"));
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Edit your review"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Could not update your review. Please try again."),
    ).toBeInTheDocument();
  });

  it("deletes the customer's own review via the confirmation dialog", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    mockedDelete.mockResolvedValueOnce({});
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Delete your review"));
    expect(screen.getByRole("heading", { name: "Delete your review?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith("/api/customer/reviews/r1"));
    // Invalidation refetches: initial load + post-delete.
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  });

  it("cancelling the delete dialog does not delete", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Delete your review"));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it("shows a delete error when the request fails", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    mockedDelete.mockRejectedValueOnce(new Error("network"));
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Delete your review"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("Could not delete your review. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows an error message when loading reviews fails", async () => {
    mockedGet.mockRejectedValue(new Error("network"));
    renderWithQuery(<ProductReviews productId="p1" />);

    expect(
      await screen.findByText("Could not load reviews. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows a live character count for the comment field, in red past the limit", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Write a review");

    expect(screen.getByText("0 / 1000")).toBeInTheDocument();

    const comment = screen.getByLabelText("Comment (optional)");
    await userEvent.type(comment, "hello");
    expect(await screen.findByText("5 / 1000")).toBeInTheDocument();
    expect(screen.getByText("5 / 1000")).not.toHaveClass("text-destructive");

    fireEvent.change(comment, { target: { value: "a".repeat(1001) } });
    expect(await screen.findByText("1001 / 1000")).toHaveClass("text-destructive");
  });

  it("shows a live character count for the comment field in the inline edit form", async () => {
    const ownReview: StorefrontReview = { ...reviews[0]!, isOwnReview: true };
    mockReviews({ reviews: [ownReview], total: 1, averageRating: 5 });
    renderWithQuery(<ProductReviews productId="p1" />);

    await userEvent.click(await screen.findByLabelText("Edit your review"));

    // "Excellent quality" (17 chars) is the review's existing comment.
    expect(screen.getByText("17 / 1000")).toBeInTheDocument();
  });

  it("shows validation errors and does not submit without a rating and name", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Write a review");

    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Choose a rating from 1 to 5 stars")).toBeInTheDocument();
    expect(screen.getByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("submits the review payload, shows success, and refetches the list", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    mockedPost.mockResolvedValueOnce({ data: { review: reviews[0] } });
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Write a review");

    await userEvent.click(screen.getByRole("button", { name: "Rate 4 stars" }));
    await userEvent.type(screen.getByLabelText("Name"), "Amina");
    await userEvent.type(screen.getByLabelText("Comment (optional)"), "Great product");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(mockedPost).toHaveBeenCalledWith("/api/storefront/products/p1/reviews", {
        authorName: "Amina",
        rating: 4,
        comment: "Great product",
      }),
    );
    expect(await screen.findByText("Thanks for your review!")).toBeInTheDocument();
    // Invalidation refetches the list: initial load + post-submit.
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  });

  it("shows the duplicate-review message on a 409", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    const conflict = Object.assign(new axios.AxiosError("Conflict"), {
      response: { status: 409, data: { error: "You have already reviewed this product" } },
    });
    mockedPost.mockRejectedValueOnce(conflict);
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Write a review");

    await userEvent.click(screen.getByRole("button", { name: "Rate 5 stars" }));
    await userEvent.type(screen.getByLabelText("Name"), "Amina");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(
      await screen.findByText("You have already reviewed this product."),
    ).toBeInTheDocument();
  });

  it("shows a submit error when the request fails", async () => {
    mockReviews({ reviews: [], total: 0, averageRating: null });
    mockedPost.mockRejectedValueOnce(new Error("network"));
    renderWithQuery(<ProductReviews productId="p1" />);
    await screen.findByText("Write a review");

    await userEvent.click(screen.getByRole("button", { name: "Rate 5 stars" }));
    await userEvent.type(screen.getByLabelText("Name"), "Amina");
    await userEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(
      await screen.findByText("Could not submit your review. Please try again."),
    ).toBeInTheDocument();
  });
});
