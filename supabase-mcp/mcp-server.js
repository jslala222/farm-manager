/**
 * Supabase MCP Server
 * Farm Manager (농장 관리 프로그램) 전용
 * 테이블 접두사 없음 (BMS와 다름)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Supabase 클라이언트 초기화 (service_role key → RLS 우회)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.error(`[Farm MCP Server] Started`);
console.error(`🔗 URL: ${process.env.SUPABASE_URL}`);

// MCP 도구 정의
const tools = {
  'farm_query': {
    description: '농장 DB 테이블에서 데이터 조회 (SELECT)',
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: '테이블명 (예: sales_records, farm_crops, other_incomes 등)'
        },
        select: {
          type: 'string',
          description: '조회할 칼럼 (기본값: *)'
        },
        filter: {
          type: 'object',
          description: '필터 조건 (단일)',
          properties: {
            column: { type: 'string' },
            operator: { type: 'string', description: 'eq, neq, gt, gte, lt, lte, like, ilike, is, in, contains' },
            value: {}
          }
        },
        filters: {
          type: 'array',
          description: '복수 필터 조건',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { type: 'string' },
              value: {}
            }
          }
        },
        limit: {
          type: 'number',
          description: '조회 제한 (기본값: 100)'
        },
        orderBy: {
          type: 'string',
          description: '정렬 기준 칼럼'
        },
        ascending: {
          type: 'boolean',
          description: '오름차순 (기본값: true)'
        }
      },
      required: ['table']
    }
  },
  'farm_insert': {
    description: '농장 DB 테이블에 데이터 삽입 (INSERT)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: '테이블명' },
        data: { type: 'object', description: '삽입할 데이터 (단일 행)' },
        rows: { type: 'array', description: '삽입할 데이터 (복수 행)', items: { type: 'object' } }
      },
      required: ['table']
    }
  },
  'farm_update': {
    description: '농장 DB 테이블 데이터 수정 (UPDATE)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: '테이블명' },
        id: { type: 'string', description: '수정할 레코드 ID (UUID)' },
        data: { type: 'object', description: '수정할 데이터' },
        filter: {
          type: 'object',
          description: 'ID 대신 필터 조건으로 수정 (column, operator, value)',
          properties: {
            column: { type: 'string' },
            operator: { type: 'string' },
            value: {}
          }
        }
      },
      required: ['table', 'data']
    }
  },
  'farm_delete': {
    description: '농장 DB 테이블 데이터 삭제 (DELETE)',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: '테이블명' },
        id: { type: 'string', description: '삭제할 레코드 ID (UUID)' }
      },
      required: ['table', 'id']
    }
  },
  'farm_execute_sql': {
    description: 'SQL 스크립트 직접 실행 (DDL: 테이블 생성/변경, 인덱스, RLS 등)',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: '실행할 SQL 문' }
      },
      required: ['sql']
    }
  },
  'farm_list_tables': {
    description: '현재 DB의 모든 테이블 목록 조회',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  'farm_describe_table': {
    description: '특정 테이블의 칼럼 구조 조회',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: '테이블명' }
      },
      required: ['table']
    }
  }
};

// 필터 적용 헬퍼
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

// 쿼리 핸들러
async function handleFarmQuery(table, select = '*', filter, filters, limit = 100, orderBy, ascending = true) {
  try {
    let query = supabase.from(table).select(select);

    if (filter) {
      query = applyFilter(query, filter);
    }
    if (filters && Array.isArray(filters)) {
      for (const f of filters) {
        query = applyFilter(query, f);
      }
    }
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
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
    const { data: result, error } = await supabase
      .from(table)
      .insert(insertData)
      .select();
    if (error) throw new Error(error.message);
    return { success: true, table, count: result?.length || 0, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmUpdate(table, id, data, filter) {
  try {
    let query = supabase.from(table).update(data);
    if (id) {
      query = query.eq('id', id);
    } else if (filter) {
      query = applyFilter(query, filter);
    } else {
      throw new Error('id 또는 filter 중 하나는 필수입니다');
    }
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

async function handleFarmExecuteSql(sql) {
  try {
    // Supabase REST API로 직접 SQL 실행
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      // RPC 함수가 없으면 pg_net 또는 Supabase SQL Editor 안내
      // PostgREST의 /sql 엔드포인트 시도 (Supabase v2+)
      const sqlResponse = await fetch(`${process.env.SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ query: sql })
      });

      if (!sqlResponse.ok) {
        throw new Error('execute_sql RPC 함수가 없습니다. Supabase Dashboard SQL Editor에서 다음 함수를 먼저 생성하세요:\n\nCREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)\nRETURNS JSON AS $$\nDECLARE result JSON;\nBEGIN\n  EXECUTE sql_query;\n  RETURN json_build_object(\'status\', \'success\');\nEND;\n$$ LANGUAGE plpgsql SECURITY DEFINER;');
      }

      const sqlResult = await sqlResponse.json();
      return { success: true, message: 'SQL executed via pg endpoint', data: sqlResult };
    }

    const data = await response.json();
    return { success: true, message: 'SQL executed successfully', data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmListTables() {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    });
    if (error) {
      // RPC 없으면 알려진 테이블 목록 반환
      return {
        success: true,
        message: 'Known tables (execute_sql RPC not available)',
        data: [
          'profiles', 'farms', 'farm_crops', 'workers', 'attendance_records',
          'partners', 'customers', 'sales_records', 'expenditures',
          'harvest_records', 'other_incomes', 'house_diaries'
        ]
      };
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleFarmDescribeTable(table) {
  try {
    // 1행만 가져와서 칼럼 구조 파악
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

// MCP 요청 처리
async function handleRequest(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'farm-supabase-mcp', version: '1.0.0' }
    });
  } else if (method === 'notifications/initialized') {
    // 초기화 완료 알림 - 응답 불필요
  } else if (method === 'tools/list') {
    sendResponse(id, {
      tools: Object.entries(tools).map(([name, schema]) => ({
        name,
        ...schema
      }))
    });
  } else if (method === 'tools/call') {
    const { name, arguments: args } = params;

    try {
      let result;

      if (name === 'farm_query') {
        result = await handleFarmQuery(args.table, args.select, args.filter, args.filters, args.limit, args.orderBy, args.ascending);
      } else if (name === 'farm_insert') {
        result = await handleFarmInsert(args.table, args.data, args.rows);
      } else if (name === 'farm_update') {
        result = await handleFarmUpdate(args.table, args.id, args.data, args.filter);
      } else if (name === 'farm_delete') {
        result = await handleFarmDelete(args.table, args.id);
      } else if (name === 'farm_execute_sql') {
        result = await handleFarmExecuteSql(args.sql);
      } else if (name === 'farm_list_tables') {
        result = await handleFarmListTables();
      } else if (name === 'farm_describe_table') {
        result = await handleFarmDescribeTable(args.table);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      sendResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      });
    } catch (error) {
      sendError(id, error.message);
    }
  } else if (id) {
    sendError(id, `Unknown method: ${method}`);
  }
}

// MCP JSON-RPC 응답
function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function sendError(id, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32603, message } });
  process.stdout.write(msg + '\n');
}

// stdin 읽기
const rl = readline.createInterface({
  input: process.stdin,
  output: undefined,
  terminal: false
});

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
