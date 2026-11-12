with open(r'frontend\src\app\clientes\[id]\page.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Busquemos el inicio del primer '{/* Modal para Agregar Nueva Empresa / RUC */}'
marker = '{/* Modal para Agregar Nueva Empresa / RUC */}'
idx = text.find(marker)

if idx != -1:
    before = text[:idx]
    # Buscar el cierre de upload modal antes de este marker
    # Asegurémonos que before termina cerrando el upload modal
    modal_code = '''{/* Modal para Agregar Nueva Empresa / RUC */}
      {isAddTaxpayerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative border border-gray-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddTaxpayerOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>

            <form onSubmit={handleCreateTaxpayer} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#1E2A3C] flex items-center gap-2">
                  <Building2 className="text-[#166BA3]" size={18} />
                  Agregar Razón Social / RUC a {client.fullName}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Registra otra empresa o actividad económica que pertenezca a este mismo cliente.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Razón Social / Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={newTaxRazonSocial}
                  onChange={(e) => setNewTaxRazonSocial(e.target.value)}
                  placeholder="Ej. Comercializadora del Sur S.A.S."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    RUC (13 dígitos) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    value={newTaxRuc}
                    onChange={(e) => setNewTaxRuc(e.target.value)}
                    placeholder="1191796812001"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Régimen Tributario
                  </label>
                  <select
                    value={newTaxRegimen}
                    onChange={(e) => setNewTaxRegimen(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  >
                    <option value="MENSUAL">Mensual (General / RIMPE)</option>
                    <option value="SEMESTRAL">Semestral (RIMPE Negocio Popular)</option>
                    <option value="ANUAL">Anual (Renta)</option>
                    <option value="COMPANIA_SUPERCIAS">Sociedad / Supercias</option>
                    <option value="DEVOLUCION_IVA_3RA_EDAD">Devolución IVA 3ra Edad</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Clave SRI
                  </label>
                  <input
                    type="text"
                    value={newTaxClaveSri}
                    onChange={(e) => setNewTaxClaveSri(e.target.value)}
                    placeholder="Clave portal SRI..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Clave Firma (.p12)
                  </label>
                  <input
                    type="text"
                    value={newTaxClaveFirma}
                    onChange={(e) => setNewTaxClaveFirma(e.target.value)}
                    placeholder="Contraseña de firma..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Clave IESS Patronal
                  </label>
                  <input
                    type="text"
                    value={newTaxClaveIess}
                    onChange={(e) => setNewTaxClaveIess(e.target.value)}
                    placeholder="Clave IESS..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                  />
                </div>
                {!isAssistant && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Honorario Mensual ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newTaxAmount}
                      onChange={(e) => setNewTaxAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono text-[#1E2A3C] focus:ring-1 focus:ring-[#166BA3] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddTaxpayerOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTaxpayer}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#166BA3] text-white hover:bg-[#135887] shadow-xs disabled:opacity-50"
                >
                  {savingTaxpayer ? 'Guardando...' : 'Guardar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClienteDetallePage() {
  return (
    <AuthProvider>
      <ClienteDetalleView />
    </AuthProvider>
  );
}
'''
    with open(r'frontend\src\app\clientes\[id]\page.tsx', 'w', encoding='utf-8') as f:
        f.write(before + modal_code)
    print("DONE OK")

