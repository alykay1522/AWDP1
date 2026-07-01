import { describe, expect, it } from "vitest";
import {
  getSafeResourceRedirectUrl,
  parsePublicResourceId,
} from "./resourceRedirect.js";

describe("resource redirect helpers", () => {
  it.each([
    ["42", 42],
    ["0", 0],
    ["-100001", -100001],
  ])("parses resource id %s", (value, expected) => {
    expect(parsePublicResourceId(value)).toBe(expected);
  });

  it.each(["", "1.5", "1/2", "abc", "9007199254740992", undefined])(
    "rejects invalid resource id %s",
    (value) => {
      expect(parsePublicResourceId(value)).toBeNull();
    },
  );

  it.each([
    ["https://example.com/file.pdf", "https://example.com/file.pdf"],
    ["http://example.com/file.pdf", "http://example.com/file.pdf"],
  ])("accepts HTTP(S) resource URL %s", (value, expected) => {
    expect(getSafeResourceRedirectUrl(value)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/file.pdf",
    "/relative/file.pdf",
    "not a url",
    "",
    undefined,
  ])("rejects unsafe resource URL %s", (value) => {
    expect(getSafeResourceRedirectUrl(value)).toBeNull();
  });
});
