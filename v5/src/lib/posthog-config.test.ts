import { describe, expect, it } from "vitest";
import {
  demoRoleProperty,
  maskPostHogInput,
  PH_UNMASK_ATTR,
  postHogInitOptionsFromConfig,
  resolvePostHogClientConfig,
  shouldUnmaskPostHogInput,
  stripInputValuesFromCaptureEvent,
  type MaskableInput,
} from "./posthog-config";

function fakeInput(attrs: Record<string, string>): MaskableInput {
  return {
    getAttribute: (name) =>
      Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null,
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(attrs, name),
  };
}

describe("resolvePostHogClientConfig", () => {
  it("returns null when key is unset — no init path", () => {
    expect(
      resolvePostHogClientConfig({
        key: undefined,
        host: undefined,
        sessionRecording: undefined,
      }),
    ).toBeNull();
    expect(
      resolvePostHogClientConfig({
        key: "",
        host: undefined,
        sessionRecording: undefined,
      }),
    ).toBeNull();
    expect(
      resolvePostHogClientConfig({
        key: "   ",
        host: undefined,
        sessionRecording: undefined,
      }),
    ).toBeNull();
  });

  it("reads key and host from values; host falls back to US ingest when unset", () => {
    expect(
      resolvePostHogClientConfig({
        key: "phc_test",
        host: undefined,
        sessionRecording: undefined,
      }),
    ).toEqual({
      key: "phc_test",
      host: "https://us.i.posthog.com",
      sessionRecordingEnabled: true,
    });

    expect(
      resolvePostHogClientConfig({
        key: "phc_test",
        host: "https://eu.i.posthog.com",
        sessionRecording: undefined,
      }),
    ).toMatchObject({
      key: "phc_test",
      host: "https://eu.i.posthog.com",
    });
  });

  it("opt-out flag disables session recording in init options", () => {
    const config = resolvePostHogClientConfig({
      key: "phc_test",
      host: undefined,
      sessionRecording: "false",
    });
    expect(config?.sessionRecordingEnabled).toBe(false);
    const opts = postHogInitOptionsFromConfig(config!);
    expect(opts).toMatchObject({
      api_host: "https://us.i.posthog.com",
      disable_session_recording: true,
      capture_pageview: false,
      person_profiles: "identified_only",
    });
    expect(opts.session_recording).toMatchObject({
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
    });
    expect(typeof opts.session_recording.maskInputFn).toBe("function");
    expect(opts.autocapture).toMatchObject({
      element_attribute_ignorelist: ["value"],
    });
  });
});

describe("maskPostHogInput / shouldUnmaskPostHogInput", () => {
  it("returns clear text for the AI prompt (data-ph-unmask)", () => {
    const el = fakeInput({ [PH_UNMASK_ATTR]: "", name: "prompt", type: "text" });
    expect(shouldUnmaskPostHogInput(el)).toBe(true);
    expect(maskPostHogInput("Why is Cedar over budget?", el)).toBe(
      "Why is Cedar over budget?",
    );
  });

  it("masks login / password / email inputs even with data-ph-unmask", () => {
    const password = fakeInput({
      [PH_UNMASK_ATTR]: "",
      type: "password",
      name: "password",
    });
    const email = fakeInput({
      [PH_UNMASK_ATTR]: "",
      type: "email",
      name: "email",
    });
    const loginNamed = fakeInput({
      [PH_UNMASK_ATTR]: "",
      type: "text",
      name: "login",
      id: "login-user",
    });
    expect(maskPostHogInput("secret", password)).toBe("******");
    expect(maskPostHogInput("a@b.co", email)).toBe("******");
    expect(maskPostHogInput("ceo", loginNamed)).toBe("***");
    expect(shouldUnmaskPostHogInput(password)).toBe(false);
    expect(shouldUnmaskPostHogInput(email)).toBe(false);
    expect(shouldUnmaskPostHogInput(loginNamed)).toBe(false);
  });

  it("masks ordinary inputs without the unmask attribute", () => {
    const el = fakeInput({ name: "note", type: "text" });
    expect(maskPostHogInput("typed note", el)).toBe("**********");
    expect(maskPostHogInput("x")).toBe("*");
  });
});

describe("stripInputValuesFromCaptureEvent", () => {
  it("removes value attrs from autocapture-shaped payloads", () => {
    const event = stripInputValuesFromCaptureEvent({
      properties: {
        $el_attr__value: "secret typed text",
        value: "also secret",
        $el_text: "Submit",
        $elements: [
          { tag_name: "input", attr__value: "typed", value: "typed" },
          { tag_name: "button", text: "Go" },
        ],
      },
    });
    expect(event.properties?.$el_attr__value).toBeUndefined();
    expect(event.properties?.value).toBeUndefined();
    expect(event.properties?.$el_text).toBe("Submit");
    const els = event.properties?.$elements as Record<string, unknown>[];
    expect(els[0].attr__value).toBeUndefined();
    expect(els[0].value).toBeUndefined();
    expect(els[1].text).toBe("Go");
  });
});

describe("demoRoleProperty", () => {
  it("maps v5 roles to demo_role person properties (no PII)", () => {
    expect(demoRoleProperty("executive")).toBe("exec");
    expect(demoRoleProperty("pm")).toBe("pm");
    expect(demoRoleProperty("superintendent")).toBe("super");
    expect(demoRoleProperty("foreman")).toBe("foreman");
  });
});
