import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("renders the simulator shell and key controls", () => {
    render(<App />);

    expect(screen.getAllByText("Observation Geometry Lab").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Comparison-first observation simulator"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /More CE/i })).toBeInTheDocument();
    expect(screen.getAllByText("Export PNG").length).toBeGreaterThan(0);
    expect(screen.getByText("Model Transparency")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Split Compare" })).toHaveClass(
      "scene-toolbar__button",
      "scene-toolbar__button--active",
    );
    expect(screen.getByRole("textbox", { name: "Observer height value" })).toHaveValue("2");
  });
});
