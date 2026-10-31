# Windows image-test cleanup fix

The reported `npm run check` failure is an `EBUSY` error removing a temporary WebP file in `tests/media.test.js`. Lint and formatting completed before that error. The cleanup error alone does not identify which process retained the Windows file lock.

The test now reads the saved file with `fs.readFile` and passes the resulting Buffer to Sharp, rather than giving Sharp a filename. This avoids filename-backed libvips cache handles for the metadata check. Cleanup also uses `fs.rm` with `recursive: true`, `force: true`, `maxRetries: 5` and `retryDelay: 100` for temporary Windows file locks. Persistent errors still fail the test; assertions are not skipped and errors are not swallowed.

Only the test changes. The application image-validation and metadata-stripping logic remain covered.

## Apply to your current project

Replace `tests/media.test.js` with the downloaded `media.test.js`. Keep the previous Vercel configuration fix. In Git Bash, from the folder containing `package.json`, run:

```bash
node --test tests/media.test.js
npm run check
```

After both commands pass:

```bash
git add tests/media.test.js
git commit -m "Fix Windows image test file cleanup"
git push origin master
```

The supplied deployment log uses `master`. Verify your branch with `git branch --show-current` if you have changed branches. Confirm Vercel builds the new commit.

## Verification

On 18 October 2026 UTC, the isolated image test, ESLint, Prettier, all 44 unit tests, all seven DOM interaction tests and the Vite production build passed in the Linux project environment. No native Windows runtime was available here, so the Windows file-lock regression must be confirmed by the local commands above. No deployment was performed by this fix.
