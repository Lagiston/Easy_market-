import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import { Dialog } from "@/components/ui/dialog";
import KbArticleForm from "./KbArticleForm";
import type { KbArticleRow } from "./KbArticlesTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const kbArticle: KbArticleRow = {
  id: "1",
  title: { en: "How to track my order", ar: "كيفية تتبع طلبي" },
  body: { en: "Use the order status page.", ar: "استخدم صفحة حالة الطلب." },
  topic: "orders",
};

describe("KbArticleForm", () => {
  beforeEach(() => {
    mockedAxios.put.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("pre-fills fields in edit mode", () => {
    renderWithQuery(
      <Dialog open>
        <KbArticleForm kbArticle={kbArticle} />
      </Dialog>,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("How to track my order");
    expect(screen.getByLabelText("Body")).toHaveValue("Use the order status page.");
    expect(screen.getByLabelText("Topic")).toHaveValue("orders");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("submits the update with edited content", async () => {
    mockedAxios.put.mockResolvedValue({ data: { kbArticle } });
    const user = userEvent.setup();
    renderWithQuery(
      <Dialog open>
        <KbArticleForm kbArticle={kbArticle} />
      </Dialog>,
    );

    await user.clear(screen.getByLabelText("Topic"));
    await user.type(screen.getByLabelText("Topic"), "shipping");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedAxios.put).toHaveBeenCalledWith("/api/kb-articles/1", {
        title: { en: "How to track my order", ar: "كيفية تتبع طلبي" },
        body: { en: "Use the order status page.", ar: "استخدم صفحة حالة الطلب." },
        topic: "shipping",
      }),
    );
  });
});
