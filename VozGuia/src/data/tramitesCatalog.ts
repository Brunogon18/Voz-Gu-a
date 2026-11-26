import { TramiteRecord } from '../types/vozGuia';

export const TRAMITES_CATALOG: TramiteRecord[] = [
  {
    id: 'salud-cita-imss',
    title: 'Agendar cita médica familiar (IMSS)',
    category: 'salud',
    institution: 'Instituto Mexicano del Seguro Social (IMSS)',
    summary:
      'Permite programar una consulta con tu médico familiar en tu Unidad de Medicina Familiar (UMF) usando tu CURP y Número de Seguridad Social (NSS).',
    simpleSummary:
      'Es para apartar día y hora con tu doctor de la clínica del IMSS sin hacer fila desde temprano.',
    requirements: [
      'CURP (18 caracteres)',
      'Número de Seguridad Social (NSS) a 11 dígitos',
      'Correo electrónico personal (o de un familiar de confianza)',
      'Cartilla Nacional de Salud (para llevar el día de la consulta)',
    ],
    steps: [
      {
        order: 1,
        title: 'Ten a la mano tu CURP y NSS',
        instruction:
          'Busca tu CURP y tu Número de Seguridad Social de 11 dígitos en tu carnet o cartilla del IMSS.',
        simpleExplanation:
          'Antes de empezar, ten cerca tu cartilla o una hoja donde estén anotados tu CURP y tu número del seguro.',
      },
      {
        order: 2,
        title: 'Ingresa al portal o llama por teléfono',
        instruction:
          'Puedes agendar en la app IMSS Digital, en citamedicadigital.imss.gob.mx o llamando al 800 681 2525.',
        simpleExplanation:
          'Si no tienes internet, puedes marcar gratis al 800 681 2525 y pedir ayuda por teléfono.',
      },
      {
        order: 3,
        title: 'Elige fecha, turno y confirma',
        instruction:
          'Selecciona si prefieres turno matutino o vespertino, escoge el día disponible y anota tu folio de confirmación.',
        simpleExplanation:
          'Escoge si quieres ir en la mañana o en la tarde, apunta la fecha y guarda el número de confirmación.',
      },
      {
        order: 4,
        title: 'Acude 15 minutos antes a tu clínica',
        instruction:
          'Llega a tu Unidad de Medicina Familiar con tu identificación oficial y tu Cartilla Nacional de Salud.',
        simpleExplanation:
          'El día de tu cita, llega un poco antes con tu credencial para votar y tu cartilla.',
      },
    ],
    cost: 'Gratuito',
    estimatedTime: '5 a 10 minutos',
    officialChannel: 'IMSS Digital / Tel. 800 681 2525',
    keywords: [
      'cita medica',
      'doctor',
      'consulta',
      'imss',
      'clinica',
      'medico familiar',
      'salud',
      'nss',
      'curp',
      'seguro social',
    ],
    updatedAt: '2026-11-01',
  },
  {
    id: 'salud-registro-imss-bienestar',
    title: 'Registro y credencialización IMSS-Bienestar',
    category: 'salud',
    institution: 'IMSS-Bienestar',
    summary:
      'Registro gratuito para personas sin seguridad social laboral que requieren atención médica, estudios y medicamentos gratuitos.',
    simpleSummary:
      'Sirve para recibir atención médica y medicinas gratis si no cuentas con IMSS de trabajo ni ISSSTE.',
    requirements: [
      'CURP actualizada',
      'Identificación oficial vigente (INE, pasaporte o credencial INAPAM)',
      'Comprobante de domicilio reciente',
      'Número de teléfono celular de contacto',
    ],
    steps: [
      {
        order: 1,
        title: 'Reúne tus documentos básicos',
        instruction:
          'Prepara tu CURP, identificación oficial vigente y un comprobante de domicilio (agua, luz o predial).',
        simpleExplanation:
          'Junta tu credencial para votar o del INAPAM, tu CURP y un recibo reciente de luz o agua.',
      },
      {
        order: 2,
        title: 'Acude a un módulo o regístrate en línea',
        instruction:
          'Ingresa a registro.imssbienestar.gob.mx o visita el centro de salud más cercano con módulo de credencialización.',
        simpleExplanation:
          'Puedes ir directamente al centro de salud de tu colonia o pedir a un familiar que te registre en internet.',
      },
      {
        order: 3,
        title: 'Toma de fotografía y verificación',
        instruction:
          'Verifica que tu nombre y dirección sean correctos y completa la toma de fotografía para tu credencial.',
        simpleExplanation:
          'Revisarán tus papeles, te tomarán una foto y te avisarán cuándo recoger tu tarjeta.',
      },
    ],
    cost: 'Gratuito',
    estimatedTime: '20 minutos en módulo',
    officialChannel: 'Centros de Salud / registro.imssbienestar.gob.mx',
    keywords: [
      'imss bienestar',
      'sin seguro',
      'atencion medica gratuita',
      'medicamentos',
      'credencial salud',
      'adulto mayor',
      'centro de salud',
    ],
    updatedAt: '2026-11-01',
  },
  {
    id: 'salud-vigencia-derechos',
    title: 'Constancia de vigencia de derechos IMSS',
    category: 'salud',
    institution: 'IMSS',
    summary:
      'Documento oficial que confirma que tú y tus beneficiarios tienen derecho activo a recibir atención médica en el IMSS.',
    simpleSummary:
      'Es una hoja que comprueba que tu seguro médico está activo y qué clínica te toca.',
    requirements: [
      'CURP',
      'Número de Seguridad Social (NSS)',
      'Correo electrónico personal',
    ],
    steps: [
      {
        order: 1,
        title: 'Prepara tu CURP y NSS',
        instruction: 'Ten visibles los datos de tu CURP y tu Número de Seguridad Social.',
        simpleExplanation: 'Busca tu CURP y tu número del seguro social.',
      },
      {
        order: 2,
        title: 'Solicita la constancia digital o en ventanilla',
        instruction:
          'Descárgala en serviciosdigitales.imss.gob.mx o solicítala en la ventanilla de Afiliación y Vigencia de tu clínica.',
        simpleExplanation:
          'Puedes pedirla directo en la ventanilla de tu clínica del IMSS si no tienes internet.',
      },
      {
        order: 3,
        title: 'Revisa tu clínica asignada',
        instruction:
          'En el PDF verás tu Unidad de Medicina Familiar, consultorio, turno y beneficiarios registrados.',
        simpleExplanation:
          'Ahí viene anotado el número de tu clínica, tu consultorio y si vas en la mañana o en la tarde.',
      },
    ],
    cost: 'Gratuito',
    estimatedTime: '5 minutos',
    officialChannel: 'IMSS Digital / Ventanilla UMF',
    keywords: [
      'vigencia de derechos',
      'clinica asignada',
      'consultorio',
      'imss activo',
      'constancia seguro',
    ],
    updatedAt: '2026-11-01',
  },
  {
    id: 'becas-benito-juarez',
    title: 'Beca Universal Benito Juárez (Educación Media Superior)',
    category: 'becas',
    institution: 'Coordinación Nacional de Becas para el Bienestar',
    summary:
      'Apoyo económico bimestral para estudiantes inscritos en escuelas públicas de bachillerato o preparatoria.',
    simpleSummary:
      'Es un apoyo de dinero cada dos meses para jóvenes que estudian la preparatoria en escuela pública.',
    requirements: [
      'Estar inscrito en una preparatoria o bachillerato público escolarizado',
      'CURP del estudiante',
      'Comprobante de inscripción o constancia de estudios vigente',
      'Si eres menor de edad: identificación oficial y CURP de madre, padre o tutor',
    ],
    steps: [
      {
        order: 1,
        title: 'Verifica tu inscripción con tu escuela',
        instruction:
          'Confirma en el área de control escolar de tu preparatoria que tus datos escolares fueron reportados correctamente.',
        simpleExplanation:
          'Pregunta en la dirección o control escolar de tu prepa si ya te anotaron en la lista de becas.',
      },
      {
        order: 2,
        title: 'Consulta el Buscador de Estatus',
        instruction:
          'Con tu CURP, revisa en el portal oficial de Becas Benito Juárez si ya tienes fecha para recoger tu tarjeta.',
        simpleExplanation:
          'Con tu CURP puedes revisar cuándo y dónde te entregarán la tarjeta del Banco del Bienestar.',
      },
      {
        order: 3,
        title: 'Entrega tu expediente y recoge la tarjeta',
        instruction:
          'Acude en la fecha asignada acompañado de tu padre, madre o tutor (si eres menor de 18 años) con tus documentos en original y copia.',
        simpleExplanation:
          'Ve el día que te indiquen con tu papá, mamá o tutor y lleva tus papeles originales y copias.',
      },
    ],
    cost: 'Gratuito',
    estimatedTime: 'Según calendario de convocatoria',
    officialChannel: 'Control Escolar / Tel. 55 1162 0300',
    keywords: [
      'beca',
      'benito juarez',
      'preparatoria',
      'bachillerato',
      'estudiante',
      'apoyo economico',
      'tarjeta bienestar',
    ],
    updatedAt: '2026-11-01',
  },
  {
    id: 'becas-rita-cetina',
    title: 'Beca Universal Rita Cetina (Educación Básica)',
    category: 'becas',
    institution: 'Secretaría de Educación Pública / Becas para el Bienestar',
    summary:
      'Beca destinada a familias con hijas e hijos inscritos en escuelas públicas de nivel básico (secundaria, primaria y preescolar).',
    simpleSummary:
      'Apoyo económico para familias con hijas o hijos en secundaria o primaria pública.',
    requirements: [
      'CURP de madre, padre o tutor',
      'Identificación oficial vigente del tutor (INE o pasaporte)',
      'Comprobante de domicilio reciente (máximo 6 meses)',
      'CURP de cada hija o hijo inscrito en escuela pública',
    ],
    steps: [
      {
        order: 1,
        title: 'Reúne los documentos de la familia',
        instruction:
          'Ten a la mano la CURP del tutor y de los estudiantes, identificación oficial y comprobante de domicilio.',
        simpleExplanation:
          'Junta tu credencial, un recibo de luz o agua y las CURP tuyas y de tus hijos.',
      },
      {
        order: 2,
        title: 'Asiste a la asamblea escolar o registra en línea',
        instruction:
          'Acude a la reunión informativa en la escuela de tus hijos o completa el registro cuando esté abierta la convocatoria.',
        simpleExplanation:
          'Pregunta en la escuela qué día van los servidores de la educación o entra al registro cuando abra.',
      },
      {
        order: 3,
        title: 'Recibe la tarjeta del Banco del Bienestar',
        instruction:
          'Guarda el comprobante de registro y acude por tu tarjeta en la sede y horario indicados.',
        simpleExplanation:
          'Guarda tu papel de confirmación para ir por la tarjeta cuando te avisen.',
      },
    ],
    cost: 'Gratuito',
    estimatedTime: '15 minutos de registro',
    officialChannel: 'Escuela pública / becaritacetina.gob.mx',
    keywords: [
      'beca rita cetina',
      'secundaria',
      'primaria',
      'hijos',
      'educacion basica',
      'becas',
      'tutor',
    ],
    updatedAt: '2026-11-01',
  },
  {
    id: 'educacion-certificado-sep',
    title: 'Reposición o descarga de Certificado de Estudios (SEP)',
    category: 'educacion',
    institution: 'Secretaría de Educación Pública (SEP)',
    summary:
      'Trámite para descargar en línea o solicitar un duplicado oficial de certificado de primaria, secundaria o preparatoria.',
    simpleSummary:
      'Sirve para conseguir otra copia oficial de tu certificado de primaria, secundaria o prepa si lo perdiste.',
    requirements: [
      'CURP del interesado',
      'Nombre completo y año aproximado de egreso',
      'Nombre y clave o ubicación de la escuela donde estudiaste',
      'Identificación oficial vigente (para trámite presencial)',
    ],
    steps: [
      {
        order: 1,
        title: 'Identifica el año y la escuela',
        instruction:
          'Anota el nombre completo de la escuela, municipio/alcaldía y el año en que terminaste tus estudios.',
        simpleExplanation:
          'Apunta en qué escuela estudiaste, en qué alcaldía o municipio estaba y el año en que saliste.',
      },
      {
        order: 2,
        title: 'Verifica si aplica descarga digital',
        instruction:
          'Si egresaste recientemente (a partir de 2017 en CDMX/estados adheridos), consulta el portal de Certificados Electrónicos de la SEP con tu CURP.',
        simpleExplanation:
          'Si terminaste hace pocos años, puede descargarse gratis por internet usando tu CURP o folio.',
      },
      {
        order: 3,
        title: 'Acude a Control Escolar si es antiguo',
        instruction:
          'Para certificados antiguos, acude a la oficina de Control Escolar de tu entidad o a tu última escuela para solicitar el duplicado.',
        simpleExplanation:
          'Si terminaste hace muchos años, lleva tu credencial y CURP a la oficina de educación de tu estado o a tu escuela.',
      },
    ],
    cost: 'Gratuito (digital) / Derecho estatal mínimo (duplicado físico antiguo)',
    estimatedTime: 'Inmediato (digital) o 5 a 15 días hábiles',
    officialChannel: 'Portal SEP / Control Escolar estatal',
    keywords: [
      'certificado',
      'sep',
      'primaria',
      'secundaria',
      'preparatoria',
      'duplicado',
      'reposicion',
      'estudios',
      'educacion',
    ],
    updatedAt: '2026-11-01',
  },
  {
    id: 'educacion-constancia-estudios',
    title: 'Solicitud de Constancia de Estudios e Historial Académico',
    category: 'educacion',
    institution: 'Plantel Escolar / Dirección General de Control Escolar',
    summary:
      'Documento oficial expedido por la escuela que acredita que el alumno está inscrito o ha cursado ciertos grados y materias.',
    simpleSummary:
      'Es una carta de tu escuela que comprueba que estás estudiando ahí, necesaria para becas o trámites.',
    requirements: [
      'Matrícula o número de control del estudiante',
      'CURP del estudiante',
      'Credencial escolar o identificación oficial',
    ],
    steps: [
      {
        order: 1,
        title: 'Acude al área de Servicios Escolares',
        instruction:
          'Preséntate en la ventanilla de Servicios Escolares o Control Escolar de tu escuela (o entra a su portal de alumnos).',
        simpleExplanation:
          'Ve a la oficina de Servicios Escolares de tu escuela o pídela en la página web para alumnos.',
      },
      {
        order: 2,
        title: 'Indica para qué trámite la necesitas',
        instruction:
          'Especifica si requieres que incluya calificaciones, promedio o firma y sello para beca o servicio médico.',
        simpleExplanation:
          'Diles si la necesitas para una beca o para el seguro médico, para que le pongan sello y firma.',
      },
      {
        order: 3,
        title: 'Recoge tu constancia sellada',
        instruction:
          'Verifica que tu nombre, CURP y grado estén bien escritos antes de retirarte.',
        simpleExplanation:
          'Antes de irte, revisa que tu nombre y CURP estén escritos sin errores.',
      },
    ],
    cost: 'Gratuito en escuelas públicas (o cuota mínima escolar)',
    estimatedTime: '1 a 3 días hábiles',
    officialChannel: 'Ventanilla de Control Escolar del plantel',
    keywords: [
      'constancia de estudios',
      'historial academico',
      'kardex',
      'inscripcion',
      'escuela',
      'educacion',
      'servicios escolares',
    ],
    updatedAt: '2026-11-01',
  },
];
