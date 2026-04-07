import {
  heightFromRadius,
  localUpAtAngle,
  pointAtSurfaceHeight,
} from "../domain/geometry";

describe("geometry helpers", () => {
  it("places convex points outside the sphere", () => {
    const point = pointAtSurfaceHeight(1000, 0, "convex", 50);
    expect(point.x).toBeCloseTo(1050, 6);
    expect(point.y).toBeCloseTo(0, 6);
    expect(heightFromRadius(1050, 1000, "convex")).toBeCloseTo(50, 6);
  });

  it("treats concave local up as centerward", () => {
    const up = localUpAtAngle(0, "concave");
    expect(up.x).toBeCloseTo(-1, 6);
    expect(up.y).toBeCloseTo(0, 6);
  });
});

