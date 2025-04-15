declare module 'next-pwa' {
    import { NextConfig } from 'next';
    
    interface PWAConfig {
        dest?: string;
        disable?: boolean;
        register?: boolean;
        scope?: string;
        sw?: string;
        skipWaiting?: boolean;
        buildExcludes?: Array<string | RegExp>;
        runtimeCaching?: Array<{
            urlPattern: string | RegExp;
            handler: string;
            options?: {
                cacheName?: string;
                networkTimeoutSeconds?: number;
                expiration?: {
                    maxEntries?: number;
                    maxAgeSeconds?: number;
                };
                cacheableResponse?: {
                    statuses: number[];
                };
            };
        }>;
    }

    function withPWA(config: NextConfig & { pwa?: PWAConfig }): NextConfig;
    export = withPWA;
} 