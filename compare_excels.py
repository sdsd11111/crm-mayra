import openpyxl, re, difflib, json

wb_oficina = openpyxl.load_workbook(r'docs\CLIENTES OFICINA NUEVO.xlsx', data_only=True)
ws_oficina = wb_oficina['LISTADO CLIENTES ']

wb_cartera = openpyxl.load_workbook(r'docs\CARTERA CLIENTES.xlsx', data_only=True)
non_client_sheets = {'ARCHIVO', 'CONSOLIDADO CXC', 'HOJA1', 'HOJA2'}
cartera_sheets = [s.strip() for s in wb_cartera.sheetnames if s.strip().upper() not in non_client_sheets]

oficina_clients = []
for row in range(3, ws_oficina.max_row + 1):
    name = ws_oficina.cell(row=row, column=2).value
    ruc = ws_oficina.cell(row=row, column=4).value
    fee = ws_oficina.cell(row=row, column=6).value
    anexo = ws_oficina.cell(row=row, column=7).value
    iva = ws_oficina.cell(row=row, column=8).value
    if name or ruc:
        oficina_clients.append({
            'row': row,
            'name': str(name).strip() if name else '',
            'ruc': str(ruc).strip() if ruc else '',
            'fee': str(fee) if fee is not None else '',
            'anexo': str(anexo) if anexo is not None else '',
            'iva': str(iva) if iva is not None else ''
        })

def norm(t):
    if not t: return ''
    t = t.upper()
    for a, b in [('Á','A'),('É','E'),('Í','I'),('Ó','O'),('Ú','U'),('Ñ','N')]:
        t = t.replace(a, b)
    return re.sub(r'[^A-Z0-9]', '', t)

matched = []
unmatched_cartera = []

for cs in cartera_sheets:
    cs_norm = norm(cs)
    best_match = None
    best_ratio = 0
    for oc in oficina_clients:
        oc_norm = norm(oc['name'])
        if cs_norm == oc_norm:
            best_match = oc
            best_ratio = 1.0
            break
        elif cs_norm in oc_norm or oc_norm in cs_norm:
            best_match = oc
            best_ratio = 0.95
            break
        else:
            ratio = difflib.SequenceMatcher(None, cs_norm, oc_norm).ratio()
            if ratio > best_ratio and ratio >= 0.65:
                best_ratio = ratio
                best_match = oc
    if best_match:
        matched.append({
            'cartera_sheet': cs,
            'oficina_name': best_match['name'],
            'ruc': best_match['ruc'],
            'score': round(best_ratio, 2)
        })
    else:
        unmatched_cartera.append(cs)

matched_oficina_names = {m['oficina_name'] for m in matched}
unmatched_oficina = [oc for oc in oficina_clients if oc['name'] not in matched_oficina_names]

# Analicemos la hoja ARCHIVO de CARTERA CLIENTES
ws_archivo = wb_cartera['ARCHIVO']
archivo_clients = []
for r in range(10, ws_archivo.max_row + 1):
    c_nom = ws_archivo.cell(row=r, column=2).value
    c_tel = ws_archivo.cell(row=r, column=3).value
    c_ruc = ws_archivo.cell(row=r, column=4).value
    if c_nom or c_ruc:
        archivo_clients.append({
            'nombre': str(c_nom).strip() if c_nom else '',
            'telefono': str(c_tel).strip() if c_tel else '',
            'ruc': str(c_ruc).strip() if c_ruc else ''
        })

result = {
    'total_oficina_listado': len(oficina_clients),
    'total_cartera_sheets': len(cartera_sheets),
    'total_archivo_rows': len(archivo_clients),
    'matched_count': len(matched),
    'unmatched_cartera_count': len(unmatched_cartera),
    'unmatched_oficina_count': len(unmatched_oficina),
    'unmatched_cartera': unmatched_cartera,
    'matched_sample': matched[:25],
    'unmatched_oficina_sample': [{'name': x['name'], 'ruc': x['ruc']} for x in unmatched_oficina[:20]]
}

with open(r'scratch_compare_result.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print("COMPARE DONE")

