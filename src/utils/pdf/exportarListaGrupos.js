import jsPDF from "jspdf";

export function exportarListaGrupos(publicadores) {
  const doc = new jsPDF({
    unit: "mm",
    format: "a4"
  });

  const PAGE_W = 210;
  const PAGE_H = 297;

  const MARGIN = 10;
  const HEADER_H = 28;
  const FOOTER_H = 15;

  const COL_GAP = 8;
  const COL_W = (PAGE_W - MARGIN * 2 - COL_GAP) / 2;

  let columna = 0;
  let y = HEADER_H;

  const getX = () =>
    MARGIN + columna * (COL_W + COL_GAP);

  const texto = (
    txt,
    x,
    y,
    size = 9,
    bold = false,
    align = "left"
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(String(txt), x, y, { align });
  };

  const dibujarHeader = () => {
    texto(
      "CONGREGACIÓN PLAZA DE LA MISERICORDIA",
      PAGE_W / 2,
      12,
      14,
      true,
      "center"
    );

    texto(
  `Lista de Publicadores al ${new Date().toLocaleDateString("es-AR")}`,
  PAGE_W / 2,
  18,
  11,
  false,
  "center"
);
  };

  const dibujarFooter = ({
  totalPublicadores,
  totalActivos,
  totalPrecursores,
  totalAncianos,
  totalSiervos
}) => {
  doc.setDrawColor(180);

  doc.line(
    MARGIN,
    PAGE_H - FOOTER_H,
    PAGE_W - MARGIN,
    PAGE_H - FOOTER_H
  );

  texto(
    `Total de publicadores: ${totalPublicadores}`,
    MARGIN,
    PAGE_H - 11,
    7.5
  );

  texto(
    `Total activos: ${totalActivos}`,
    MARGIN + 45,
    PAGE_H - 11,
    7.5
  );

  texto(
    `Precursores regulares: ${totalPrecursores}`,
    MARGIN + 90,
    PAGE_H - 11,
    7.5
  );

  texto(
    `Ancianos: ${totalAncianos}`,
    MARGIN,
    PAGE_H - 5,
    7.5
  );

  texto(
    `Siervos ministeriales: ${totalSiervos}`,
    MARGIN + 45,
    PAGE_H - 5,
    7.5
  );
};

  const cambiarColumna = () => {
    if (columna === 0) {
      columna = 1;
      y = HEADER_H;
    } else {
      doc.addPage();
      columna = 0;
      y = HEADER_H;
      dibujarHeader();
    }
  };

  dibujarHeader();

  // Excluir solamente mudados
  const lista = publicadores.filter(
    p => !p.fecha_mudanza
  );

  // Agrupar
  const grupos = {};

  lista.forEach(pub => {
    const grupo = pub.grupo || "Sin grupo";

    if (!grupos[grupo]) {
      grupos[grupo] = [];
    }

    grupos[grupo].push(pub);
  });

  // Ordenar
  Object.values(grupos).forEach(grupo => {

    grupo.sort((a, b) => {

      const aInactivo = a.tipo_servicio === "Inactivo";
      const bInactivo = b.tipo_servicio === "Inactivo";

      if (aInactivo && !bInactivo) return 1;
      if (!aInactivo && bInactivo) return -1;

      return `${a.apellido} ${a.nombre}`.localeCompare(
        `${b.apellido} ${b.nombre}`
      );

    });

  });

  const nombresGrupos = Object.keys(grupos).sort();

  nombresGrupos.forEach(nombreGrupo => {

    const grupo = grupos[nombreGrupo];

    // Altura aproximada del grupo completo
    const alturaGrupo =
      6 + grupo.length * 4.6 + 5;

    if (y + alturaGrupo > PAGE_H - FOOTER_H - 5) {
      cambiarColumna();
    }

    texto(
      `${nombreGrupo} (${grupo.length})`,
      getX(),
      y,
      10,
      true
    );

    y += 6;

    grupo.forEach(pub => {

      const etiquetas = [];

      if (pub.responsabilidad === "Anciano") {
        etiquetas.push("Anciano");
      }

      if (pub.responsabilidad === "Siervo Ministerial") {
        etiquetas.push("Siervo Ministerial");
      }

      if (
        pub.tipo_servicio === "Precursor Regular" ||
        pub.tipo_servicio === "Precursor Especial"
      ) {
        etiquetas.push("Precursor Regular");
      }

      if (pub.tipo_servicio === "Inactivo") {
        etiquetas.push("Inactivo");
      }

      const descripcion =
        etiquetas.length > 0
          ? ` (${etiquetas.join(", ")})`
          : "";

      texto(
        `• ${pub.apellido}, ${pub.nombre}${descripcion}`,
        getX(),
        y,
        8.5
      );

      y += 4.6;

    });

    y += 5;

  });

  const totalPublicadores = lista.length;

const totalActivos = lista.filter(
  p => p.tipo_servicio !== "Inactivo"
).length;

const totalPrecursores = lista.filter(
  p =>
    p.tipo_servicio === "Precursor Regular" ||
    p.tipo_servicio === "Precursor Especial"
).length;

const totalAncianos = lista.filter(
  p => p.responsabilidad === "Anciano"
).length;

const totalSiervos = lista.filter(
  p => p.responsabilidad === "Siervo Ministerial"
).length;

  dibujarFooter({
  totalPublicadores,
  totalActivos,
  totalPrecursores,
  totalAncianos,
  totalSiervos
});

  doc.save("Lista por grupos.pdf");
}