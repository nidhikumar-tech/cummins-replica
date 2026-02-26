"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation"; 
import styles from "./Navbar.module.css";
// [CHANGE START] Import Auth Hook
import { useAuth } from "@/context/AuthContext";
// [CHANGE END]

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname(); 
  // [CHANGE START] Get user and logout function
  const { user, logout } = useAuth();
  // [CHANGE END]

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const isActive = (path) => pathname === path ? styles.activeLink : ""; 


  return (
    <nav className={styles.navbar}>
      {/* Left Section - Logo */}
      <div className={styles.navLeft}>
        <Link href="/dashboard/predictions" className={styles.logo}>
          <svg
            className={styles.logoIcon}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M 30 12 A 12 12 0 1 0 30 28"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>

      {/* Mobile Menu Toggle */}
      <button
        className={styles.hamburger}
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span className={`${styles.hamburgerLine} ${isMenuOpen ? styles.active : ""}`}></span>
        <span className={`${styles.hamburgerLine} ${isMenuOpen ? styles.active : ""}`}></span>
        <span className={`${styles.hamburgerLine} ${isMenuOpen ? styles.active : ""}`}></span>
      </button>

      {/* Center Section - Navigation Links */}
      {pathname !== "/login" && (
        <div className={`${styles.navCenter} ${isMenuOpen ? styles.active : ""}`}>
          <Link
            href="/dashboard/infrastructure"
            className={`${styles.navLink} ${isActive("/dashboard/infrastructure")}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
            </svg>
            <span>Energy Infrastructure</span>
          </Link>

          

          <Link
            href="/dashboard/data"
            className={`${styles.navLink} ${isActive("/dashboard/data")}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z" />
            </svg>
            <span>Data</span>
          </Link>

          <Link
            href="/dashboard/predictions"
            className={`${styles.navLink} ${isActive("/dashboard/predictions")}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z" />
            </svg>
            <span>Predictions</span>
          </Link>

          <Link
            href="/dashboard/insights"
            className={`${styles.navLink} ${isActive("/dashboard/insights")}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
            </svg>
            <span>Insights</span>
          </Link>
{/* 
          <Link
            href="/dashboard/summary"
            className={`${styles.navLink} ${isActive("/dashboard/summary")}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <svg className={styles.navIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
            </svg>
            <span>Summary</span>
          </Link>
*/}

        </div>
      )}

      {/* Right Section - User/Account */}
      <div className={styles.navRight}>
        {/* [CHANGE START] Auth Logic */}
        {user ? (
          // Logged In State: Show Email & Sign Out Button
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
              {user.email}
            </span>
            <button 
              onClick={logout}
              style={{
                padding: '8px 12px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
               Sign Out
            </button>
          </div>
        ) : (
          // Logged Out State: Show Login Link
          <Link 
            href="/login" 
            style={{ 
              textDecoration: 'none', 
              color: '#2563eb', 
              fontWeight: '600',
              padding: '8px 16px',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              backgroundColor: '#eff6ff'
            }}
          >
            Login
          </Link>
        )}
        {/* [CHANGE END] */}
      </div>
    </nav>
  );
}