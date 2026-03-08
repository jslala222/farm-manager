'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { CheckCircle2, X, RefreshCw } from 'lucide-react';

interface HarvestRecord {
  id: string;
  crop_name: string;
  recorded_at: string;
  quantity: number;
  house_number: string;
  grade: 'sang' | 'jung' | 'ha';
}

interface InspectionForm {
  final_grade: 'sang' | 'jung' | 'ha';
  final_quantity: number;
  processing_type: string;
  warehouse_location: string;
  notes: string;
}

// UTC → KST 날짜 변환 (YYYY-MM-DD)
const toKSTDateStr = (utcISO: string): string => {
  const d = new Date(new Date(utcISO).getTime() + 9 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
};

export default function InspectionPage() {
  const { farm, initialized } = useAuthStore();
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<HarvestRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<InspectionForm>({
    final_grade: 'jung',
    final_quantity: 0,
    processing_type: '',
    warehouse_location: '',
    notes: ''
  });

  // 데이터 조회 함수
  const fetchData = async () => {
    if (!farm?.id) return;
    try {
      setLoading(true);
      setError('');
      
      const { data, error: recordsErr } = await supabase
        .from('harvest_records')
        .select('*')
        .eq('farm_id', farm.id)
        .order('recorded_at', { ascending: false })
        .limit(500);
      
      if (recordsErr) {
        setError(`조회 실패: ${recordsErr.message}`);
        console.error(recordsErr);
        return;
      }
      
      if (!data || data.length === 0) {
        setError('수확 기록이 없습니다');
        return;
      }
      
      setRecords(data);
    } catch (err) {
      setError(`오류: ${String(err)}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized && farm?.id) fetchData();
  }, [farm, initialized]);

  const openInspection = (record: HarvestRecord) => {
    setSelectedRecord(record);
    setForm({
      final_grade: record.grade,
      final_quantity: record.quantity,
      processing_type: '',
      warehouse_location: '',
      notes: ''
    });
  };

  const saveInspection = async () => {
    if (!selectedRecord || !farm?.id) return;

    try {
      setSaving(true);
      
      const { error: err } = await supabase
        .from('harvest_inspections')
        .insert({
          harvest_id: selectedRecord.id,
          farm_id: farm.id,
          grade: form.final_grade,
          quantity: form.final_quantity,
          unit: 'BOX',
          processing_type: form.processing_type,
          warehouse_location: form.warehouse_location,
          created_at: new Date().toISOString()
        });

      if (err) {
        setError(`검수 저장 실패: ${err.message}`);
        return;
      }

      alert('검수가 저장되었습니다');
      setSelectedRecord(null);
      fetchData(); // 데이터 새로고침
    } catch (err) {
      setError(`오류: ${String(err)}`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h1 className="text-2xl font-bold">선별/검수</h1>
            </div>
            <button 
              onClick={() => fetchData()}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white rounded flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button 
              onClick={() => setError('')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              닫기
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">수확 기록이 없습니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-left text-sm font-bold">날짜</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">품목</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">동</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">등급</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">수량</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">검수</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{r.recorded_at ? toKSTDateStr(r.recorded_at) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold">{r.crop_name}</td>
                    <td className="px-4 py-3 text-sm">{r.house_number || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        r.grade === 'sang' ? 'bg-red-100 text-red-700' :
                        r.grade === 'jung' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {r.grade === 'sang' ? '특/상' : r.grade === 'jung' ? '중' : '하'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{r.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => openInspection(r)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        검수
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600 border-t">
              총 {records.length}건
            </div>
          </div>
        )}
      </div>

      {/* 검수 모달 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">검수 정보 입력</h2>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
              <p><strong>품목:</strong> {selectedRecord.crop_name}</p>
              <p><strong>원래 수량:</strong> {selectedRecord.quantity} BOX</p>
              <p><strong>원래 등급:</strong> {selectedRecord.grade === 'sang' ? '특/상' : selectedRecord.grade === 'jung' ? '중' : '하'}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">최종 등급 *</label>
                <select 
                  value={form.final_grade}
                  onChange={(e) => setForm({...form, final_grade: e.target.value as 'sang' | 'jung' | 'ha'})}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="sang">특/상</option>
                  <option value="jung">중</option>
                  <option value="ha">하</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">최종 수량 (BOX) *</label>
                <input 
                  type="number"
                  value={form.final_quantity}
                  onChange={(e) => setForm({...form, final_quantity: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">가공 방식</label>
                <select 
                  value={form.processing_type}
                  onChange={(e) => setForm({...form, processing_type: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">선택</option>
                  <option value="fresh">신선</option>
                  <option value="frozen">냉동</option>
                  <option value="dried">건조</option>
                  <option value="jam">잼</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">창고 위치</label>
                <input 
                  type="text"
                  placeholder="예: A-1-3"
                  value={form.warehouse_location}
                  onChange={(e) => setForm({...form, warehouse_location: e.target.value})}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">비고</label>
                <textarea 
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded text-sm"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setSelectedRecord(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                취소
              </button>
              <button 
                onClick={saveInspection}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
