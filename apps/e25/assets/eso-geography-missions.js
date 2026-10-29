/* Misiones de Geografía: decisiones sobre mapas, territorio y vida cotidiana. */
(function (root) {
  'use strict';
  const S = (place, context, prompt, choices, correct, explanation) => ({place, context, prompt, choices, correct, explanation});
  const M = (title, place, symbol, art, brief, stages) => ({title, place, symbol, art, brief, stages});
  const missions = {
    'geo-mapas': M('La ruta del refugio','Mesa de cartografía','⌖','public-atlas-explorador.webp','Lee el plano y calcula la ruta antes de salir.',[
      S('Orientación','En el plano, la flecha del norte apunta hacia arriba.','Si el refugio aparece a la derecha del pueblo, ¿en qué dirección está?',['Oeste','Este','Sur'],1,'En un mapa orientado al norte, la derecha corresponde al este.'),
      S('Leyenda','Una línea azul representa un río y una línea negra, una carretera.','¿Qué símbolo debes seguir para viajar por carretera?',['La línea negra','La línea azul','Una zona verde'],0,'La leyenda identifica la carretera con la línea negra.'),
      S('Escala','La escala indica 1 cm = 2 km. Entre pueblo y refugio hay 3 cm.','¿Qué distancia real hay?',['1,5 km','3 km','6 km'],2,'3 × 2 = 6 km.'),
      S('Comprobación','El plano mide distancias en línea recta, pero la carretera tiene curvas.','¿Qué distancia será probablemente mayor?',['La línea recta del plano','El recorrido por carretera','Serán necesariamente iguales'],1,'Un recorrido con curvas suele ser más largo que la distancia recta entre sus extremos.')
    ]),
    'geo-relieve': M('El valle de los dos pueblos','Estación del clima','△','public-safari-parque.webp','Compara relieve, altitud y mar para elegir un destino.',[
      S('Altitud','El pueblo A está a 1.500 m y el B a 100 m, a la misma latitud.','¿Cuál suele tener temperaturas más bajas?',['El A','El B','No influye la altitud'],0,'En general, la temperatura disminuye al aumentar la altitud.'),
      S('Costa','El pueblo B está junto al mar.','¿Qué efecto suele tener el mar sobre sus temperaturas?',['Las hace siempre bajo cero','Suaviza las diferencias térmicas','Impide la lluvia'],1,'El mar se calienta y enfría más lentamente que la tierra y modera temperaturas.'),
      S('Lluvia','Una masa de aire húmedo asciende por una ladera de montaña.','¿Qué puede ocurrir al enfriarse el aire?',['Se convierte en roca','Desaparece la humedad','Se condensa y puede llover'],2,'Al ascender, el aire se enfría y el vapor puede condensarse.'),
      S('Paisaje','Quieres comparar los climas de ambos pueblos durante todo el año.','¿Qué datos necesitas?',['Temperaturas y precipitaciones mensuales','Solo una foto de verano','Solo la población'],0,'Las series de temperatura y lluvia permiten caracterizar el clima.')
    ]),
    'geo-poblacion': M('El censo del barrio','Oficina de población','◉','public-mapa-migraciones-scene.webp','Interpreta cambios de población con datos, no suposiciones.',[
      S('Pirámide','La pirámide de población del barrio tiene una base muy estrecha.','¿Qué indica sobre los nacimientos recientes?',['Son muy altos','Son relativamente bajos','No se pueden representar'],1,'Una base estrecha representa menos personas en las edades más jóvenes.'),
      S('Movimiento','Una familia se traslada de otra ciudad para vivir en el barrio.','Para el barrio, este movimiento es...',['Inmigración','Emigración','Natalidad'],0,'Es inmigración respecto al lugar que recibe población.'),
      S('Saldo','En un año llegan 120 personas y se marchan 80.','¿Cuál es el saldo migratorio?',['−40','200','+40'],2,'Llegadas menos salidas: 120 − 80 = +40.'),
      S('Servicios','Aumenta la población mayor del barrio.','¿Qué planificación responde mejor a ese dato?',['Cerrar todos los centros de salud','Revisar accesibilidad y servicios sanitarios','Ignorar la estructura por edades'],1,'La estructura por edades ayuda a planificar servicios adecuados.')
    ]),
    'geo-economia': M('El mapa de los oficios','Centro de actividades','▣','public-ciudad-economica-scene.webp','Sitúa trabajos y recursos en el territorio.',[
      S('Campo','Una cooperativa cultiva tomates.','¿A qué sector pertenece el cultivo?',['Primario','Secundario','Terciario'],0,'La agricultura obtiene recursos de la naturaleza: sector primario.'),
      S('Fábrica','Una industria transforma los tomates en conservas.','¿A qué sector pertenece?',['Primario','Secundario','Terciario'],1,'La transformación industrial de materias primas pertenece al secundario.'),
      S('Transporte','Una empresa distribuye las conservas a tiendas.','¿A qué sector pertenece la distribución?',['Primario','Secundario','Terciario'],2,'El transporte y la distribución son servicios del sector terciario.'),
      S('Ubicación','La conservera necesita recibir producto fresco y distribuirlo rápido.','¿Qué ubicación resulta más razonable?',['Lejos de cualquier vía','Cerca de cultivos y buenas vías de transporte','En un lugar sin acceso a agua ni energía'],1,'Proximidad a materias primas y transporte reduce tiempos y costes.')
    ]),
    'geo-global': M('El viaje de una camiseta','Puerto de conexiones','◎','public-atlas-explorador.webp','Sigue la cadena de producción y valora sus efectos.',[
      S('Origen','El algodón se cultiva en un país y la tela se fabrica en otro.','¿Qué muestra esta cadena?',['Interdependencia entre territorios','Producción aislada','Ausencia de comercio'],0,'Distintos territorios participan en la producción de un mismo bien.'),
      S('Transporte','La prenda recorre miles de kilómetros hasta la tienda.','¿Qué aspecto ambiental conviene analizar?',['El color de la etiqueta','Las emisiones del transporte','El nombre de la tienda'],1,'La distancia y el medio de transporte influyen en las emisiones.'),
      S('Trabajo','Los trabajadores de la fábrica denuncian jornadas excesivas.','¿Qué dato ayuda a valorar la cadena global?',['Solo el precio final','Solo el diseño','Las condiciones laborales'],2,'El impacto social también incluye las condiciones de quienes producen.'),
      S('Decisión','Comparas dos prendas similares.','¿Qué decisión está mejor informada?',['Comprar sin leer nada','Comparar origen, condiciones y durabilidad','Suponer que todo producto extranjero es igual'],1,'Varios criterios permiten valorar efectos económicos, sociales y ambientales.')
    ]),
    'geo-espana-europa': M('La ruta de las instituciones','Atlas de Europa','✦','public-atlas-explorador.webp','Distingue territorios e instituciones durante un viaje.',[
      S('Territorio','Viajas de Andalucía a Aragón sin salir de España.','¿Qué tipo de territorios has atravesado?',['Dos Estados soberanos','Dos comunidades autónomas','Dos continentes'],1,'Andalucía y Aragón son comunidades autónomas españolas.'),
      S('Capital','Una señal indica Madrid y otra Bruselas.','¿Cuál es la capital de España?',['Madrid','Bruselas','Estrasburgo'],0,'Madrid es la capital de España.'),
      S('Unión','España participa en la Unión Europea.','¿Qué es la UE?',['Una provincia española','Un único Estado que sustituye a España','Una unión de Estados europeos'],2,'La Unión Europea agrupa Estados miembros que cooperan en políticas comunes.'),
      S('Mapa','Quieres identificar la frontera entre España y Francia.','¿Qué recurso es más adecuado?',['Un mapa político de Europa','Una factura de luz','Un gráfico de edades'],0,'Un mapa político permite localizar Estados y fronteras.')
    ]),
    'geo-medioambiente': M('El plan del embalse','Consejo del agua','♧','public-bosque-vivo.webp','Responde a una sequía con decisiones fundamentadas.',[
      S('Señal','El embalse lleva tres meses con nivel bajo y ha llovido poco.','¿Qué riesgo conviene vigilar?',['Exceso de nieve','Escasez de agua disponible','Un terremoto inevitable'],1,'Menos precipitaciones y reservas bajas pueden causar escasez.'),
      S('Uso','Una explotación riega al mediodía con grandes pérdidas por evaporación.','¿Qué cambio ayuda a ahorrar agua?',['Riego eficiente en horas menos calurosas','Abrir más aspersores a mediodía','Eliminar el control de consumo'],0,'Un sistema eficiente y horarios adecuados reducen pérdidas.'),
      S('Cuenca','Se vierten residuos al río que alimenta el embalse.','¿Qué consecuencia directa puede tener?',['Aumentar la potabilidad','Producir lluvia','Contaminar el agua'],2,'Los vertidos pueden deteriorar la calidad del agua.'),
      S('Plan','El ayuntamiento diseña una respuesta a largo plazo.','¿Qué combinación es más sostenible?',['Solo ampliar el consumo','Reducir pérdidas, proteger la cuenca y medir reservas','Ignorar los datos de lluvia'],1,'Combinar eficiencia, protección y seguimiento reduce el riesgo.')
    ]),
    'geo-fuentes': M('El informe de la comarca','Sala de datos','▤','public-hemeroteca-fuentes-scene.webp','Lee una tabla y justifica una conclusión geográfica.',[
      S('Título','La tabla se titula «Población de tres municipios, 2025».','¿Qué información presenta?',['Habitantes de municipios en 2025','Lluvia de un siglo','Temperatura mundial'],0,'El título fija variable, ámbito territorial y año.'),
      S('Comparación','Municipio A: 8.000 habitantes; B: 12.000; C: 5.000.','¿Cuál tiene mayor población?',['A','B','C'],1,'12.000 es el valor más alto de la tabla.'),
      S('Diferencia','Comparas B (12.000) y C (5.000).','¿Cuál es la diferencia de habitantes?',['5.000','17.000','7.000'],2,'12.000 − 5.000 = 7.000.'),
      S('Límite','Solo tienes datos de 2025.','¿Qué afirmación no puedes justificar con esta tabla?',['B es el mayor en 2025','B creció cada año desde 2020','C tiene 5.000 habitantes en 2025'],1,'Una tabla de un solo año no muestra la evolución de 2020 a 2025.')
    ]),
    'geo-ciudad': M('Rediseña el barrio','Plano urbano','⌂','public-ciudad-direcciones.webp','Busca servicios, movilidad y uso responsable del suelo.',[
      S('Acceso','Un barrio nuevo queda lejos del centro de salud.','¿Qué problema aparece?',['Acceso desigual a servicios','Mayor natalidad automática','Ausencia de población'],0,'La distancia puede dificultar el acceso a servicios básicos.'),
      S('Movilidad','La mayoría de trayectos cortos se hacen en coche por falta de alternativas.','¿Qué medida puede reducir tráfico?',['Quitar aceras','Mejorar transporte público y rutas seguras a pie','Aumentar solo aparcamientos'],1,'Ofrecer alternativas viables puede reducir viajes en coche.'),
      S('Suelo','Se proyectan viviendas sobre un área agrícola fértil.','¿Qué recurso se perdería?',['La orientación del mapa','La altitud de la ciudad','Suelo agrario'],2,'Edificar sobre terreno fértil reduce la superficie agrícola disponible.'),
      S('Plan','El ayuntamiento revisa el proyecto urbano.','¿Qué criterio integra mejor las necesidades del barrio?',['Solo el número de coches','Vivienda, servicios, transporte y espacios verdes','Solo la altura de los edificios'],1,'Una planificación completa considera usos y calidad de vida.')
    ]),
    'geo-trabajo': M('El presupuesto del mes','Mesa familiar','€','public-mercado-monedas.webp','Distingue ingresos, gastos y decisiones de consumo.',[
      S('Ingreso','La familia recibe 1.400 € de sueldo este mes.','¿En qué columna del presupuesto va?',['Ingresos','Gastos','Deudas pagadas'],0,'El sueldo es dinero que entra: un ingreso.'),
      S('Gastos fijos','Pagan 600 € de alquiler y 200 € de suministros.','¿Cuánto suman estos gastos?',['600 €','800 €','1.600 €'],1,'600 + 200 = 800 €.'),
      S('Saldo','Tras cobrar 1.400 € y pagar esos 800 €, antes de otros gastos...','¿Cuánto queda?',['200 €','800 €','600 €'],2,'1.400 − 800 = 600 € para otros gastos y ahorro.'),
      S('Decisión','Una compra no urgente cuesta 650 € y aún faltan gastos de comida.','¿Qué decisión es más prudente?',['Comprar sin revisar nada','Aplazar y calcular primero los gastos necesarios','Suponer que quedan 1.400 € libres'],1,'El dinero disponible debe cubrir primero las necesidades pendientes.')
    ])
  };
  root.EsoGeographyMissions = missions;
  if (typeof module !== 'undefined' && module.exports) module.exports = missions;
})(typeof window === 'undefined' ? globalThis : window);
