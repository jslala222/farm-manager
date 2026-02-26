import re

with open('app/courier/page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('{/* ===== 택배 기록 상세/수정 팝업 모달 =====')
if idx != -1:
    before = text[:idx]
    after = text[idx:]
    
    modal_match = re.search(r'(<div className="fixed inset-0 z-\[100\].*?</div>\s*</div>\s*</div>)', after, re.DOTALL)
    if modal_match:
        modal_content = modal_match.group(1)
        
        # We need to wrap the component return in <> </> so we can put modal at the end securely.
        return_idx = before.rfind('return (')
        
        if return_idx != -1:
            new_before = before[:return_idx + 8] + '\n        <>\n' + before[return_idx + 8:]
            
            # The original file had a stray `</div >` at the end on line 547.
            # We don't include it. We just append our modal and `</>\n  );\n}\n`
            
            # remove trailing whitespace and any trailing </div> or ); } from `new_before`?
            # Actually, `before` ends at `{/* =====`.
            # If `before` ends with perfectly matched divs for the main layout, then wrapping with `<>` works.
            # Let's clean up exactly.
            
            clean_end = f'''        {{/* ===== 택배 기록 상세/수정 팝업 모달 ===== */}}
        {{detailModal && (
{modal_content}
        )}}
        </>
    );
}}
'''
            with open('app/courier/page.tsx', 'w', encoding='utf-8') as f:
                f.write(new_before + clean_end)
            print('Fixed courier page JSX.')
        else:
            print("Could not find 'return ('")
    else:
        print("Could not match modal content")
else:
    print("Could not find modal comment")
