# WebKit native-select CSP message

**Browser:** Playwright 1.64.1's WebKit build, user agent `Version/27.2 Safari/605.1.15` (this is the WebKit engine, not Safari on a real Mac or iPhone).

**Exact console text (error, once per native `<select>`, so twice on this page):**

> Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.

**The matching `securitypolicyviolation` event:** `violatedDirective` and `effectiveDirective` `style-src-attr`, `blockedURI` `inline`, `disposition` `enforce`, no sample. The reported source file is the page's own script bundle, which is only where the page was when the browser raised it.

## Is it an application defect?

No, on the evidence:

- A bare page with the production CSP and a single `<select>` and no script produces the same console message once. Pages with no `<select>` (a paragraph, a range input, an aria-disabled button) produce none.
- The built page has no `<style>` element and no `style` attribute (`document.querySelectorAll('style, [style]').length` is 0), and the source has no `style=` prop.
- Chromium and Firefox report nothing.

WebKit applies its built-in menu styling to a native select through an inline style attribute and reports that against the page's policy. Fixing it would mean replacing the native select (losing an accessible, labelled, keyboard-operable control) or adding `'unsafe-inline'` to `style-src` (weakening the policy). Neither was done.

## The selects remain usable

`e2e/smoke.spec.ts` ("the native selects work") selects both by pointer and by keyboard in WebKit, Firefox and Chromium, and the example values fill them. The estimate flows run through the selects in all three engines.

## The allowance cannot hide unrelated violations

The WebKit smoke test requires, exactly: the console errors equal the message above, once per `<select>` and nothing else; the recorded violation events equal one `style-src-attr` / `inline` event per `<select>` and nothing else; and no `<style>` or `[style]` in the DOM. Any other message, directive, blocked URI or extra count fails it. Mutation check: making the app add `document.body.setAttribute('style', 'color:red')` produced one extra identical message and the test failed (`Received + 1`); the change was reverted. A violation of any other directive (script, image, connect, font) fails because it changes the events or the message list.

**Residual limit:** a _second_ inline-style violation that replaced one of the select events one-for-one would not be distinguished. The count would still match only if a select stopped producing its own. Chromium and Firefox, which tolerate nothing, would catch any app-originated inline style first.
