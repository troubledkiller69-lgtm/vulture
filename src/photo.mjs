export function parsePhoto(photo) {
  if (photo == null) return null;
  if (typeof photo !== 'string' || photo.length > 2700000) throw new Error('Use a JPEG or PNG photo smaller than 2 MB.');
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
  if (!match) throw new Error('Use a JPEG or PNG photo.');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (bytes.length > 2000000) throw new Error('Use a photo smaller than 2 MB.');
  const png = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(match[1] === 'image/png' ? png : jpeg)) throw new Error('The photo file is not valid.');
  return { bytes, type: match[1] };
}
