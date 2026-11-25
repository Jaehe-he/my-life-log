import { useEffect, useState } from 'react';
import { isLocal, supabase } from './db';

/** 사진을 줄여서 JPEG로 만든다. 클라우드: 긴 변 1280px, 체험 모드: 640px */
async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const max = isLocal ? 640 : 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('사진을 변환하지 못했습니다'))), 'image/jpeg', 0.72));
}

/** 올린 뒤 저장할 값(클라우드: 저장소 경로, 체험 모드: data URL)을 돌려준다 */
export async function uploadPhoto(file: File): Promise<string> {
  const blob = await compress(file);
  if (!supabase) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(blob);
    });
  }
  const { data } = await supabase.auth.getUser();
  const path = `${data.user!.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function deletePhoto(ref: string) {
  if (supabase && !ref.startsWith('data:')) await supabase.storage.from('photos').remove([ref]);
}

const urlCache = new Map<string, Promise<string>>();
export function usePhotoUrl(ref: string) {
  const [url, setUrl] = useState(ref.startsWith('data:') ? ref : '');
  useEffect(() => {
    if (ref.startsWith('data:') || !supabase) return setUrl(ref);
    let p = urlCache.get(ref);
    if (!p) {
      p = supabase.storage.from('photos').createSignedUrl(ref, 3600).then(({ data }) => data?.signedUrl || '');
      urlCache.set(ref, p);
    }
    let alive = true;
    p.then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [ref]);
  return url;
}

/** 사진 저장소 사용량(바이트). 체험 모드에서는 null */
export async function photoUsage(): Promise<number | null> {
  if (!supabase) return null;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  let total = 0;
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from('photos').list(u.user.id, { limit: 1000, offset });
    if (error || !data) break;
    total += data.reduce((a, f: any) => a + (f.metadata?.size || 0), 0);
    if (data.length < 1000) break;
  }
  return total;
}
