import type { Tab } from "../navigation";

type Props = { onNavigate: (tab: Tab) => void };

export function HelpView({ onNavigate }: Props) {
  return <section className="help-view">
    <header className="page-header help-header"><div><p className="eyebrow">Ayuda para usuarios</p><h1>Guía de uso</h1><p>Un recorrido completo para preparar lecturas y costes, revisar el cálculo y cerrar un periodo con seguridad.</p></div></header>

    <div className="help-intro">
      <div><span className="help-kicker">La idea principal</span><h2>La plataforma compara lo cobrado con lo que realmente costó el servicio</h2><p>Para cada vivienda calcula el consumo entre dos lecturas y le aplica dos juegos de precios: los precios que se cobraron durante el periodo y los precios calculados para cubrir los costes reales. La diferencia indica si se cobró de más o de menos.</p></div>
      <aside><strong>Antes de cerrar un periodo</strong><p>Comprueba que existen lecturas completas al inicio y al final, que las facturas están registradas y que los conceptos fijos tienen precio durante todas las fechas.</p></aside>
    </div>

    <nav className="help-index" aria-label="Contenido de la guía"><a href="#primeros-pasos">Por dónde empezar</a><a href="#conceptos-fijos">Conceptos fijos</a><a href="#fijo-cobrado">Fijo realmente cobrado</a><a href="#lecturas">Lecturas</a><a href="#importar">Importar PDF o CSV</a><a href="#resumen">Resumen del periodo</a></nav>

    <article className="help-section" id="primeros-pasos">
      <HelpHeading number="1" eyebrow="Flujo recomendado" title="Por dónde empezar" />
      <p>No es necesario seguir siempre el mismo orden, pero este recorrido evita que falten datos cuando se consulte el resumen:</p>
      <ol className="help-steps"><li><b>Configura los conceptos fijos.</b><span>Revisa los gastos habituales de la comunidad, sus importes, el IVA y desde cuándo están vigentes.</span></li><li><b>Registra lo que se cobra de fijo.</b><span>Introduce el precio diario cobrado a cada vivienda o impórtalo desde el CSV de facturación.</span></li><li><b>Carga las lecturas.</b><span>Puedes importarlas juntas desde PDF o CSV, o escribirlas a mano en las vistas de Calefacción, Agua y Frío.</span></li><li><b>Añade las facturas.</b><span>Registra cada factura con su fecha e importe para que entre en el periodo correcto.</span></li><li><b>Revisa el periodo y las tarifas.</b><span>Comprueba las fechas y los precios que se cobraron por calefacción, frío y agua.</span></li><li><b>Abre el resumen.</b><span>Atiende primero a los avisos y después compara los importes cobrados y calculados.</span></li></ol>
      <HelpActions><button className="secondary" onClick={() => onNavigate("summary")}>Ir al resumen</button></HelpActions>
    </article>

    <article className="help-section" id="conceptos-fijos">
      <HelpHeading number="2" eyebrow="Costes habituales" title="Conceptos fijos" />
      <p>Esta sección recoge gastos que se repiten con el tiempo, por ejemplo administración, mantenimiento u otros servicios comunitarios. Aquí se describe <b>lo que le cuesta a la comunidad</b>; no lo que se ha cobrado a cada vecino.</p>
      <div className="help-grid"><HelpCard title="Concepto principal y subconceptos">Un gasto sencillo puede tener un único importe. Si necesita detalle, puede dividirse en subconceptos y guardar el importe de cada uno por separado. En el histórico se conserva cada cambio.</HelpCard><HelpCard title="Importe, periodicidad e IVA">Indica si el importe es diario, mensual o anual y añade el IVA correspondiente. La plataforma convierte ese importe en coste diario y lo reparte correctamente por los días de vigencia.</HelpCard><HelpCard title="Desde y hasta">Las fechas determinan cuándo se aplica cada precio. Al crear una nueva regla, la anterior se cierra cuando corresponde. Si quedan días sin regla, el resumen lo mostrará como aviso.</HelpCard><HelpCard title="Incluido o adicional"><b>Coste adicional</b> se suma a las facturas para obtener el total a repartir. <b>Ya incluido en las facturas</b> se muestra y controla, pero no se suma otra vez, evitando duplicar el mismo gasto.</HelpCard></div>
      <div className="help-note"><b>Importante:</b> cambiar una regla no altera lo ya guardado en otros tramos. Cada periodo utiliza el precio que estaba vigente en cada uno de sus días.</div>
      <HelpActions><button className="secondary" onClick={() => onNavigate("fixed")}>Abrir Conceptos fijos</button></HelpActions>
    </article>

    <article className="help-section" id="fijo-cobrado">
      <HelpHeading number="3" eyebrow="La distinción más importante" title="Precio diario sugerido y fijo realmente cobrado" />
      <div className="help-comparison"><div className="suggested"><span>Sugerencia</span><h3>Lo que convendría cobrar</h3><p>La cifra sugerida toma los últimos costes configurados, los convierte a un día y los divide entre las viviendas activas. Sirve como orientación para decidir un nuevo precio diario.</p></div><div className="actual"><span>Dato real</span><h3>Lo que de verdad han pagado</h3><p>Es el precio aplicado en los recibos: euros por vivienda y día, con sus fechas de vigencia. También puede llegar como importe exacto por vivienda al importar un CSV.</p></div></div>
      <h3>Cómo usar «Utilizar cifra sugerida»</h3><p>El botón copia la sugerencia al formulario; <b>no la activa por sí solo</b>. Revisa la fecha de inicio, redondea el importe si procede, añade una nota y guarda el nuevo tramo. Cuando cambia la cuota, crea un tramo nuevo en lugar de modificar un periodo antiguo.</p>
      <h3>Cómo influye lo realmente cobrado en el cálculo</h3><p>El resumen descuenta del coste total el fijo que ya se cobró a los vecinos. Después descuenta el importe calculado del agua y reparte el resto entre el consumo de calefacción y frío. De ahí sale el precio calculado por kWh que hace cuadrar el cierre.</p>
      <div className="help-formula" aria-label="Explicación del cálculo"><span>Facturas + costes fijos adicionales</span><i>menos</i><span>fijo realmente cobrado</span><i>menos</i><span>agua calculada</span><i>igual a</i><strong>coste pendiente para calefacción y frío</strong></div>
      <p>Por eso la sugerencia y el cobro real no son intercambiables. La sugerencia ayuda a fijar precios futuros; el cierre siempre necesita saber cuánto se cobró de verdad. Si el fijo real fue distinto para cada vivienda, el CSV conserva esas diferencias y las aplica individualmente.</p>
      <div className="help-warning"><b>Atención:</b> si hay importes fijos procedentes de CSV dentro del periodo, esos importes reales tienen prioridad sobre el histórico general de precio diario. Si falta alguna vivienda, aparecerá un aviso.</div>
    </article>

    <article className="help-section" id="lecturas">
      <HelpHeading number="4" eyebrow="Calefacción, agua y frío" title="Vistas de lecturas" />
      <p>Los contadores muestran valores <b>acumulados</b>. No debes introducir el consumo del periodo: escribe la cifra completa que aparece en el contador. La plataforma resta la lectura inicial de la final para obtener el consumo.</p>
      <div className="help-grid"><HelpCard title="Elegir fecha">Usa el selector de fecha. Los días marcados en el calendario ya tienen lecturas para ese servicio. Puedes abrir una fecha existente para corregirla o elegir una nueva.</HelpCard><HelpCard title="Completar viviendas">Introduce un valor para todas las viviendas antes de guardar. Calefacción y frío se expresan en kWh; agua se introduce en litros y se muestra en m³ en el resumen.</HelpCard><HelpCard title="Consultar el histórico">Pulsa el nombre de una vivienda para ver todas sus lecturas guardadas. Es útil para detectar saltos inesperados o comprobar una corrección anterior.</HelpCard><HelpCard title="Evitar consumos negativos">La lectura final debe ser igual o mayor que la inicial. Si es menor, revisa la fecha, la vivienda y la cifra introducida; el resumen no podrá cerrar ese consumo.</HelpCard></div>
      <div className="help-note"><b>Para que un periodo sea fiable:</b> todas las viviendas deben tener lectura de los tres servicios tanto al inicio como al final. Si falta alguna, el resumen avisará y el consumo incompleto se mostrará a cero.</div>
      <HelpActions><button className="secondary" onClick={() => onNavigate("heating")}>Ver Calefacción</button><button className="secondary" onClick={() => onNavigate("water")}>Ver Agua</button><button className="secondary" onClick={() => onNavigate("cooling")}>Ver Frío</button></HelpActions>
    </article>

    <article className="help-section" id="importar">
      <HelpHeading number="5" eyebrow="Carga conjunta" title="Importar PDF o CSV" />
      <p>La importación ahorra introducir las lecturas una a una. Primero se muestra una revisión; nada se guarda hasta que todas las viviendas están identificadas, no hay duplicados y no quedan incidencias.</p>
      <div className="help-import-grid"><section><div className="import-icon">PDF</div><div><h3>Importar PDF de recibos</h3><p>Selecciona el PDF multipágina habitual, con un recibo por vivienda. La plataforma busca la vivienda, la fecha final, las tres lecturas y la tarifa diaria de «Término fijo».</p><ul><li>El PDF debe contener texto seleccionable; una imagen escaneada no se puede leer.</li><li>Deben estar todas las viviendas activas, una sola vez para esa fecha.</li><li>El periodo y el término fijo deben coincidir en todos los recibos.</li><li>Al confirmar, se guardan las tres lecturas y, si ha cambiado, una nueva regla de fijo cobrado.</li></ul></div></section><section><div className="import-icon csv-icon">CSV</div><div><h3>Importar CSV</h3><p>El archivo debe tener la cabecera <code>fecha;piso;calefaccion;frio;agua;fijo</code>. Cada fila representa una vivienda y una fecha.</p><ul><li>Las lecturas son acumuladas, igual que en las pantallas manuales.</li><li>La columna <code>fijo</code> es el importe total realmente facturado a esa vivienda en esa fecha, no un precio diario.</li><li>Permite reflejar importes diferentes entre viviendas.</li><li>Los importes fijos importados se usarán en el resumen del periodo correspondiente.</li></ul></div></section></div>
      <h3>Revisión previa</h3><p>Comprueba el nombre del archivo, el número de viviendas correctas y la tabla de datos detectados. Las filas problemáticas aparecen señaladas con el motivo. Si falta una vivienda o existe un duplicado, corrige el archivo original y vuelve a seleccionarlo. La importación es conjunta: no guarda solo una parte.</p>
      <div className="help-note"><b>Privacidad:</b> el archivo se lee para preparar la importación y no queda almacenado como documento. Lo que se guarda son las lecturas y los importes confirmados.</div>
      <HelpActions><button className="secondary" onClick={() => onNavigate("import")}>Abrir Importar lecturas</button></HelpActions>
    </article>

    <article className="help-section" id="resumen">
      <HelpHeading number="6" eyebrow="Cierre y comprobación" title="Resumen del periodo" />
      <p>Selecciona el periodo que quieras revisar. La franja superior muestra las fechas de lectura utilizadas; conviene comprobarlas antes de interpretar cualquier importe.</p>
      <div className="help-summary-list"><HelpSummary title="Lo cobrado a vecinos">Suma los consumos a los precios que realmente se aplicaron y el fijo realmente facturado. El saldo indica cuánto quedó por encima o por debajo del coste.</HelpSummary><HelpSummary title="Lo que debían pagar">Usa los precios calculados para cubrir el coste del periodo. En condiciones normales debe indicar «Cuadre exacto».</HelpSummary><HelpSummary title="Coste a repartir">Suma las facturas del periodo y solo los conceptos fijos marcados como adicionales. Los conceptos ya incluidos en facturas no vuelven a sumarse.</HelpSummary><HelpSummary title="Cobrado y calculado">Compara las tarifas reales con las de cierre. El precio calculado es común para calefacción y frío; el del agua es el indicado al editar el periodo.</HelpSummary><HelpSummary title="Liquidación por vivienda">Muestra el consumo, el importe cobrado, el calculado y su diferencia. Una diferencia positiva significa que faltó cobrar esa cantidad; una negativa, que se cobró de más.</HelpSummary><HelpSummary title="Avisos">Señalan lecturas incompletas, días sin regla, viviendas sin fijo importado o ausencia de consumo térmico. Resuélvelos antes de dar el cierre por definitivo.</HelpSummary></div>
      <h3>Editar periodo y tarifas</h3><p>Aquí se definen el nombre, las fechas y los precios que se cobraron por calefacción, frío y agua, además del precio calculado del agua. El precio calculado de calefacción y frío no se escribe: se obtiene automáticamente para completar el coste pendiente.</p>
      <h3>Qué fechas entran</h3><p>Se cuenta desde el día posterior al inicio hasta el día final. Las facturas siguen ese mismo criterio. Si cambias una fecha, revisa de nuevo lecturas, facturas y vigencias.</p>
      <h3>Exportar CSV o Excel</h3><p>Cuando el resumen esté revisado puedes descargar el detalle. Ambos formatos contienen la liquidación del periodo; Excel resulta cómodo para presentar o revisar visualmente y CSV para intercambiar los datos con otros programas.</p>
      <HelpActions><button className="primary" onClick={() => onNavigate("summary")}>Volver al resumen del periodo</button><button className="secondary" onClick={() => onNavigate("invoices")}>Revisar facturas</button></HelpActions>
    </article>
  </section>;
}

function HelpHeading({ number, eyebrow, title }: { number: string; eyebrow: string; title: string }) { return <div className="help-section-heading"><span>{number}</span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>; }
function HelpCard({ title, children }: { title: string; children: React.ReactNode }) { return <div><h3>{title}</h3><p>{children}</p></div>; }
function HelpSummary({ title, children }: { title: string; children: React.ReactNode }) { return <div><b>{title}</b><p>{children}</p></div>; }
function HelpActions({ children }: { children: React.ReactNode }) { return <div className="help-actions">{children}</div>; }
