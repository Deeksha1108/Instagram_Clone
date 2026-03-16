export function getDeviceInfo(userAgent?: string): string {
  const ua = (userAgent || '').toLowerCase();

  if (!ua) return 'Desktop/Unknown';

  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  if (ua.includes('windows')) return 'Windows PC';
  if (ua.includes('macintosh')) return 'Mac';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('chrome')) return 'Chrome Browser';
  if (ua.includes('firefox')) return 'Firefox Browser';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari Browser';
  if (ua.includes('mobile')) return 'Mobile';
  if (ua.includes('tablet')) return 'Tablet';

  return 'Desktop/Unknown';
}