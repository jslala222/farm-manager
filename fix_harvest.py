with open('app/harvest/page.tsx', encoding='utf-8') as f:
    content = f.read()

old_state = """    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHouse, setEditHouse] = useState<number>(0);
    const [editGrade, setEditGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [editQuantity, setEditQuantity] = useState<number>(0);
    const [editDate, setEditDate] = useState(\"\");"""

new_state = """    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHouse, setEditHouse] = useState<number>(0);
    const [editGrade, setEditGrade] = useState<'sang' | 'jung' | 'ha'>('sang');
    const [editQuantity, setEditQuantity] = useState<number>(0);
    const [editDate, setEditDate] = useState(\"\");
    // 수확 기록 수정 팝업 모달
    const [harvestEditModal, setHarvestEditModal] = useState<HarvestRecord | null>(null);"""

content = content.replace(old_state, new_state)

# Change normal (non-editing) card to be clickable button opening modal
old_card = """                                    return (
                                        <div key={item.id} className="bg-white rounded-2xl border border-gray-50 p-2.5 px-4 shadow-sm flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="flex items-center gap-2 min-w-[60px]">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">House</span>
                                                    <span className="text-sm font-black text-gray-900">{item.house_number}</span>
                                                </div>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap ${gradeColor(item.grade)}`}>
                                                        {gradeLabel(item.grade)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-base font-black text-gray-900 tracking-tighter">{item.quantity}</span>
                                                        <span className="text-[9px] text-gray-400 font-black uppercase">Box</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-0.5 bg-gray-50/50 px-2.5 py-1.5 rounded-xl border border-gray-100/50">
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                                                        <CalendarDays className="w-2.5 h-2.5" />
                                                        {new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-900 font-black">
                                                        <Clock className="w-2.5 h-2.5 text-green-500" />
                                                        {new Date(item.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 ml-4">
                                                <button onClick={() => startEdit(item)} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit2 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    );"""

new_card = """                                    return (
                                        <button key={item.id}
                                            onClick={() => setHarvestEditModal(item)}
                                            className="w-full text-left bg-white rounded-2xl border border-gray-50 p-2.5 px-4 shadow-sm flex items-center justify-between animate-in slide-in-from-bottom-2 duration-300 active:scale-[0.98] hover:border-green-200 transition-all">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="flex items-center gap-2 min-w-[60px]">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">House</span>
                                                    <span className="text-sm font-black text-gray-900">{item.house_number}</span>
                                                </div>
                                                <div className="flex items-center gap-3 flex-1">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap ${gradeColor(item.grade)}`}>
                                                        {gradeLabel(item.grade)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-base font-black text-gray-900 tracking-tighter">{item.quantity}</span>
                                                        <span className="text-[9px] text-gray-400 font-black uppercase">Box</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-0.5 bg-gray-50/50 px-2.5 py-1.5 rounded-xl border border-gray-100/50">
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                                                        <CalendarDays className="w-2.5 h-2.5" />
                                                        {new Date(item.recorded_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-900 font-black">
                                                        <Clock className="w-2.5 h-2.5 text-green-500" />
                                                        {new Date(item.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <Edit2 className="w-3.5 h-3.5 text-gray-200 ml-4 shrink-0" />
                                        </button>
                                    );"""

content = content.replace(old_card, new_card)

print('harvestEditModal state:', 'harvestEditModal' in content)
print('button card:', 'onClick={() => setHarvestEditModal(item)' in content)

with open('app/harvest/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
