import codecs
import re

file_path = r'c:\Users\User\Desktop\제미나이 3\연습\claude\projects_001\farm-manager\app\courier\page.tsx'

with codecs.open(file_path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add isEditMode state
content = content.replace(
    'const [isSameAsOrderer, setIsSameAsOrderer] = useState(true);',
    'const [isEditMode, setIsEditMode] = useState(false);\n    const [isSameAsOrderer, setIsSameAsOrderer] = useState(true);'
)

# 2. Remove the useEffect for automatic price calculation
useEffect_pattern = r"    // \[로직 추가\] 수량/단가 변경 시 총 상품 금액 자동 계산\r?\n    useEffect\(\(\) => \{.*?\}, \[quantity, unitPrice\]\);\r?\n"
content = re.sub(useEffect_pattern, '', content, flags=re.DOTALL)

# 3. Update handleEdit
content = content.replace(
    '        setEditingRecordId(record.id);',
    '        setEditingRecordId(record.id);\n        setIsEditMode(true);'
)

# Update the button that calls handleEdit to not scroll
content = content.replace(
    "onClick={() => { handleEdit(detailModal); setDetailModal(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}",
    "onClick={() => { handleEdit(detailModal); }}"
)

# 4. Update handleSave to close modal and reset mode
content = content.replace(
    '''            handleResetAllStates();
            setTimeout(() => fetchHistory(), 200);''',
    '''            handleResetAllStates();
            setIsEditMode(false);
            setDetailModal(null);
            setTimeout(() => fetchHistory(), 200);'''
)

# 5. Extract the form into a function
# find the start of the form
form_start_idx = content.find('<div className="relative bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-4">')

# find the end of the form (after the save button)
form_end_str = '''                            <button onClick={handleSave} disabled={saving}
                                className="w-full py-5 rounded-[1.25rem] text-lg font-black text-white bg-rose-600 shadow-2xl shadow-rose-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : 'B2C 택배 기록 저장'}</span></>}
                            </button>
                        </div>'''
form_end_idx = content.find(form_end_str) + len(form_end_str)

extracted_form = content[form_start_idx:form_end_idx]

# Replace inputs with new logic
extracted_form = extracted_form.replace(
    '''onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}''',
    '''onChange={(e) => {
                                                const rawQ = e.target.value.replace(/[^0-9]/g, '');
                                                setQuantity(rawQ);
                                                const q = Number(rawQ) || 0;
                                                const p = Number(unitPrice) || 0;
                                                if (q > 0 && p > 0) setCourierTotalPrice((q * p).toString());
                                                else setCourierTotalPrice("");
                                            }}'''
)

extracted_form = extracted_form.replace(
    '''onChange={(e) => setUnitPrice(stripNonDigits(e.target.value))}''',
    '''onChange={(e) => {
                                                const rawP = stripNonDigits(e.target.value);
                                                setUnitPrice(rawP);
                                                const q = Number(quantity) || 0;
                                                const p = Number(rawP) || 0;
                                                if (q > 0 && p > 0) setCourierTotalPrice((q * p).toString());
                                                else setCourierTotalPrice("");
                                            }}'''
)

extracted_form = extracted_form.replace(
    '''onChange={(e) => setCourierTotalPrice(stripNonDigits(e.target.value))}''',
    '''onChange={(e) => {
                                                const rawT = stripNonDigits(e.target.value);
                                                setCourierTotalPrice(rawT);
                                                const q = Number(quantity) || 0;
                                                const t = Number(rawT) || 0;
                                                if (q > 0) setUnitPrice(Math.floor(t / q).toString());
                                            }}'''
)

# wrap in function
render_form_func = f'''    const renderOrderForm = (inModal = false) => (
        <div className={{`relative bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-4 ${{inModal ? 'max-h-[60vh] overflow-y-auto w-[calc(100%+2rem)] -mx-4 px-4 scrollbar-hide' : ''}}`}}>
{extracted_form[extracted_form.find('<div className="flex gap-2">'):-len('</div>')]}
            {{!inModal && (
                <button onClick={{handleSave}} disabled={{saving}}
                    className="w-full py-5 rounded-[1.25rem] text-lg font-black text-white bg-rose-600 shadow-2xl shadow-rose-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    {{saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{{editingRecordId ? '수정 내용 저장' : 'B2C 택배 기록 저장'}}</span></>}}
                </button>
            )}}
        </div>
    );
'''

# insert render function before return
return_idx = content.find('    return (')
content = content[:return_idx] + render_form_func + '\n' + content[return_idx:]

# replace original form in JSX with call
content = content.replace(content[content.find(extracted_form):content.find(extracted_form)+len(extracted_form)], '{renderOrderForm(false)}')

# 6. Update modal
modal_content_start = content.find('{/* 헤더 */}')
modal_content_end = content.find('</div>\n                    </div>\n                )\n            }')

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
                                        className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">
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
                                        삭제하기
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className={`flex-[1.5] py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
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

content = content[:modal_content_start] + new_modal_content + content[modal_content_end:]

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(content)
print("done")
