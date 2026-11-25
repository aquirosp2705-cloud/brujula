// Datos fijos de la app: nombre, versión, monedas y catálogos (tipos de cuenta, inversión, deuda, bienes).
// Para cambiar el nombre de la app basta con APP_NAME (y el manifest.webmanifest / index.html).

export const APP_NAME = 'Brújula';
export const APP_TAGLINE = 'Tus finanzas, en orden';
export const VERSION = '1';

// [código, nombre, símbolo, decimales por defecto]
export const CURRENCIES = [
  ['USD', 'Dólar estadounidense', '$', 2],
  ['EUR', 'Euro', '€', 2],
  ['MXN', 'Peso mexicano', '$', 2],
  ['COP', 'Peso colombiano', '$', 0],
  ['PEN', 'Sol peruano', 'S/', 2],
  ['CLP', 'Peso chileno', '$', 0],
  ['ARS', 'Peso argentino', '$', 2],
  ['BOB', 'Boliviano', 'Bs', 2],
  ['PYG', 'Guaraní', '₲', 0],
  ['UYU', 'Peso uruguayo', '$U', 2],
  ['GTQ', 'Quetzal', 'Q', 2],
  ['HNL', 'Lempira', 'L', 2],
  ['NIO', 'Córdoba', 'C$', 2],
  ['CRC', 'Colón costarricense', '₡', 2],
  ['DOP', 'Peso dominicano', 'RD$', 2],
  ['BRL', 'Real brasileño', 'R$', 2],
  ['CAD', 'Dólar canadiense', '$', 2],
];

export const ACC_TYPES = [
  ['ahorros', 'Cuenta de ahorros', '🏦'],
  ['corriente', 'Cuenta corriente', '💳'],
  ['efectivo', 'Efectivo', '💵'],
  ['digital', 'Billetera digital', '📱'],
  ['otra', 'Otra cuenta', '👛'],
];

export const CARD_NETWORKS = ['Visa', 'Mastercard', 'American Express', 'Diners Club', 'Discover', 'Otra'];

export const INV_TYPES = [
  ['plazo', 'Plazo fijo / póliza', '📜'],
  ['ahorro', 'Ahorro programado', '🐷'],
  ['fondo', 'Fondo de inversión', '📊'],
  ['acciones', 'Acciones / bolsa', '📈'],
  ['cripto', 'Criptomonedas', '🪙'],
  ['inmueble', 'Bienes raíces', '🏢'],
  ['otro', 'Otra inversión', '💼'],
];

export const DEBT_TYPES = [
  ['consumo', 'Préstamo bancario', '🏦'],
  ['hipoteca', 'Crédito hipotecario', '🏠'],
  ['vehiculo', 'Crédito vehicular', '🚗'],
  ['estudios', 'Crédito educativo', '🎓'],
  ['comercial', 'Casa comercial / crédito directo', '🛍️'],
  ['personal', 'Préstamo personal o familiar', '🤝'],
  ['otro', 'Otra deuda', '📄'],
];

export const ASSET_TYPES = [
  ['inmueble', 'Casa o departamento', '🏠'],
  ['terreno', 'Terreno', '🌳'],
  ['vehiculo', 'Vehículo', '🚗'],
  ['negocio', 'Negocio', '🏪'],
  ['otro', 'Otro bien', '💎'],
];

export const GROUPS = {
  nec: { label: 'Necesidades', short: 'Necesidades', color: '#6366F1', goal: 0.5, hint: 'Vivienda, servicios, comida, transporte, salud' },
  gus: { label: 'Gustos', short: 'Gustos', color: '#EC4899', goal: 0.3, hint: 'Salidas, compras, entretenimiento, viajes' },
  deu: { label: 'Pago de deudas', short: 'Deudas', color: '#F59E0B', goal: null, hint: 'Cuotas de préstamos, intereses y comisiones' },
};

export const PALETTE = ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#A855F7', '#64748B'];

export const NOTE_COLORS = ['#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#EDE9FE', '#FFE4E6', '#E0F2FE', '#F1F5F9'];

export const EMOJIS = ['🏠', '💡', '🛒', '🚗', '⛽', '🚌', '💊', '🏥', '🎓', '📚', '👕', '💇', '🍽️', '☕', '🍔', '🎬',
  '🎮', '📺', '🎵', '✈️', '🏖️', '🎁', '🐾', '👶', '🏦', '💳', '🧾', '🔧', '📱', '💻', '🏋️', '⚽', '🍷', '🚬', '💄',
  '🧹', '🪴', '🛠️', '📦', '💼', '🏪', '📈', '💰', '💵', '🪙', '🏘️', '↩️', '➕', '⭐', '❤️', '🎉', '🙏', '🧸', '🎨'];

export function defaultCategories() {
  const e = (id, name, icon, color, group) => ({ id, type: 'expense', name, icon, color, group, budget: 0 });
  const i = (id, name, icon, color) => ({ id, type: 'income', name, icon, color, group: null, budget: 0 });
  return [
    e('c_viv', 'Vivienda', '🏠', '#6366F1', 'nec'),
    e('c_ser', 'Servicios básicos', '💡', '#0EA5E9', 'nec'),
    e('c_sup', 'Supermercado', '🛒', '#22C55E', 'nec'),
    e('c_tra', 'Transporte', '🚗', '#F97316', 'nec'),
    e('c_sal', 'Salud', '💊', '#F43F5E', 'nec'),
    e('c_edu', 'Educación', '🎓', '#8B5CF6', 'nec'),
    e('c_hog', 'Hogar y mantenimiento', '🔧', '#64748B', 'nec'),
    e('c_hij', 'Hijos y familia', '👶', '#14B8A6', 'nec'),
    e('c_mas', 'Mascotas', '🐾', '#84CC16', 'nec'),
    e('c_imp', 'Impuestos y trámites', '🧾', '#475569', 'nec'),
    e('c_res', 'Restaurantes y salidas', '🍽️', '#EC4899', 'gus'),
    e('c_ent', 'Entretenimiento', '🎬', '#A855F7', 'gus'),
    e('c_sus', 'Suscripciones', '📺', '#06B6D4', 'gus'),
    e('c_rop', 'Ropa y cuidado personal', '👕', '#D946EF', 'gus'),
    e('c_via', 'Viajes', '✈️', '#3B82F6', 'gus'),
    e('c_reg', 'Regalos', '🎁', '#EF4444', 'gus'),
    e('c_deu', 'Cuotas de préstamos', '🏦', '#F59E0B', 'deu'),
    e('c_com', 'Intereses y comisiones', '💳', '#EAB308', 'deu'),
    e('c_otr', 'Otros gastos', '📦', '#94A3B8', 'gus'),
    i('i_sue', 'Sueldo', '💼', '#10B981'),
    i('i_ind', 'Trabajo independiente', '💻', '#14B8A6'),
    i('i_neg', 'Negocio y ventas', '🏪', '#22C55E'),
    i('i_ren', 'Rendimientos e intereses', '📈', '#0EA5E9'),
    i('i_arr', 'Arriendos recibidos', '🏘️', '#6366F1'),
    i('i_reg', 'Regalos recibidos', '🎁', '#EC4899'),
    i('i_ree', 'Reembolsos', '↩️', '#F59E0B'),
    i('i_otr', 'Otros ingresos', '➕', '#64748B'),
  ];
}

export const label = (list, key) => (list.find((x) => x[0] === key) || [key, key])[1];
export const emojiOf = (list, key) => (list.find((x) => x[0] === key) || [key, '', '•'])[2];
