export const navigateTo = (page) => {
  // منع غير المدير من فتح صفحة إدارة المستخدمين
  if (page === "users") {
     if (currentRole !== "admin") {
        alert("ليس لديك صلاحية");
        return;
     }
  }

  currentPage = page;

  if (page === "home") {
     loadDashboard();
  }

  if (page === "users") {
     loadUsers();
  }

  render();
  window.scrollTo(0, 0);
};