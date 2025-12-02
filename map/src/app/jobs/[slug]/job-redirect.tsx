'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface JobRedirectProps {
    url: string;
}

export default function JobRedirect({ url }: JobRedirectProps) {
    const router = useRouter();

    useEffect(() => {
        // For external URLs, use window.location
        // For internal URLs, use Next.js router
        if (url.startsWith('http://') || url.startsWith('https://')) {
            window.location.href = url;
        } else {
            router.push(url);
        }
    }, [url, router]);

    // Show a loading state while redirecting
    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-white/60">Redirecting...</p>
            </div>
        </div>
    );
}

