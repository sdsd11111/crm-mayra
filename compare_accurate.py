import openpyxl, re, difflib, json

wb_oficina = openpyxl.load_workbook(r'docs\CLIENTES OFICINA NUEVO.xlsx', data_only=True)
ws_oficina = wb_oficina['LISTADO CLIENTES ']

wb_cartera = openpyxl.load_workbook(r'docs\CARTERA CLIENTES.xlsx', data_only=True)
non_client_sheets = {'ARCHIVO', 'CONSOLIDADO CXC', 'HOJA1', 'HOJA2'}
cartera_sheets = [s.strip() for s in wb_cartera.sheetnames if s.strip().upper() not in non_client_sheets]

def clean_txt(t):
    if not t: return ''
    t = str(t).upper().strip()
    for a, b in [('Á','A'),('É','E'),('Í','I'),('Ó','O'),('Ú','U'),('Ñ','N')]:
        t = t.replace(a, b)
    return re.sub(r'[^A-Z0-9]', '', t)

def get_tokens(t):
    if not t: return set()
    t = str(t).upper().strip()
    for a, b in [('Á','A'),('É','E'),('Í','I'),('Ó','O'),('Ú','U'),('Ñ','N')]:
        t = t.replace(a, b)
    t = re.sub(r'[^A-Z0-9\s]', ' ', t)
    return set(t.split())

oficina_clients = []
for r in range(3, ws_oficina.max_row + 1):
    num = ws_oficina.cell(row=r, column=1).value
    name = ws_oficina.cell(row=r, column=2).value
    ruc = ws_oficina.cell(row=r, column=4).value
    clave_sri = ws_oficina.cell(row=r, column=5).value
    fee = ws_oficina.cell(row=r, column=6).value
    anexo = ws_oficina.cell(row=r, column=7).value
    iva = ws_oficina.cell(row=r, column=8).value
    firma = ws_oficina.cell(row=r, column=9).value
    salar = ws_oficina.cell(row=r, column=10).value
    sut = ws_oficina.cell(row=r, column=11).value
    iess = ws_oficina.cell(row=r, column=12).value

    # Ignorar filas sin nombre real o filas decorativas
    if not name or str(name).strip().startswith('---'):
        continue
    name_str = str(name).strip()
    if len(name_str) < 3 or name_str == 'None':
        continue
    ruc_str = str(ruc).strip() if ruc and str(ruc).strip() != 'None' else ''
    
    oficina_clients.append({
        'row': r,
        'index': num,
        'name': name_str,
        'ruc': ruc_str,
        'clave_sri': str(clave_sri).strip() if clave_sri else '',
        'fee': fee,
        'anexo': anexo,
        'iva': iva,
        'firma': str(firma).strip() if firma else '',
        'salar': str(salar).strip() if salar else '',
        'sut': str(sut).strip() if sut else '',
        'iess': str(iess).strip() if iess else ''
    })

# Cruce con hojas de Cartera
matched = []
unmatched_cartera = []

for cs in cartera_sheets:
    cs_clean = clean_txt(cs)
    cs_tokens = get_tokens(cs)
    
    best_oc = None
    best_score = 0.0
    best_reason = ''
    
    for oc in oficina_clients:
        oc_clean = clean_txt(oc['name'])
        oc_tokens = get_tokens(oc['name'])
        
        # 1. Coincidencia exacta o contenida
        if cs_clean == oc_clean:
            best_oc = oc
            best_score = 1.0
            best_reason = 'EXACTO'
            break
        
        # 2. Todos los tokens de la hoja están contenidos en el cliente oficina
        if cs_tokens and cs_tokens.issubset(oc_tokens):
            score = len(cs_tokens) / max(len(oc_tokens), 1)
            if score > best_score:
                best_score = score
                best_oc = oc
                best_reason = 'SUBSET_TOKENS'
        
        # 3. Intersección de tokens significativa (al menos 2 palabras clave, ej. "DAVID MARTINEZ")
        common = cs_tokens.intersection(oc_tokens)
        # eliminar palabras comunes insignificantes
        stop_words = {'DE', 'DEL', 'LA', 'EL', 'Y', 'LOS', 'LAS', 'SAS', 'CIA', 'LTDA', 'SA', 'SR', 'SRA'}
        sig_common = common - stop_words
        if len(sig_common) >= 2:
            score = 0.85
            if score > best_score:
                best_score = score
                best_oc = oc
                best_reason = f'COMMON_WORDS: {", ".join(sig_common)}'
        elif len(sig_common) == 1 and len(cs_tokens - stop_words) == 1:
            # Una sola palabra única muy específica (ej. "GRANYUR", "PADFIT", "PASCALTECH")
            single_word = list(sig_common)[0]
            if len(single_word) >= 5:
                score = 0.80
                if score > best_score:
                    best_score = score
                    best_oc = oc
                    best_reason = f'UNIQUE_WORD: {single_word}'
    
    if best_oc and best_score >= 0.70:
        matched.append({
            'cartera_sheet': cs,
            'oficina_name': best_oc['name'],
            'ruc': best_oc['ruc'],
            'reason': best_reason,
            'score': round(best_score, 2)
        })
    else:
        unmatched_cartera.append(cs)

matched_oficina_names = {m['oficina_name'] for m in matched}
unmatched_oficina = [oc for oc in oficina_clients if oc['name'] not in matched_oficina_names]

report = {
    'total_oficina_valid_clients': len(oficina_clients),
    'total_cartera_sheets': len(cartera_sheets),
    'matched_count': len(matched),
    'unmatched_cartera_count': len(unmatched_cartera),
    'unmatched_oficina_count': len(unmatched_oficina),
    'matched': matched,
    'unmatched_cartera': unmatched_cartera,
    'unmatched_oficina': [{'row': x['row'], 'name': x['name'], 'ruc': x['ruc'], 'fee': x['fee']} for x in unmatched_oficina]
}

with open(r'scratch_compare_accurate.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"RESUMEN FINAL: {len(oficina_clients)} en Oficina | {len(cartera_sheets)} hojas en Cartera")
print(f"CRUZADOS CON ÉXITO: {len(matched)}")
print(f"CARTERA SIN CRUCE DIRECTO: {len(unmatched_cartera)}")
print(f"OFICINA SIN HOJA CARTERA: {len(unmatched_oficina)}")

