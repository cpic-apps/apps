/*
 * CONFIGURACIÓN DE LA CREDENCIAL DIGITAL CPIC
 * --------------------------------------------
 * Éste es el ÚNICO archivo que hay que editar.
 *
 * API_URL: pegá entre las comillas la dirección que te da Google al publicar
 * el Apps Script como "Aplicación web" (termina en /exec).
 * Mientras esté vacía, las páginas funcionan en MODO DEMOSTRACIÓN con datos
 * ficticios (links de prueba: ?c=DEMO  y  ?c=DEMO-BAJA).
 */
window.CPIC_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycby1OapiEJnGSu8zyOcxEqNxR4ePtoRCrTw5U-iGNGuNK_igwPE73WFIr4XKATnBd2BU2A/exec",

  // Dónde está publicada la página de verificación (la que abre el QR).
  // Si usás un dominio propio (ej. https://credencial.cpic.org.ar/verificar/), cambialo acá.
  URL_VERIFICAR: "../verificar/",

  // Texto de contacto que aparece cuando un link no es válido.
  CONTACTO: "Comunicate con Atención al Matriculado del CPIC — www.cpic.org.ar"
};
