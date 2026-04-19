import type { AnalisisJSON } from "@/lib/analisis";

export type MedicionEstado = "good" | "warning" | "danger";

export type Medicion = {
  id: number;
  compostera: number;
  ciclo_id: number | null;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url: string | null;
  created_at: string;
};

export type ComposteraEstado = "activa" | "inactiva" | "retirada";

export type ComposteraInfo = {
  id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  activa: boolean;
  masa_inicial?: number | null;
  sitio_id?: number | null;
  tipo?: string | null;
  capacidad_kg?: number | null;
  estado?: ComposteraEstado;
};

export type ComposteraConCounts = ComposteraInfo & {
  ciclos_count: number;
  mediciones_count: number;
};

export type Sitio = {
  id: number;
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  activo: boolean;
  created_at: string;
};

export type SitioInput = {
  nombre: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  activo?: boolean;
};

export type CicloEstado = "activo" | "cerrado" | "descartado";

export type Ciclo = {
  id: number;
  compostera_id: number;
  nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: CicloEstado;
  formulacion_id: number | null;
  peso_inicial_kg: number | null;
  objetivo: string | null;
  observaciones_generales: string | null;
  created_at: string;
};

export type CicloInput = {
  compostera_id: number;
  nombre?: string | null;
  fecha_inicio: string;
  formulacion_id?: number | null;
  peso_inicial_kg?: number | null;
  objetivo?: string | null;
  observaciones_generales?: string | null;
};

export type DiagFoto = {
  url: string;
  fecha: string;
  dia: number | null;
};

export type Message = {
  role: "user" | "assistant";
  content: string;
  fotos?: DiagFoto[];
};

export type AnalisisEstado = "verde" | "amarillo" | "rojo";

export type AnalizarRespuesta = {
  resultado: string;
  json: AnalisisJSON | null;
  estado: AnalisisEstado | null;
  accion: string | null;
};

export type MedicionInput = {
  compostera: number;
  ciclo_id?: number | null;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url?: string | null;
  fecha?: string | null;
};
