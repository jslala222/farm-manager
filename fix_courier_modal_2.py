import codecs

with open('app/courier/page.tsx', 'r', 'utf-8') as f:
    lines = f.readlines()

# Extract lines 257 to 440 (0-indexed) which corresponds to lines 258 to 441 in file
form_lines = lines[257:441]

# Combine into a string
form_str = ''.join(form_lines)

# Apply input changes
quantity_old = '''onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ''))}'''
quantity_new = '''onChange={(e) => {
                                                const rawQ = e.target.value.replace(/[^0-9]/g, '');
                                                setQuantity(rawQ);
                                                const q = Number(rawQ) || 0;
                                                const p = Number(unitPrice) || 0;
                                                if (q > 0 && p > 0) setCourierTotalPrice((q * p).toString());
                                                else setCourierTotalPrice("");
                                            }}'''

unitprice_old = '''onChange={(e) => setUnitPrice(stripNonDigits(e.target.value))}'''
unitprice_new = '''onChange={(e) => {
                                                const rawP = stripNonDigits(e.target.value);
                                                setUnitPrice(rawP);
                                                const q = Number(quantity) || 0;
                                                const p = Number(rawP) || 0;
                                                if (q > 0 && p > 0) setCourierTotalPrice((q * p).toString());
                                                else setCourierTotalPrice("");
                                            }}'''
unitprice_str_target = '''onChange={(e) => setUnitPrice(stripNonDigits(e.target.value))}\n                                                className="w-full bg-transparent text-xl font-black text-center outline-none text-slate-700"'''

totalprice_old = '''onChange={(e) => setCourierTotalPrice(stripNonDigits(e.target.value))}'''
totalprice_new = '''onChange={(e) => {
                                                const rawT = stripNonDigits(e.target.value);
                                                setCourierTotalPrice(rawT);
                                                const q = Number(quantity) || 0;
                                                const t = Number(rawT) || 0;
                                                if (q > 0) setUnitPrice(Math.floor(t / q).toString());
                                            }}'''
totalprice_target = '''onChange={(e) => setCourierTotalPrice(stripNonDigits(e.target.value))}\n                                            className="w-full bg-transparent text-3xl font-black text-center text-emerald-600 outline-none"'''

form_str = form_str.replace(quantity_old, quantity_new)
form_str = form_str.replace(unitprice_old, unitprice_new)
form_str = form_str.replace(totalprice_old, totalprice_new)

# Modify the top wrapper div
form_str = form_str.replace('<div className="relative bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-4">', 
'<div className={`relative bg-white/80 backdrop-blur-md p-3 rounded-3xl border border-white shadow-sm space-y-4 ${inModal ? \'max-h-[60vh] overflow-y-auto scrollbar-hide\' : \'\'}`}>')

# Modify the bottom button
btn_old = '''                            <button onClick={handleSave} disabled={saving}
                                className="w-full py-5 rounded-[1.25rem] text-lg font-black text-white bg-rose-600 shadow-2xl shadow-rose-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : 'B2C 택배 기록 저장'}</span></>}
                            </button>'''

btn_new = '''                            {!inModal && (
                                <button onClick={handleSave} disabled={saving}
                                    className="w-full py-5 rounded-[1.25rem] text-lg font-black text-white bg-rose-600 shadow-2xl shadow-rose-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                                    {saving ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <><Save className="w-5 h-5" /> <span>{editingRecordId ? '수정 내용 저장' : 'B2C 택배 기록 저장'}</span></>}
                                </button>
                            )}'''
form_str = form_str.replace(btn_old, btn_new)

render_form_func = '    const renderOrderForm = (inModal = false) => (\n' + form_str + '    );\n\n'

# Insert render_form_func at line 223 (before `return (`)
lines.insert(223, render_form_func)

# We added 1 item to `lines` array. So the previous form block is now from `258:442` (inclusive length is 184).
lines[258:442] = ['                    {!isEditMode && renderOrderForm(false)}\n']

with open('app/courier/page.tsx', 'w', 'utf-8') as f:
    f.writelines(lines)
