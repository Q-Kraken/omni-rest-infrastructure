import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";
import styles from "@/app/admin/admin.module.css";

export function AdminAccessDenied() {
  return (
    <main id="main-content" className={styles.adminMain}>
      <p className={styles.eyebrow}>Owner Portal</p>
      <h1>Access denied</h1>
      <p>This account cannot manage the restaurant at this address. Sign out and sign in with an account for this restaurant.</p>
      <div className={styles.buttonRow}>
        <LogoutButton className={styles.primaryButton} />
        <Link className={styles.secondaryButton} href="/">Visit restaurant website</Link>
      </div>
    </main>
  );
}
