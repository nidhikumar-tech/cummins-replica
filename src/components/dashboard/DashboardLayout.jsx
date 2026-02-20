"use client";
//test
import styles from "./DashboardLayout.module.css";
import ProtectedRoute from "@/components/auth/ProtectedRoute"
export default function DashboardLayout({ children }) {
  return (
    <ProtectedRoute>
    <div className={styles.dashboardContainer}>
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </div>
    </ProtectedRoute>
  );
}
