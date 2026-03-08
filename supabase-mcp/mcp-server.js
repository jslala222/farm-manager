/**
 * Supabase MCP Server
 * Farm Manager (농장 관리 프로그램) 전용
 * 테이블 접두사 없음 (BMS와 다름)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.error(`[Farm MCP Server] Started`);
console.error(`🔗 URL: ${process.env.SUPABASE_URL}`);

const tools = {
  'farm_query': {
    description: '농장 DB 테이블에서 데이터 조회 (SELECT)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        select: { type: 'string' },
        filter: { type: 'object', properties: { column: { type: 'string' }, operator: { type: 'string' }, value: {} } },
        filters: { type: 'array', items: { type: 'object' } },
        limit: { type: 'number' },
        orderBy: { type: 'string' },
        ascending: { type: 'boolean' }
      },
      required: ['table']
    }
  },
  'farm_insert': {
    description: '농장 DB 테이블에 데이터 삽입 (INSERT)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        data: { type: 'object' },
        rows: { type: 'array', items: { type: 'object' } }
      },
      required: ['table']
    }
  },
  'farm_update': {
    description: '농장 DB 테이블 데이터 수정 (UPDATE)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        id: { type: 'string' },
        data: { type: 'object' },
        filter: { type: 'object' }
      },
      required: ['table', 'data']
    }
  },
  'farm_delete': {
    description: '농장 DB 테이블 데이터 삭제 (DELETE)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        id: { type: 'string' }
      },
      required: ['table', 'id']
    }
  },
  'farm_list_tables': {
    description: '현재 DB의 모든 테이블 목록 조회',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  'farm_describe_table': {
    description: '특정 테이블의 칼럼 구조 조회',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string' } },
      required: ['table']
    }
  }
};

function applyFilter(query, filter) {
  const { column, operator, value } = filter;
  switch (operator) {
    case 'eq': return query.eq(column, value);
    case 'neq': return query.neq(column, value);
    case 'gt': return query.gt(column, value);
    case 'gte': return query.gte(column, value);
    case 'lt': return query.lt(column, value);
    case 'lte': return query.lte(column, value);
    case 'like': return query.like(column, value);
    case 'ilike': return query.ilike(column, value);
    case 'contains': return query.ilike(column, `%${value}%`);
    case 'is': return query.is(column, value);
    case 'in': return query.in(column, value);
    default: return query.eq(column, value);
  }
}

async function handleFarmQuery(table, select = '*', filter, filters, limit = 100, orderBy, ascending = true) {
  try {
    let query = supabase.from(table).select(select);
    if (filter) query = applyFilter(query, filter);
    if (filters && Array.isArray(filters)) for (const f of filters) query = applyFilter(query, f);
    if (orderBy) query = query.order(orderBy, { ascending });
    query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { success: true, table, count: data?.length || 0, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmInsert(table, data, rows) {
  try {
    const insertData = rows && rows.length > 0 ? rows : [data];
    const { data: result, error } = await supabase.from(table).insert(insertData).select();
    if (error) throw new Error(error.message);
    return { success: true, table, count: result?.length || 0, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmUpdate(table, id, data, filter) {
  try {
    let query = supabase.from(table).update(data);
    if (id) query = query.eq('id', id);
    else if (filter) query = applyFilter(query, filter);
    else throw new Error('id 또는 filter 중 하나는 필수입니다');
    const { data: result, error } = await query.select();
    if (error) throw new Error(error.message);
    return { success: true, table, count: result?.length || 0, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmDelete(table, id) {
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { success: true, table, message: `Deleted record with id: ${id}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmListTables() {
  return {
    success: true,
    data: [
      'profiles', 'farms', 'farm_crops', 'workers', 'attendance_records',
      'partners', 'customers', 'sales_records', 'expenditures',
      'harvest_records', 'other_incomes', 'house_diaries'
    ]
  };
}

async function handleFarmDescribeTable(table) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) throw new Error(error.message);
    const columns = data && data.length > 0
      ? Object.keys(data[0]).map(k => ({ column: k, sampleValue: data[0][k], type: typeof data[0][k] }))
      : [];
    return { success: true, table, columns, sampleRow: data?.[0] || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleRequest(request) {
  const { id, method, params } = request;
  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'farm-supabase-mcp', version: '1.0.0' }
    });
  } else if (method === 'notifications/initialized') {
    // 응답 불필요
  } else if (method === 'tools/list') {
    sendResponse(id, {
      tools: Object.entries(tools).map(([name, schema]) => ({ name, ...schema }))
    });
  } else if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      let result;
      if (name === 'farm_query') result = await handleFarmQuery(args.table, args.select, args.filter, args.filters, args.limit, args.orderBy, args.ascending);
      else if (name === 'farm_insert') result = await handleFarmInsert(args.table, args.data, args.rows);
      else if (name === 'farm_update') result = await handleFarmUpdate(args.table, args.id, args.data, args.filter);
      else if (name === 'farm_delete') result = await handleFarmDelete(args.table, args.id);
      else if (name === 'farm_list_tables') result = await handleFarmListTables();
      else if (name === 'farm_describe_table') result = await handleFarmDescribeTable(args.table);
      else throw new Error(`Unknown tool: ${name}`);
      sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    } catch (error) {
      sendError(id, error.message);
    }
  } else if (id) {
    sendError(id, `Unknown method: ${method}`);
  }
}

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendError(id, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } }) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line.trim());
    await handleRequest(request);
  } catch (error) {
    console.error('[Parse Error]', error.message);
  }
});

console.error('✅ Farm Manager Supabase MCP Server started successfully');
console.error(`🌾 Tables: no prefix (direct table names)`);
console.error(`🔗 URL: ${process.env.SUPABASE_URL}`);