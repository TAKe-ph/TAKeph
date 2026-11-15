// Un solo enlace para todos: en un ordenador abre la página de recibir
(function () {
  var ua = navigator.userAgent;
  var movil = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua));
  if (!movil && location.search.indexOf("movil") < 0) location.replace("pc.html");
})();
