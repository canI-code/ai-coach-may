'use client';

import React from 'react';
import Link from 'next/link';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function NavLink({ href, children, className = '' }: NavLinkProps) {
  return (
    <Link 
      href={href} 
      className={`text-white/60 hover:text-white transition-colors duration-200 ${className}`}
    >
      {children}
    </Link>
  );
}

interface HeaderProps {
  children?: React.ReactNode;
  showNav?: boolean;
  className?: string;
}

export function Header({ children, showNav = true, className = '' }: HeaderProps) {
  return (
    <header className={`nav-glass ${className}`}>
      <div className="flex items-center justify-between w-full">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-gradient-amber">AI Coach</span>
        </Link>
        
        {showNav && (
          <nav className="hidden md:flex items-center gap-8">
            <NavLink href="/features">Features</NavLink>
            <NavLink href="/plans">Plans</NavLink>
            <NavLink href="/about">About</NavLink>
            <NavLink href="/contact">Contact</NavLink>
          </nav>
        )}
        
        {children || (
          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-white/60 hover:text-white transition-colors duration-200 hidden sm:block"
            >
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="btn-primary !py-2 !px-4 text-sm"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

interface MobileMenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function MobileMenuButton({ isOpen, onClick }: MobileMenuButtonProps) {
  return (
    <button 
      className="md:hidden p-2 text-white/60 hover:text-white"
      onClick={onClick}
      aria-label="Toggle menu"
    >
      {isOpen ? <CloseIcon /> : <MenuIcon />}
    </button>
  );
}

function MenuIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}