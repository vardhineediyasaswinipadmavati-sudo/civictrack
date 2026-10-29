
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import {
  PlusCircle,
  LogOut,
  Menu,
  X,
  Layers,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getDashboardLink = () => {
    if (!user) return '/';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'department_staff') return '/staff';
    return '/citizen';
  };

  const navLinks = [
    {
      label: 'Dashboard',
      to: getDashboardLink(),
      show: isAuthenticated,
    },
    {
      label: 'Public Map',
      to: '/map',
      show: true,
    },
    {
      label: 'Infrastructure Assets',
      to: '/infrastructure',
      show: true,
    },
    {
      label: 'Lifecycle Analytics',
      to: '/analytics',
      show: true,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    closeMobileMenu();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo and Branding */}
          <Link
            to="/"
            onClick={closeMobileMenu}
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="CivicTrack Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-civic-800 to-civic-600 text-white shadow-md shadow-civic-500/20 transition-transform group-hover:scale-105">
              <Layers className="h-5 w-5" />
            </div>

            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                Civic<span className="text-civic-600">Track</span>
              </span>
              <p className="hidden text-[10px] font-medium text-slate-500 sm:block">
                Infrastructure Lifecycle Management
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 border-l border-slate-200 pl-4 md:flex"
          >
            {navLinks
              .filter((link) => link.show)
              .map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isActive(link.to)
                      ? 'bg-cyan-50 text-cyan-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/report"
              className="inline-flex items-center gap-1.5 rounded-lg bg-civic-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-civic-700 sm:px-3.5"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">
                Report Civic Issue
              </span>
              <span className="sm:hidden">Report</span>
            </Link>

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <NotificationDropdown />

                <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex">
                  <div className="max-w-32 text-right">
                    <p className="truncate text-xs font-semibold leading-tight text-slate-800">
                      {user?.name}
                    </p>
                    <span className="text-[10px] font-medium capitalize text-slate-500">
                      {user?.role === 'department_staff'
                        ? 'Department Staff'
                        : user?.role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="Sign Out"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  to="/login"
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Sign In
                </Link>

                <Link
                  to="/register"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
              aria-label={
                mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
              }
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden"
        >
          {navLinks
            .filter((link) => link.show)
            .map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={closeMobileMenu}
                className={`block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? 'bg-cyan-50 text-cyan-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}

          {!isAuthenticated && (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <Link
                to="/login"
                onClick={closeMobileMenu}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign In
              </Link>

              <Link
                to="/register"
                onClick={closeMobileMenu}
                className="rounded-lg bg-slate-900 px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
              >
                Register
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="border-t border-slate-100 pt-3">
              <div className="px-3 pb-2">
                <p className="text-sm font-semibold text-slate-900">
                  {user?.name}
                </p>
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {user?.role === 'department_staff'
                    ? 'Department Staff'
                    : user?.role}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;