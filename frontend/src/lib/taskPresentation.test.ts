import { describe, expect, it } from "vitest";
import { taskLabel } from "@/lib/taskPresentation";

describe("taskLabel", () => {
  it("names the FirePlan radio synchronization task", () => {
    expect(taskLabel("fireplan.sync_radios")).toBe("FirePlan-radiosynchronisatie");
  });
});
