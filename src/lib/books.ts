import { supabase } from './db';

export type BookHit = { title: string; author: string; publisher: string; cover: string; isbn: string; total_pages: number | null };

const strip = (s: string) => (s || '').replace(/<[^>]+>/g, '');

async function google(q: string): Promise<BookHit[]> {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?maxResults=10&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('도서 검색에 실패했습니다');
  const j = await r.json();
  return (j.items || []).map((it: any) => {
    const v = it.volumeInfo || {};
    const isbn = (v.industryIdentifiers || []).find((x: any) => x.type === 'ISBN_13')?.identifier || '';
    return {
      title: v.title || '', author: (v.authors || []).join(', '), publisher: v.publisher || '',
      cover: (v.imageLinks?.thumbnail || '').replace('http://', 'https://'), isbn, total_pages: v.pageCount || null,
    };
  });
}

/** 네이버 책 검색(Supabase 함수 경유). 설정되지 않았거나 실패하면 구글 도서 검색을 쓴다 */
export async function searchBooks(q: string): Promise<{ hits: BookHit[]; source: string }> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('book-search', { body: { query: q } });
      if (!error && Array.isArray(data?.items)) {
        return {
          source: '네이버',
          hits: data.items.map((it: any) => ({
            title: strip(it.title), author: strip(it.author).replace(/\^/g, ', '), publisher: strip(it.publisher),
            cover: it.image || '', isbn: (it.isbn || '').split(' ').pop() || '', total_pages: null,
          })),
        };
      }
    } catch { /* 구글로 넘어감 */ }
  }
  return { source: '구글', hits: await google(q) };
}

/** 네이버는 쪽수를 주지 않으므로 ISBN으로 구글에서 쪽수만 찾아온다 */
export async function findPages(isbn: string): Promise<number | null> {
  if (!isbn) return null;
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const j = await r.json();
    return j.items?.[0]?.volumeInfo?.pageCount || null;
  } catch {
    return null;
  }
}
