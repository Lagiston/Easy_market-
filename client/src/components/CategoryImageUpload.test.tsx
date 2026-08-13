import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import CategoryImageUpload from "./CategoryImageUpload";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

describe("CategoryImageUpload", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows a placeholder and an Upload image button when there's no image", () => {
    renderWithQuery(
      <CategoryImageUpload categoryId="cat1" imageUrl={null} onChanged={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Upload image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("shows the image and Change/Remove buttons when one is set", () => {
    renderWithQuery(
      <CategoryImageUpload
        categoryId="cat1"
        imageUrl="/api/uploads/categories/1.jpg"
        onChanged={vi.fn()}
      />,
    );

    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "/api/uploads/categories/1.jpg");
    expect(screen.getByRole("button", { name: "Change image" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("uploads the selected file and calls onChanged", async () => {
    mockedAxios.post.mockResolvedValue({
      data: { imageUrl: "/api/uploads/categories/2.jpg" },
    });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <CategoryImageUpload categoryId="cat1" imageUrl={null} onChanged={onChanged} />,
    );

    const file = new File(["image"], "category.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload category image"), file);

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/categories/cat1/image",
        expect.any(FormData),
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("shows the server error on a failed upload", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Image must be 5MB or smaller" } },
    });
    const user = userEvent.setup();
    renderWithQuery(<CategoryImageUpload categoryId="cat1" imageUrl={null} onChanged={vi.fn()} />);

    const file = new File(["image"], "category.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload category image"), file);

    expect(await screen.findByText("Image must be 5MB or smaller")).toBeInTheDocument();
  });

  it("removes the image and calls onChanged", async () => {
    mockedAxios.delete.mockResolvedValue({});
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <CategoryImageUpload
        categoryId="cat1"
        imageUrl="/api/uploads/categories/1.jpg"
        onChanged={onChanged}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/categories/cat1/image"),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
