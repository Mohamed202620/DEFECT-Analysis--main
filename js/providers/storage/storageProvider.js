// ============================================================
// storageProvider.js
// توثيق واجهة "مزود استضافة الصور" (Storage Provider) - راجع
// providers/README.md. هذا الملف لا يحتوي منطقاً تنفيذياً، فقط
// يوثّق العقد (Contract) اللي أي تنفيذ فعلي (ImgBB، Firebase
// Storage، Cloudinary...) لازم يلتزم بيه عشان يفضل متوافق مع طبقة
// services (imageUpload.js) بدون أي تعديل فيها.
// ============================================================

/**
 * @typedef {Object} StorageProvider
 * @property {string} name
 *   اسم تعريفي قصير للمزود (مثال: "imgbb", "firebase-storage").
 * @property {(base64: string, name?: string) => Promise<string|null>} uploadImage
 *   يرفع صورة Base64 (Data URL بصيغة "data:image/...;base64,...")
 *   ويرجع رابط الصورة النهائي (Display URL) كنص، أو null لو الإدخال
 *   فاضي/غير صالح أصلاً. لازم يرمي (throw) Error عند فشل الرفع
 *   الفعلي (شبكة، مفتاح API غير صحيح، رفض من المزود...) بدل ما
 *   يرجع null بصمت.
 */

export {};
