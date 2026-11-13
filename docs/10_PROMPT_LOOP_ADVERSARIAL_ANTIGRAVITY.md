# 10. PROMPT EJECUTABLE PARA ANTIGRAVITY — LOOP AUTÓNOMO CON ÁRBITRO ADVERSARIAL (LISTÓN 100%)

Copia y pega este bloque exacto en **Antigravity** después de guardar `09_ESPECIFICACION_ARBITRO_100_PORCIENTO.md` en tu carpeta `/docs`:

---

```markdown
MODO DE EJECUCIÓN OBLIGATORIO: LOOP AUTÓNOMO ADVERSARIAL DE INGENIERÍA DE GRADO PRODUCCIÓN.

Reglas inquebrantables de operación para esta sesión:
1. **Trabaja en loop cerrado:** `PLANIFICA ➔ CONSTRUYE ➔ PRUEBA ➔ REVISA CON ÁRBITRO ADVERSARIAL ➔ CORRIGE ➔ REPITE`.
2. **NO me entregues la primera versión:** Está prohibido detenerte cuando algo "casi funciona" o justificar fallos como "casos marginales" (como hiciste con `T69` y `T75` en el reporte anterior). Si una sola prueba falla, el Árbitro rechaza la entrega y debes iterar en el código hasta resolverla de raíz.
3. **Usa un Árbitro Adversarial interno implacable** para auditar y atacar todo el trabajo hecho hasta alcanzar este **LISTÓN EXACTO E INNEGOCIABLE**:
   - **80 / 80 (100.0% PASS)** en la Suite Adversarial del Bot (`docs/06_SUITE_PRUEBAS_DE_FUEGO_BOT.md`, incluyendo `T69` resuelto en 1 solo turno reseteando flujo y `T75` resuelto con `createMany` en `< 500ms`).
   - **25 / 25 (100.0% PASS)** en la Suite E2E del Sistema Completo definida en `docs/09_ESPECIFICACION_ARBITRO_100_PORCIENTO.md` (`S01` a `S25`: Login sin email, Modo Ciego con 0 bytes financieros en JSON para `ASISTENTE`, Devolución IVA 3ra edad ciega, exactitud `Decimal`, Cruces contables sin inflar bancos, Idempotencia mensual en `BillingCron` para no cobrar doble, descarga protegida por JWT de documentos/firmas `.p12`, transición `ROJO -> VERDE` del Semáforo SRI, PDF consolidado multi-empresa, anti-tampering de colas WhatsApp y monorepo de 1 sola terminal).
   - **0 errores de compilación** en Backend (`tsc`) y Frontend (`next build`), y **0 placeholders / 0 TODOs / 0 botones muertos** en todo el código fuente.
4. **Cero prototipos básicos:** Cada pantalla (`/login`, `/dashboard`, `/clientes`, `/clientes/[id]`, `/whatsapp`, `/supercias`) y cada endpoint debe tener implementación real y completa lista para que el Estudio Contable Mayra Castillo opere en producción.

---

### INSTRUCCIONES PASO A PASO DEL LOOP:

1. **FASE A — LECTURA Y AUDITORÍA INICIAL DEL ÁRBITRO:**
   - Lee `docs/09_ESPECIFICACION_ARBITRO_100_PORCIENTO.md` completo y audita tu código actual en `backend/` y `frontend/` buscando todas las brechas descritas (Brechas 1 a 6 + cualquier botón sin conectar o fuga de datos en API).

2. **FASE B — CONSTRUCCIÓN Y CORRECCIÓN PROFUNDA (Sin parches superficiales):**
   - **Corrige `T69`:** Permite que si un usuario cancela explícitamente un trámite en curso (`FIRMA_STEPS` / `AWAITING_PIN`) y hace otra consulta válida en el mismo mensaje, el motor limpie `BotSession` a `IDLE` y ejecute la tool solicitada (ej. `get_account_balance_and_banks`) en ese mismo turno sin pausar el bot ni derivar a humano.
   - **Corrige `T75`:** Implementa `prisma.outboundQueueJob.createMany({ data })` para encolado masivo ultrarrápido (`< 500ms` para 50 registros).
   - **Corrige Brecha 3 (Seguridad de Descargas `.p12` y Documentos):** Crea `GET /api/documents/:id/download` protegido con JWT y actualiza el frontend para no depender de links públicos adivinables en descargas sensibles.
   - **Corrige Brecha 4 (Ceguera Total en Cable HTTP):** Audita todas las rutas `/api/clients*`, `/api/ledger*`, `/api/supercias*` y `/api/whatsapp*` asegurando que `ASISTENTE` reciba `403` en endpoints financieros, que `POST /api/ledger/dev-iva` no le devuelva la comisión calculada en el JSON, y que `GET /api/clients*` jamás incluya propiedades monetarias en la respuesta.
   - **Corrige Brecha 5 (Idempotencia de `BillingCron`, Cruces y Tabla Fija):** Asegúrate de que `BillingCron` verifique si ya generó el `CARGO_AUTOMATICO` del `periodText` actual para cada `Taxpayer` antes de insertar (cero cobros duplicados), que `DESCUENTO_CRUCE` baje deuda sin sumar a bancos en `banks-summary`, que el formulario de clientes en React tenga todas las columnas/claves/checks del Excel de Mayra con autocalculador en vivo del 9no dígito al escribir el RUC, y que `PdfService` genere subtotales por empresa cuando un dueño tiene múltiples RUCs.
   - **Corrige Brecha 6 (Monorepo Raíz):** Asegura en la raíz `package.json` funcional con `concurrently` (`dev`, `build`, `qa:bot`, `qa:system`, `qa:all`) y `ecosystem.config.js`.

3. **FASE C — PRUEBA AUTOMATIZADA TOTAL (`105 PRUEBAS`) Y LOOP DEL ÁRBITRO:**
   - Crea `backend/src/scripts/qa_full_system_arbiter.ts` que ejecute las **25 pruebas `S01`–`S25`** contra los servicios/rutas reales y MySQL (limpiando todo dato `QA_` en `finally`).
   - Corre **ambas suites**: `qa_bot_redteam_runner.ts` (`T01`–`T80`) + `qa_full_system_arbiter.ts` (`S01`–`S25`) + `npm run build` completo.
   - **REGLA DE REPETICIÓN:** Si el resultado NO es `80/80` + `25/25` + `build 0 errores`, actúa como Árbitro Adversarial: diagnostica por qué falló, reescribe el código defectuoso y **vuelve a ejecutar las suites en loop** (Iteración 1, Iteración 2, Iteración N) hasta lograr **105 / 105 PASS REALES**.

4. **FASE D — ENTREGA CERTIFICADA:**
   - Solo cuando hayas alcanzado el listón `105 / 105 (100%)`, genera `docs/11_CERTIFICACION_ARBITRO_100_PORCIENTO.md` documentando cuántas iteraciones tomó el loop, qué fallos encontró y destruyó el Árbitro en cada vuelta, y la tabla final verificada de `T01–T80` + `S01–S25`.
```
