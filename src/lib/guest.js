'use client';

import { useEffect, useState } from 'react';

// Guest mode: browsing without an account. The guest picks a major and a
// campus on the sign-in page, and that choice is all the "profile" they have.
// It lives only in this browser; signing in clears it.
const KEY = 'guest';

// Where every locked thing sends a guest.
export const SIGN_UP_HREF = '/auth?signup=1';

export function getGuest() {
    try {
        const g = JSON.parse(localStorage.getItem(KEY));
        return g?.major ? g : null;
    } catch {
        return null;
    }
}

export function setGuest(guest) {
    try { localStorage.setItem(KEY, JSON.stringify(guest)); } catch { }
}

export function clearGuest() {
    try { localStorage.removeItem(KEY); } catch { }
}

// Shaped like a profiles row, so pages that read profile.major and
// profile.gender work unchanged. No id: nothing can be saved against it.
export function guestProfile(guest) {
    return { id: null, name: 'Guest', major: guest.major, gender: guest.gender, isGuest: true };
}

// What a locked control does when tapped: shakes (the guest-refuse animation
// in globals.css) and buzzes where the phone allows, instead of going anywhere.
export function refuse(e) {
    e.preventDefault();
    const el = e.currentTarget;
    el.classList.remove('guest-refuse');
    void el.offsetWidth; // restarts the animation on a repeat tap
    el.classList.add('guest-refuse');
    navigator.vibrate?.(60);
}

// For chrome (nav, menu, bell) that has no profile of its own to look at.
export function useIsGuest() {
    const [isGuest, setIsGuest] = useState(false);
    useEffect(() => { setIsGuest(!!getGuest()); }, []);
    return isGuest;
}
