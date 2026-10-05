# Calefacción y ACS

Aplicación para registrar lecturas comunitarias de calefacción, refrigeración y agua, añadir facturas y cerrar periodos comparando:

- **Entrada real:** importe realmente cobrado con las tarifas y cuotas configuradas para los vecinos.
- **Entrada calculada:** reparto que cubre las facturas y los costes fijos, ajustando automáticamente el precio térmico para que el saldo sea cero.

Los conceptos fijos se pueden crear, editar, retirar y dividir en subconceptos. Cada regla tiene vigencia, periodicidad diaria/mensual/anual, IVA, coste para la comunidad e importe opcional facturado a cada vivienda. Los cambios de regla dentro de un periodo se prorratean día a día. El intervalo facturable es `> inicio` y `<= fin`, sin ajuste manual de días, y la tarifa calculada común de calefacción/frío nunca es editable.

## Arquitectura

- React + TypeScript + Vite.
- Cloudflare Worker para la API y los recursos estáticos.
- Cloudflare D1 para viviendas, lecturas, tipos de factura, facturas, conceptos fijos y periodos.
- Ruta de producción: `https://danieta.com/calefaccionacs`.

## Desarrollo local

Requiere Node.js 22 o posterior.

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

La aplicación queda disponible en `http://localhost:5173/calefaccionacs/`. Para exigir PIN también en local, copia `.dev.vars.example` como `.dev.vars` y cambia `APP_PIN`.

## Verificación

```bash
npm test
npm run build
```

Las pruebas comprueban el cierre de invierno contra el Excel y la conciliación a cero. GitHub Actions ejecuta pruebas y build en cada `push` y cada pull request.

## Cloudflare

1. Autenticar Wrangler: `npx wrangler login`.
2. Crear D1 en Europa: `npx wrangler d1 create calefaccion-acs --location=weur`.
3. Sustituir el `database_id` provisional de `wrangler.jsonc` por el UUID devuelto.
4. Aplicar datos:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

5. Guardar el PIN de la aplicación: `npx wrangler secret put APP_PIN`.
6. Publicar: `npm run deploy`.

La ruta `danieta.com/calefaccionacs*` ya está declarada. El dominio debe estar en la misma cuenta de Cloudflare.

Para despliegue automático desde GitHub, define los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, crea la variable `CLOUDFLARE_DEPLOY_ENABLED=true` y ejecuta manualmente el workflow **Deploy Cloudflare** una primera vez.

## Datos del Excel

`data/seed.sql` contiene la instantánea inicial importada: 79 viviendas, 10 fechas de lectura, 2 periodos y 15 facturas. Para regenerarla desde el libro original:

```bash
python -m pip install -r tools/requirements.txt
python tools/generate_seed.py "ruta/al/archivo.xlsx" data/seed.sql
```

El archivo Excel original no se guarda en el repositorio.
