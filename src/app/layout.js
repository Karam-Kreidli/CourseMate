import './globals.css';
import Script from 'next/script';
import { SemesterProviderWrapper } from '@/lib/SemesterContext';

export const metadata = {
    title: 'CourseMate',
    description: 'University course section swap platform',
    icons: {
        icon: '/logo.png',
        shortcut: '/logo.png',
        apple: '/logo.png',
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <meta name="theme-color" content="#0a2540" />
                <script dangerouslySetInnerHTML={{
                    __html: `
                        (function () {
                            try {
                                // Runs before paint so the saved theme is applied without a flash.
                                // 'system' (and anything unrecognised) resolves here rather than
                                // reaching the CSS, which only defines light, dark and black.
                                var saved = localStorage.getItem('theme');
                                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                var theme = (saved === 'light' || saved === 'dark' || saved === 'black')
                                    ? saved
                                    : (prefersDark ? 'dark' : 'light');
                                document.documentElement.setAttribute('data-theme', theme);
                            } catch (e) { }
                        })();
                    `,
                }} />
            </head>
            <body suppressHydrationWarning>
                <SemesterProviderWrapper>
                    {children}
                </SemesterProviderWrapper>
            </body>
        </html>
    );
}
