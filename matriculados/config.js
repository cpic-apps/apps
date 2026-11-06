/*
 * CONFIGURACIÓN DEL BUSCADOR DE MATRICULADOS ACTIVOS · CPIC
 * ----------------------------------------------------------
 * Éste es el ÚNICO archivo que hay que editar.
 *
 * API_URL: pegá entre las comillas la dirección que te da Google al publicar
 * el Apps Script "Buscador de matriculados" como Aplicación web (termina en /exec).
 * Mientras esté vacía, el buscador usa el archivo datos.json de esta carpeta
 * (la copia que se generó al armar la app).
 */
window.CPIC_BUSCADOR = {
  API_URL: "https://script.google.com/macros/s/AKfycbynTkIILjRe8eMatiQ2X7EF23tCcrQtl92hR0ztMdV7HGzfDSa8zob5d6nyCiHeKqlC3g/exec",

  // Texto que aparece cuando una búsqueda no encuentra resultados.
  CONTACTO: "Si el profesional que buscás no figura, comunicate con Atención al Matriculado del CPIC — www.cpic.org.ar"
};
