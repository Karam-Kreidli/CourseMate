// PostgREST answers with at most 1000 rows, whatever the query asks for, and
// says so nowhere: a table that grows past that silently starts returning a
// slice. Any read that can exceed it goes through here.
//
//   const { data, error } = await fetchAllRows(() =>
//       supabase.from('sections').select('*').eq('term_code', term));
//
// `build` is called once per page, so it must return a fresh query each time.
const PAGE_SIZE = 1000;

export async function fetchAllRows(build, { pageSize = PAGE_SIZE } = {}) {
    const rows = [];
    for (let page = 0; ; page++) {
        const { data, error } = await build().range(page * pageSize, page * pageSize + pageSize - 1);
        if (error) return { data: rows, error };
        rows.push(...(data || []));
        if (!data || data.length < pageSize) return { data: rows, error: null };
    }
}
