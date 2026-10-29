/* Problemas guiados de Matemáticas: situaciones, operaciones y comprobación
   escritas para cada tema. Las soluciones son deterministas y verificables. */
(function (root) {
  'use strict';
  const step = (place, context, prompt, choices, correct, explanation) => ({place, context, prompt, choices, correct, explanation});
  const missions = {
    'mat-numeros': {
      title:'La cuenta de la compra', place:'Mercado de números', symbol:'∑', art:'public-boveda-racionales-scene.webp',
      brief:'Calcula una compra mezclando enteros, fracciones y decimales.', stages:[
        step('Estimación','Compras 3 cuadernos de 2 € cada uno.','¿Cuánto cuestan los tres?',['5 €','6 €','9 €'],1,'3 × 2 = 6.'),
        step('Descuento','Te descuentan la mitad de 6 €.','¿Cuánto pagas ahora?',['3 €','4 €','12 €'],0,'La mitad de 6 es 3.'),
        step('Cambio','Entregas 5 € por una cuenta de 3 €.','¿Cuánto te devuelven?',['1 €','8 €','2 €'],2,'5 − 3 = 2.'),
        step('Comprobación','Añades un bolígrafo de 1,50 € a los 3 € anteriores.','¿Cuál es el total correcto?',['3,50 €','4,50 €','15 €'],1,'3,00 + 1,50 = 4,50 €.')
      ]
    },
    'mat-proporciones': {
      title:'Prepara un encargo', place:'Mercado de proporciones', symbol:'%', art:'public-mercado-porcentajes-scene.webp',
      brief:'Ajusta cantidades, descuento y escala antes de cerrar el pedido.', stages:[
        step('Precio por kilo','3 kg de fruta cuestan 6 €.','¿Cuánto cuesta 1 kg?',['2 €','3 €','6 €'],0,'6 ÷ 3 = 2 € por kilogramo.'),
        step('Pedido','Mantienes el mismo precio por kilo y compras 5 kg.','¿Cuál es el precio?',['8 €','10 €','15 €'],1,'5 × 2 = 10 €.'),
        step('Rebaja','Una cesta de 50 € tiene un 20 % de descuento.','¿Cuánto pagarás?',['30 €','45 €','40 €'],2,'El 20 % de 50 es 10; 50 − 10 = 40 €.'),
        step('Mapa','En el plano, 1 cm representa 2 km.','¿Qué distancia representan 3 cm?',['6 km','3 km','1,5 km'],0,'3 × 2 = 6 km.')
      ]
    },
    'mat-algebra': {
      title:'Descifra la entrada', place:'Sala de ecuaciones', symbol:'x', art:'public-camara-matrices-scene.webp',
      brief:'Encuentra la incógnita y comprueba cada código antes de abrir.', stages:[
        step('Primer código','Una entrada más 7 € de gestión cuesta 12 €.','Si x es la entrada, ¿qué ecuación lo expresa?',['x − 7 = 12','x + 7 = 12','7x = 12'],1,'El precio de la entrada se suma a los 7 € de gestión.'),
        step('Despeje','Resuelve x + 7 = 12.','¿Cuánto vale x?',['5','7','19'],0,'Resta 7 a ambos lados: x = 5.'),
        step('Lote','Tres entradas iguales cuestan 18 €.','¿Cuál es el precio de cada entrada?',['3 €','9 €','6 €'],2,'3x = 18; x = 18 ÷ 3 = 6.'),
        step('Verificación','Para 2x + 4 = 14 propones x = 5.','¿Qué comprobación es correcta?',['2 × 5 + 4 = 14','2 + 5 × 4 = 14','2 × 14 + 4 = 5'],0,'Sustituir x por 5 da 10 + 4 = 14.')
      ]
    },
    'mat-geometria': {
      title:'Diseña un jardín', place:'Taller de planos', symbol:'△', art:'public-laboratorio-medidas.webp',
      brief:'Calcula superficies y longitudes de un espacio real.', stages:[
        step('Superficie','El jardín rectangular mide 8 m por 5 m.','¿Cuál es su área?',['13 m²','40 m²','26 m²'],1,'Área = largo × ancho = 8 × 5 = 40 m².'),
        step('Valla','Quieres rodear ese rectángulo con una valla.','¿Cuántos metros de valla necesitas?',['26 m','40 m','13 m'],0,'Perímetro = 2 × (8 + 5) = 26 m.'),
        step('Parterre','Un triángulo tiene base de 6 m y altura de 4 m.','¿Cuál es su área?',['24 m²','10 m²','12 m²'],2,'Área del triángulo = 6 × 4 ÷ 2 = 12 m².'),
        step('Diagonal','Un sendero forma un triángulo rectángulo con catetos de 3 m y 4 m.','¿Cuánto mide la hipotenusa?',['7 m','5 m','12 m'],1,'Por Pitágoras: √(3² + 4²) = 5 m.')
      ]
    },
    'mat-funciones': {
      title:'La tarifa de bicicletas', place:'Estación de funciones', symbol:'ƒ', art:'public-observatorio-ondas.webp',
      brief:'Lee una relación entre tiempo de uso y precio.', stages:[
        step('Modelo','Alquilar una bicicleta cuesta 3 € fijos más 2 € por hora.','Si h son las horas, ¿qué fórmula da el precio?',['P = 3h + 2','P = 3 + 2h','P = 5h'],1,'El coste fijo es 3; se suman 2 € por cada hora.'),
        step('Inicio','Usa P = 3 + 2h.','¿Cuánto indica el modelo cuando h = 0?',['3 €','0 €','2 €'],0,'El término fijo es 3 €.'),
        step('Cálculo','Alquilas la bicicleta durante 4 horas.','¿Qué precio marca el modelo?',['8 €','7 €','11 €'],2,'P = 3 + 2 × 4 = 11 €.'),
        step('Pendiente','Comparas precios al añadir una hora.','¿Cuánto aumenta el precio por hora?',['3 €','2 €','5 €'],1,'El coeficiente de h es 2 € por hora.')
      ]
    },
    'mat-estadistica': {
      title:'La encuesta del barrio', place:'Mesa de datos', symbol:'▥', art:'public-observatorio-decimales.webp',
      brief:'Ordena cinco datos y elige la medida adecuada.', stages:[
        step('Datos','Respuestas obtenidas: 2, 4, 4, 6 y 9.','¿Cuántos datos hay?',['5','4','25'],0,'La lista contiene cinco valores.'),
        step('Media','Los cinco valores suman 25.','¿Cuál es la media?',['4','5','25'],1,'Media = suma ÷ número de datos = 25 ÷ 5 = 5.'),
        step('Mediana','Los datos ya están ordenados: 2, 4, 4, 6, 9.','¿Cuál es el valor central?',['5','6','4'],2,'El tercer valor, 4, es la mediana.'),
        step('Azar','Eliges al azar una de las cinco respuestas. Dos valen 4.','¿Qué probabilidad hay de sacar un 4?',['2/5','4/5','1/4'],0,'Hay 2 casos favorables de 5 posibles.')
      ]
    },
    'mat-medida': {
      title:'Prepara una mudanza', place:'Taller de medidas', symbol:'↔', art:'public-laboratorio-medidas-scene.webp',
      brief:'Convierte distancias, capacidades, masas y tiempos.', stages:[
        step('Distancia','El trayecto hasta el almacén es de 2,5 km.','¿Cuántos metros son?',['250 m','2 500 m','25 000 m'],1,'1 km son 1 000 m; 2,5 km son 2 500 m.'),
        step('Capacidad','Una botella contiene 750 mL.','¿Cuántos litros contiene?',['7,5 L','75 L','0,75 L'],2,'750 ÷ 1 000 = 0,75 L.'),
        step('Masa','Una caja pesa 1,2 kg.','¿Cuántos gramos pesa?',['1 200 g','120 g','12 000 g'],0,'1,2 × 1 000 = 1 200 g.'),
        step('Duración','El viaje dura 90 minutos.','¿Cuántas horas son?',['0,9 h','1,5 h','2 h'],1,'90 ÷ 60 = 1,5 horas.')
      ]
    },
    'mat-finanzas': {
      title:'Revisa la factura', place:'Mesa de cuentas', symbol:'€', art:'public-mercado-porcentajes-scene.webp',
      brief:'Comprueba un descuento, un impuesto y el total a pagar.', stages:[
        step('Descuento','Un producto cuesta 80 € y tiene una rebaja del 25 %.','¿Cuál es el precio rebajado?',['60 €','20 €','100 €'],0,'El 25 % de 80 es 20; 80 − 20 = 60 €.'),
        step('Impuesto','A los 60 € se añade un IVA hipotético del 10 %.','¿Cuál es el subtotal con IVA?',['64 €','70 €','66 €'],2,'El 10 % de 60 es 6; 60 + 6 = 66 €.'),
        step('Envío','El envío cuesta 4 € adicionales.','¿Cuál es el total de esa factura?',['66 €','70 €','74 €'],1,'66 + 4 = 70 €.'),
        step('Ahorro','Un ahorro de 1 000 € genera un 3 % de interés simple anual.','¿Cuánto interés produce en un año?',['30 €','300 €','3 €'],0,'1 000 × 0,03 = 30 € de interés.')
      ]
    },
    'mat-problemas': {
      title:'Una receta para seis', place:'Cocina de problemas', symbol:'◒', art:'public-boveda-racionales-scene.webp',
      brief:'Lee los datos, plantea la proporción y comprueba la respuesta.', stages:[
        step('Datos','La receta para 4 personas usa 300 g de arroz.','¿Cuántos gramos corresponden a una persona?',['75 g','100 g','120 g'],0,'300 ÷ 4 = 75 g por persona.'),
        step('Ajuste','Ahora cocinarás para 6 personas.','¿Cuánto arroz necesitas?',['350 g','450 g','600 g'],1,'6 × 75 = 450 g.'),
        step('Compra','Cada kilogramo de arroz cuesta 2,40 €.','¿Cuánto cuestan 3 kg?',['5,40 €','6,40 €','7,20 €'],2,'3 × 2,40 = 7,20 €.'),
        step('Comprobación','Para 6 personas necesitas 450 g de arroz.','¿Qué cantidad necesitas para 2 personas?',['150 g','225 g','900 g'],0,'2 × 75 = 150 g; la proporción es coherente.')
      ]
    },
    'mat-graficas-examen': {
      title:'Interpreta la gráfica', place:'Panel de datos', symbol:'▤', art:'public-observatorio-ondas.webp',
      brief:'Lee una serie de visitantes y extrae una conclusión comprobable.', stages:[
        step('Ejes','Un gráfico muestra años en horizontal y visitantes en vertical.','¿Qué representa el eje vertical?',['Los años','Los visitantes','La distancia'],1,'El eje vertical indica el número de visitantes.'),
        step('Máximo','Visitantes: 2022 → 100; 2023 → 150; 2024 → 120.','¿En qué año hubo más visitantes?',['2022','2024','2023'],2,'El máximo es 150 en 2023.'),
        step('Cambio','Comparas 2023 y 2024.','¿Cuántos visitantes menos hubo en 2024?',['30','20','270'],0,'150 − 120 = 30 visitantes menos.'),
        step('Porcentaje','La caída fue de 30 respecto a los 150 visitantes de 2023.','¿Qué porcentaje disminuyó?',['30 %','20 %','15 %'],1,'30 ÷ 150 = 0,20, es decir, 20 %.')
      ]
    },
    'mat-calculadora': {
      title:'Comprueba el recibo', place:'Mesa de cálculo', symbol:'=', art:'public-observatorio-numeros.webp',
      brief:'Plantea la operación antes de usar la calculadora.', stages:[
        step('Operación','Compras 3 artículos de 4,50 € y 2 de 1,80 €.','¿Qué operación calcula el total?',['3 × 4,50 + 2 × 1,80','5 × (4,50 + 1,80)','3 + 4,50 + 2 + 1,80'],0,'Multiplica cada precio por su cantidad y suma los importes.'),
        step('Cálculo','3 × 4,50 = 13,50; 2 × 1,80 = 3,60.','¿Cuál es el total?',['16,10 €','17,10 €','18,10 €'],1,'13,50 + 3,60 = 17,10 €.'),
        step('Estimación','Antes de pagar, comparas el resultado con una estimación.','¿Qué cifra aproximada tiene sentido?',['1 €','170 €','17 €'],2,'El total calculado es 17,10 €, cercano a 17 €.'),
        step('Cambio','Pagas 20 € por un total de 17,10 €.','¿Qué cambio deben darte?',['2,90 €','3,10 €','1,90 €'],0,'20,00 − 17,10 = 2,90 €.')
      ]
    },
    'mat-razonamiento': {
      title:'Detecta el patrón', place:'Laboratorio lógico', symbol:'◇', art:'public-torre-radicales-scene.webp',
      brief:'Resuelve cuatro retos y comprueba si el resultado tiene sentido.', stages:[
        step('Secuencia','La serie es 3, 6, 9, 12, ...','¿Cuál es el siguiente número?',['13','15','18'],1,'La secuencia aumenta de 3 en 3.'),
        step('Ecuación','El doble de un número más 4 es 10.','¿Qué número cumple 2x + 4 = 10?',['3','5','7'],0,'2 × 3 + 4 = 10.'),
        step('Probabilidad','Un resultado se anuncia con probabilidad 1,2.','¿Por qué no puede ser correcto?',['Porque supera 1','Porque no es entero','Porque es positivo'],0,'Toda probabilidad está entre 0 y 1.'),
        step('Verificación','Alguien afirma que 3/4 es mayor que 1.','¿Qué comparación lo corrige?',['3/4 = 1','3/4 < 1','3/4 > 1'],1,'3/4 = 0,75, menor que 1.')
      ]
    }
  };
  root.EsoMathMissions = missions;
  if (typeof module !== 'undefined' && module.exports) module.exports = missions;
})(typeof window === 'undefined' ? globalThis : window);
