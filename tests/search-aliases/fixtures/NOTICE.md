# Fixture corpus

`manifests/` holds 29 package manifests copied verbatim from
[microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) at commit
`0a5a7ba57e69adc0a8016154b5b1d7eaae82f916` (MIT licence, © Microsoft Corporation and
contributors) plus four synthetic packages (`WeirdCorp.Tool`, `Vendor.Product.7`,
`Vendor.Product.8`, `Vendor.Studio.3`) written for this test suite.

They exercise the generator without the full snapshot: exe, MSIX, portable, several
installers, localized names, moniker, commands, `AppsAndFeaturesEntries`, version families,
a browser, a host runtime, a helper, a collision pair and awkward YAML (anchors, flow style,
folded scalars, quoted escapes, `__proto__`).

`expected-index.json` is the deterministic generator output for this corpus. Re-record it with
`KESVIO_ALIAS_FIXTURE_UPDATE=1 npx vitest run tests/search-aliases` and review the diff.
