/* Enlaces a actividades públicas alojadas por sus autores. No se copian ni incrustan. */
window.PROFESOR_EXTERNAL_GAMES = [
  ['Comprensión lectora: ideas y detalles','Lengua','1.º ESO','Identifica la idea principal y distingue los detalles de un texto.','reading','27838544-comprension_lectora_ideas_y_detalles'],
  ['El resumen','Lengua','2.º ESO','Resuelve un crucigrama sobre las ideas esenciales de un resumen.','crossword','27377735-el_resumen'],
  ['Sujeto y predicado','Lengua','1.º ESO','Repasa la estructura de las oraciones con preguntas rápidas.','quiz','30418939-sujeto_y_predicado'],
  ['Ortografía y gramática','Lengua','3.º ESO','Practica tildes, puntuación y categorías gramaticales.','quiz','30494926-prueba_interactiva_de_ortografia_y_gramatica'],
  ['Conectores para redactar','Lengua','4.º ESO','Relaciona conectores con la función que cumplen en un texto.','pairs','25509573-los_conectores_en_la_redaccion'],
  ['Géneros literarios','Lengua','2.º ESO','Busca los géneros y las formas literarias en una sopa de letras.','wordsearch','21431726-generos_literarios'],
  ['Tesis y argumentos','Lengua','1.º Bachillerato','Reconoce la tesis y los argumentos de un texto.','quiz','25075048-argumentacion_tesis_y_contextos'],
  ['Jobs vocabulary','Inglés','2.º ESO','Un rosco de vocabulario de profesiones en inglés.','pasapalabra','6910309-jobs_vocabulary'],
  ['English grammar essentials','Inglés','3.º ESO','Relaciona tiempos verbales, modales y estructuras básicas.','pairs','30668687-english_grammar_essentials_tense_modals_more'],
  ['Dialogue shopping','Inglés','1.º ESO','Completa un diálogo cotidiano de compras en inglés.','gaps','3781493-dialogue_shopping'],
  ['Fracciones y decimales','Matemáticas','1.º ESO','Relaciona cada fracción con su expresión decimal.','pairs','24780603-fracciones_y_numeros_decimales'],
  ['Proporcionalidad y porcentajes','Matemáticas','2.º ESO','Resuelve problemas de razones, regla de tres y porcentajes.','quiz','31230264-proporcionalidad_y_porcentajes'],
  ['Álgebra y funciones','Matemáticas','3.º ESO','Empareja conceptos de ecuaciones, gráficas y funciones.','pairs','30197053-juego_basico_de_algebra_y_funciones'],
  ['Funciones y gráficas','Matemáticas','4.º ESO','Relaciona expresiones algebraicas con sus gráficas.','pairs','21605976-relacional_funciones_y_graficas'],
  ['Estadística y probabilidad','Matemáticas','4.º ESO','Pon a prueba conceptos de datos y azar.','quiz','9383558-estadistica_y_probabilidad'],
  ['Comunidades autónomas','Geografía e Historia','1.º ESO','Localiza las comunidades autónomas en un mapa interactivo.','quiz','5753353-mapa_comunidades_autonomas'],
  ['Grecia y Roma','Geografía e Historia','1.º ESO','Repasa conceptos del mundo clásico con un crucigrama.','crossword','7278338-grecia_y_roma'],
  ['Revolución Industrial','Geografía e Historia','4.º ESO','Comprueba qué sabes de la industrialización.','quiz','17554360-revolucion_industrial'],
  ['Constitución y Transición','Geografía e Historia','4.º ESO','Avanza respondiendo sobre la transición democrática española.','quiz','21794613-la_constitucion_y_la_transicion'],
  ['Método científico','Biología y Geología','1.º ESO','Relaciona los pasos y conceptos de una investigación.','pairs','24539712-juego_de_parejas_metodo_cientifico'],
  ['Cadena alimentaria','Biología y Geología','1.º ESO','Ordena productores y consumidores en dos cadenas alimentarias.','order','30470352-construyamos_cadenas_alimentarias'],
  ['Organización del cuerpo humano','Biología y Geología','3.º ESO','Repasa células, tejidos, órganos y sistemas.','quiz','4924709-organizacion_del_cuerpo_humano'],
  ['Estados de la materia','Física y Química','2.º ESO','Repasa los estados de la materia y sus propiedades.','quiz','27358959-los_estados_de_la_materia'],
  ['Movimiento y fuerza','Física y Química','2.º ESO','Responde preguntas sobre fuerza, movimiento y velocidad.','quiz','25843985-el_movimiento_y_la_fuerza'],
  ['Energías renovables','Ciencias Naturales','6.º Primaria','Salta respondiendo sobre fuentes de energía sostenibles.','quiz','23796721-energias_renovables']
].map(([title,subject,course,body,artType,slug]) => ({
  id:'public:external:'+slug,title,subject,course,body,kind:'Juego externo',
  external:{provider:'Educaplay',url:'https://es.educaplay.com/recursos-educativos/'+slug+'.html',artType}
}));
