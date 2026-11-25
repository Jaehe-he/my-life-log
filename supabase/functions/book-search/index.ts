// 네이버 책 검색을 대신 호출해 주는 Supabase Edge Function.
// 네이버 키는 브라우저에 두면 안 되므로 여기(서버)에만 보관합니다.
// 필요한 비밀 값: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') throw new Error('query is required');
    const r = await fetch(`https://openapi.naver.com/v1/search/book.json?display=10&query=${encodeURIComponent(query)}`, {
      headers: {
        'X-Naver-Client-Id': Deno.env.get('NAVER_CLIENT_ID') ?? '',
        'X-Naver-Client-Secret': Deno.env.get('NAVER_CLIENT_SECRET') ?? '',
      },
    });
    if (!r.ok) throw new Error(`naver ${r.status}`);
    const data = await r.json();
    return new Response(JSON.stringify({ items: data.items ?? [] }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
