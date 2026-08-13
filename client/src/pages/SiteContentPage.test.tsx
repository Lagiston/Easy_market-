import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { DEFAULT_SITE_CONTENT } from "@es-market/core";
import { renderWithQuery } from "@/test/render-with-query";
import SiteContentPage from "./SiteContentPage";

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), put: vi.fn() },
  };
});
const mockedGet = vi.mocked(axios.get);
const mockedPut = vi.mocked(axios.put);

describe("SiteContentPage", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPut.mockReset();
  });

  it("loads the current content into the form", async () => {
    mockedGet.mockResolvedValueOnce({ data: { content: DEFAULT_SITE_CONTENT } });
    renderWithQuery(<SiteContentPage />);

    await waitFor(() =>
      expect(screen.getByLabelText("Story, paragraph 1")).toHaveValue(
        DEFAULT_SITE_CONTENT["about_storyBody1"],
      ),
    );
    expect(screen.getByLabelText("Returns, paragraph 1")).toHaveValue(
      DEFAULT_SITE_CONTENT["policy_returnsBody1"],
    );
  });

  it("saves edited content", async () => {
    mockedGet.mockResolvedValue({ data: { content: DEFAULT_SITE_CONTENT } });
    mockedPut.mockResolvedValueOnce({
      data: { content: { ...DEFAULT_SITE_CONTENT, "about_storyBody1": "Updated story." } },
    });
    renderWithQuery(<SiteContentPage />);

    const storyInput = await screen.findByLabelText("Story, paragraph 1");
    await waitFor(() => expect(storyInput).toHaveValue(DEFAULT_SITE_CONTENT["about_storyBody1"]));
    await userEvent.clear(storyInput);
    await userEvent.type(storyInput, "Updated story.");
    await userEvent.click(screen.getByRole("button", { name: "Save content" }));

    await waitFor(() =>
      expect(mockedPut).toHaveBeenCalledWith("/api/site-content", {
        ...DEFAULT_SITE_CONTENT,
        "about_storyBody1": "Updated story.",
      }),
    );
    expect(await screen.findByText("Content saved.")).toBeInTheDocument();
  });

  it("rejects an empty field client-side", async () => {
    mockedGet.mockResolvedValueOnce({ data: { content: DEFAULT_SITE_CONTENT } });
    renderWithQuery(<SiteContentPage />);

    const storyInput = await screen.findByLabelText("Story, paragraph 1");
    await waitFor(() => expect(storyInput).toHaveValue(DEFAULT_SITE_CONTENT["about_storyBody1"]));
    await userEvent.clear(storyInput);
    await userEvent.click(screen.getByRole("button", { name: "Save content" }));

    expect(await screen.findByText("This field can't be empty")).toBeInTheDocument();
    expect(mockedPut).not.toHaveBeenCalled();
  });

  it("shows an error when loading fails", async () => {
    mockedGet.mockRejectedValueOnce(new Error("Network error"));
    renderWithQuery(<SiteContentPage />);

    expect(
      await screen.findByText("Could not load site content. Please try again."),
    ).toBeInTheDocument();
  });
});
