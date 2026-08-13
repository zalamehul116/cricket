const IMAGEKIT_ENDPOINT = (
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/i087hdblp'
).replace(/\/$/, '');

function ensureImageKitTransform(url: string): string {
  if (/[?&]tr=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}tr=w-800,c-at_max`;
}

function resolveImageKitUrl(url: string): string {
  const clean = url.trim();

  if (clean.includes('ik.imagekit.io')) {
    return ensureImageKitTransform(clean);
  }

  const imageKitPathMatch = clean.match(/^\/?(oction-uploads\/.*)$/);
  if (imageKitPathMatch) {
    return ensureImageKitTransform(`${IMAGEKIT_ENDPOINT}/${imageKitPathMatch[1]}`);
  }

  return clean;
}

export function getDirectDriveUrl(url: string): string {
  if (!url) return 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200'; // fallback image
  
  const cleanUrl = url.trim();
  
  // Extract id from Google Drive link
  // Matches:
  // - https://drive.google.com/open?id=1uxZJehlUX52mzT8y3A-GDkQvWKMPTKB3
  // - https://drive.google.com/file/d/1uxZJehlUX52mzT8y3A-GDkQvWKMPTKB3/view?usp=sharing
  const idMatch = cleanUrl.match(/(?:id=|\/d\/|d=)([a-zA-Z0-9_-]{15,})/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
  }

  return resolveImageKitUrl(cleanUrl);
}

export function formatCurrency(value: number | string): string {
  if (value === '' || value === undefined || value === null) return '₹0';
  const num = Number(value);
  if (isNaN(num)) return '₹0';
  
  // Format as Lakhs/Crores or standard Indian format
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} Lakh`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}
