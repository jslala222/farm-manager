with open('app/courier/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

modal_start_str = '{/* 헤더 */}'
modal_end_str = '</div>\n                    </div>\n                )\n            }'

start_idx = content.find(modal_start_str)
end_idx = content.find(modal_end_str)

new_modal_content = '''{/* 헤더 */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-black text-slate-900">
                                        {isEditMode ? '내용 수정' : (
                                            <>{detailModal.customer_name || '미지정'}{detailModal.recipient_name && detailModal.recipient_name !== detailModal.customer_name ? ` → ${detailModal.recipient_name}` : ''}</>
                                        )}
                                    </h2>
                                    {!isEditMode && (
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                                            {detailModal.crop_name} {detailModal.quantity}{detailModal.sale_unit} · {formatCurrency(detailModal.price || 0)} · {detailModal.payment_method}
                                        </p>
                                    )}
                                </div>
                                <button onClick={() => { setDetailModal(null); setIsEditMode(false); }} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {isEditMode ? renderOrderForm(true) : (
                                <>
                                    {/* 정산 상태 토글 */}
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-2 ml-1">정산 상태</label>
                                        <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                            <button
                                                onClick={async () => {
                                                    await supabase.from('sales_records').update({ is_settled: true, payment_status: 'completed' }).eq('id', detailModal.id);
                                                    fetchHistory();
                                                    setDetailModal({ ...detailModal, is_settled: true, payment_status: 'completed' });
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${detailModal.is_settled ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-400'}`}>
                                                <CheckCircle className="w-4 h-4" /> 정산 완료
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    await supabase.from('sales_records').update({ is_settled: false, payment_status: 'pending' }).eq('id', detailModal.id);
                                                    fetchHistory();
                                                    setDetailModal({ ...detailModal, is_settled: false, payment_status: 'pending' });
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${!detailModal.is_settled ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400'}`}>
                                                <Clock className="w-4 h-4" /> 미정산 (외상)
                                            </button>
                                        </div>
                                    </div>

                                    {/* 버튼들 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => { handleDelete(detailModal.id); setDetailModal(null); }}
                                            className="py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-500 font-black text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95">
                                            <Trash2 className="w-4 h-4" /> 삭제
                                        </button>
                                        <button
                                            onClick={() => { handleEdit(detailModal); }}
                                            className="py-4 rounded-2xl bg-rose-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95">
                                            <Edit2 className="w-4 h-4" /> 내용 수정
                                        </button>
                                    </div>
                                </>
                            )}
                            
                            {isEditMode && (
                                <div className="flex gap-2 pt-1 border-t border-slate-100 mt-4">
                                    <button onClick={() => { setIsEditMode(false); handleResetAllStates(); }}
                                        className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm hover:bg-slate-200 transition-all">
                                        취소
                                    </button>
                                    <button onClick={() => { 
                                        if (confirm("정말 삭제하시겠습니까? 삭제하시면 되돌릴 수 없으니, 자세히 확인 후 삭제하기 바랍니다.")) {
                                            handleDelete(detailModal.id);
                                            setIsEditMode(false);
                                            setDetailModal(null);
                                        }
                                     }}
                                        className="flex-1 py-3 rounded-2xl bg-rose-50 text-rose-500 font-black text-sm hover:bg-rose-100 transition-all">
                                        삭제
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className={`flex-[1.5] py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${saving ? 'bg-indigo-400 cursor-not-allowed text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                                    >
                                        {saving ? (
                                            <>
                                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                                                저장 중
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" /> 저장하기
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        '''

content = content[:start_idx] + new_modal_content + content[end_idx:]

with open('app/courier/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
