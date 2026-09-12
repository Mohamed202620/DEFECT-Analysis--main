export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const config = {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "AIzaSyBocUzghhDY2eY9Dg8B-UwlV-ye844_DtA",
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || "1:1065779979535:web:6d53e69c4cfde57b414a7a",
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || "maintenance-defect-system.firebaseapp.com",
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || "1065779979535",
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "maintenance-defect-system",
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || "maintenance-defect-system.firebasestorage.app",
    FIREBASE_FUNCTIONS_REGION: process.env.FIREBASE_FUNCTIONS_REGION || "us-central1",
    IMGBB_API_KEY: process.env.IMGBB_API_KEY || "9e43fc30da5df3c4cdf213f1725504c7"
  };

  res.status(200).send(`window.APP_CONFIG = ${JSON.stringify(config)};`);
}
