// getRandomValues is also available in WebViews where randomUUID is unavailable.
export function createImageId(source: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  if (!source?.getRandomValues) throw new Error('이 Windows WebView에서 이미지 파일명을 생성할 수 없습니다. WebView2를 업데이트해 주세요.');
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
