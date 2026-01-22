import { expect, test } from "bun:test";
import { app } from "../src/app";

test("health endpoint exists", async () => {
  const res = await app.fetch(new Request("http://localhost/health"));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.status).toBe("ok");
});
