import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { BlockListSection } from "./BlockListSection";

describe("BlockListSection", () => {
  const mockAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("should have no accessibility violations", async () => {
    const { container } = render(<BlockListSection />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should display empty state when no accounts are blocked", () => {
    render(<BlockListSection />);
    expect(screen.getByText("No blocked accounts.")).toBeInTheDocument();
  });

  it("should load blocked accounts from localStorage", () => {
    localStorage.setItem("linkora_blocked_accounts", JSON.stringify([mockAddress]));
    render(<BlockListSection />);

    expect(screen.queryByText("No blocked accounts.")).not.toBeInTheDocument();
    expect(screen.getByText(mockAddress)).toBeInTheDocument();
  });

  it("should allow blocking a valid address", async () => {
    render(<BlockListSection />);

    const input = screen.getByPlaceholderText(/Enter Stellar address/);
    const blockButton = screen.getByText("Block Address");

    fireEvent.change(input, { target: { value: mockAddress } });
    fireEvent.click(blockButton);

    await waitFor(() => {
      expect(screen.getByText("Address blocked successfully.")).toBeInTheDocument();
    });

    expect(screen.getByText(mockAddress)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("linkora_blocked_accounts") || "[]")).toContain(
      mockAddress
    );
  });

  it("should show validation error for invalid address", () => {
    render(<BlockListSection />);

    const input = screen.getByPlaceholderText(/Enter Stellar address/);
    const blockButton = screen.getByText("Block Address");

    fireEvent.change(input, { target: { value: "INVALID" } });
    fireEvent.click(blockButton);

    expect(
      screen.getByText("Enter a valid Stellar address (starts with G or C, 56 characters).")
    ).toBeInTheDocument();
  });

  it("should allow unblocking a blocked address", async () => {
    localStorage.setItem("linkora_blocked_accounts", JSON.stringify([mockAddress]));
    render(<BlockListSection />);

    expect(screen.getByText(mockAddress)).toBeInTheDocument();

    const unblockButton = screen.getByText("Unblock");
    fireEvent.click(unblockButton);

    await waitFor(() => {
      expect(screen.getByText("Address unblocked successfully.")).toBeInTheDocument();
    });

    expect(screen.queryByText(mockAddress)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("linkora_blocked_accounts") || "[]")).not.toContain(
      mockAddress
    );
  });
});
