import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import KbArticlesTable, { type KbArticleRow } from "./KbArticlesTable";

const kbArticles: KbArticleRow[] = [
  {
    id: "1",
    title: { en: "How to track my order" },
    body: { en: "Use the order status page." },
    topic: "orders",
  },
  {
    id: "2",
    title: { en: "Delivery areas" },
    body: { en: "We deliver within the city limits." },
    topic: null,
  },
];

describe("KbArticlesTable", () => {
  it("shows skeleton rows while loading", () => {
    const { container } = render(
      <KbArticlesTable kbArticles={null} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(container.querySelectorAll("[data-slot=skeleton]").length).toBeGreaterThan(0);
  });

  it("renders article titles and topics", () => {
    render(<KbArticlesTable kbArticles={kbArticles} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("How to track my order")).toBeInTheDocument();
    expect(screen.getByText("orders")).toBeInTheDocument();
    expect(screen.getByText("Delivery areas")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("calls onEdit and onDelete with the selected article", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<KbArticlesTable kbArticles={kbArticles} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByLabelText("Edit How to track my order"));
    expect(onEdit).toHaveBeenCalledWith(kbArticles[0]);

    await user.click(screen.getByLabelText("Delete Delivery areas"));
    expect(onDelete).toHaveBeenCalledWith(kbArticles[1]);
  });
});
