import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import CustomerAvatarUpload from "./CustomerAvatarUpload";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

describe("CustomerAvatarUpload", () => {
  beforeEach(async () => {
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
    await i18n.changeLanguage("en");
  });

  it("shows a placeholder and an Upload photo button when there's no image", () => {
    renderWithQuery(<CustomerAvatarUpload image={null} onChanged={vi.fn()} />);

    expect(screen.getByLabelText("Profile picture")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove photo" })).not.toBeInTheDocument();
  });

  it("shows the image and Change/Remove buttons when one is set", () => {
    renderWithQuery(
      <CustomerAvatarUpload image="/api/uploads/customers/1.jpg" onChanged={vi.fn()} />,
    );

    const img = screen.getByAltText("Profile picture");
    expect(img).toHaveAttribute("src", "/api/uploads/customers/1.jpg");
    expect(screen.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove photo" })).toBeInTheDocument();
  });

  it("uploads the selected file and calls onChanged", async () => {
    mockedAxios.post.mockResolvedValue({ data: { image: "/api/uploads/customers/2.jpg" } });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(<CustomerAvatarUpload image={null} onChanged={onChanged} />);

    const file = new File(["image"], "avatar.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload photo"), file);

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "/api/customer/profile/avatar",
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
    renderWithQuery(<CustomerAvatarUpload image={null} onChanged={vi.fn()} />);

    const file = new File(["image"], "avatar.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Upload photo"), file);

    expect(await screen.findByText("Image must be 5MB or smaller")).toBeInTheDocument();
  });

  it("removes the image and calls onChanged", async () => {
    mockedAxios.delete.mockResolvedValue({});
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <CustomerAvatarUpload image="/api/uploads/customers/1.jpg" onChanged={onChanged} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove photo" }));

    await waitFor(() =>
      expect(mockedAxios.delete).toHaveBeenCalledWith("/api/customer/profile/avatar"),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
