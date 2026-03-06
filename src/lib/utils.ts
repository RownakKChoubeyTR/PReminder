import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx.
 *
 * Combines conditional class logic (clsx) with intelligent
 * Tailwind class deduplication (twMerge) so that later
 * utilities correctly override earlier ones.
 *
 * @example cn('px-2 py-1', isActive && 'bg-primary', className)
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
