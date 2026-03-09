from pathlib import Path
import shutil

target = Path("app/inventory/page.tsx")
backup = target.with_suffix(".page.backup.tsx")

text = target.read_text(encoding="utf-8")
shutil.copy2(target, backup)

# 필요한 치환들
text = text.replace(
    'input_quantity: Number(r.input_quantity ?? r.raw_input_quantity ?? 0),',
    'input_quantity: Number(r.input_quantity ?? r.input_qty ?? r.raw_input_quantity ?? 0),'
)
text = text.replace('adjustment_type: "process_in"', 'adjustment_type: "correction"')
text = text.replace('adjustment_type: "process_out"', 'adjustment_type: "correction"')

target.write_text(text, encoding="utf-8")

print("OK patched:", target)
print("backup    :", backup)
