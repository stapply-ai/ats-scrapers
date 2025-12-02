import Link from 'next/link';
import { StapplyLogo } from './logo';

interface PageHeaderProps {
    rightAction?: React.ReactNode;
}

export function PageHeader({ rightAction }: PageHeaderProps) {
    return (
        <header className="bg-black/30 backdrop-blur-2xl sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
                <Link
                    href="/"
                    className="text-white/60 hover:text-white transition-colors shrink-0"
                >
                    <StapplyLogo size={32} />
                </Link>
                {rightAction && (
                    <div className="shrink-0">
                        {rightAction}
                    </div>
                )}
            </div>
        </header>
    );
}

