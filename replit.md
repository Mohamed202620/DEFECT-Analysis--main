# Running on Replit

This project is a static Progressive Web App. It does not require a build step or
local package installation.

## Replit workflow

The configured `Start application` workflow serves the project from its root:

```bash
python3 -m http.server 5000 --bind 0.0.0.0
```

The workflow uses port `5000`, so the app is available through the Replit
Preview.

To run it manually in a shell, use the same command from the project root.

## External services

The browser app expects the service configuration already present in
`js/config.js`:

- Firebase Authentication and Firestore
- Google Apps Script as a backup endpoint
- ImgBB for image uploads

These services must be enabled and permitted in their respective consoles for
login, data access, backup operations, and image uploads to work. The included
`firestore.rules` file must be applied in the Firebase console or deployed with
the Firebase CLI; keeping it in the repository alone does not apply the rules.