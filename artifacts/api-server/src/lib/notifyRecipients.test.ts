import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getContactForwardEmails } from "./notifyRecipients.js";

const DEFAULT_EMAILS = [
  "thepolak@wefixitusa.com",
  "alyshameade.1522@gmail.com",
];

describe("getContactForwardEmails", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CONTACT_FORWARD_EMAILS;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CONTACT_FORWARD_EMAILS;
    } else {
      process.env.CONTACT_FORWARD_EMAILS = originalEnv;
    }
  });

  it("returns default emails when env var is unset", () => {
    delete process.env.CONTACT_FORWARD_EMAILS;
    expect(getContactForwardEmails()).toEqual(DEFAULT_EMAILS);
  });

  it("returns default emails when env var is empty string", () => {
    process.env.CONTACT_FORWARD_EMAILS = "";
    expect(getContactForwardEmails()).toEqual(DEFAULT_EMAILS);
  });

  it("returns default emails when env var is whitespace only", () => {
    process.env.CONTACT_FORWARD_EMAILS = "   ";
    expect(getContactForwardEmails()).toEqual(DEFAULT_EMAILS);
  });

  it("uses env override when valid emails are provided", () => {
    process.env.CONTACT_FORWARD_EMAILS = "alice@example.com,bob@example.org";
    expect(getContactForwardEmails()).toEqual([
      "alice@example.com",
      "bob@example.org",
    ]);
  });

  it("trims whitespace around overridden addresses", () => {
    process.env.CONTACT_FORWARD_EMAILS = " alice@example.com , bob@example.org ";
    expect(getContactForwardEmails()).toEqual([
      "alice@example.com",
      "bob@example.org",
    ]);
  });

  it("filters out invalid emails from override list", () => {
    process.env.CONTACT_FORWARD_EMAILS = "good@example.com,not an email,ok@test.io";
    expect(getContactForwardEmails()).toEqual([
      "good@example.com",
      "ok@test.io",
    ]);
  });

  it("filters out emails containing forbidden characters", () => {
    process.env.CONTACT_FORWARD_EMAILS =
      "valid@example.com,has;semi@bad.com,has?query@bad.com,also&bad@bad.com";
    expect(getContactForwardEmails()).toEqual(["valid@example.com"]);
  });

  it("falls back to defaults when all override emails are invalid", () => {
    process.env.CONTACT_FORWARD_EMAILS = "not-valid,also bad,@nope";
    expect(getContactForwardEmails()).toEqual(DEFAULT_EMAILS);
  });

  it("accepts a single valid override email", () => {
    process.env.CONTACT_FORWARD_EMAILS = "solo@company.com";
    expect(getContactForwardEmails()).toEqual(["solo@company.com"]);
  });

  it("handles emails with subdomains", () => {
    process.env.CONTACT_FORWARD_EMAILS = "user@mail.sub.example.co.uk";
    expect(getContactForwardEmails()).toEqual(["user@mail.sub.example.co.uk"]);
  });

  it("handles emails with plus addressing", () => {
    process.env.CONTACT_FORWARD_EMAILS = "user+tag@example.com";
    expect(getContactForwardEmails()).toEqual(["user+tag@example.com"]);
  });
});
