# Public asset build

The production asset build generates responsive hero images and a single minified CSS bundle.

## Run locally

```bash
npm install
npm run build
```

Generated files:

- `dist/assets/river-path-480w.webp`
- `dist/assets/river-path-800w.webp`
- `dist/assets/river-path-1200w.webp`
- `dist/site.min.css`

The image build uses `sharp`. The CSS step concatenates `styles.css`, `align-theme.css`, and `warm-theme.css`, rejects CSS `@import` rules, then minifies the result with `esbuild`.

## Cloudflare Pages

Before changing the deployed HTML to depend on generated files, configure the Pages build command as:

```
npm run build
```

and keep the build output directory as:

```
dist
```

After the build command is active, update public HTML to load `/site.min.css` and use the responsive `river-path-*w.webp` image set.
