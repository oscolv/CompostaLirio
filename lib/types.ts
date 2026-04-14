import type { AnalisisJSON } from "@/lib/analisis";

export type MedicionEstado = "good" | "warning" | "danger";

export type Medicion = {
  id: number;
  compostera: number;
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url: string | null;
  created_at: string;
};

export type ComposteraInfo = {
  id: number;
  nombre: string | null;
  fecha_inicio: string | null;
  activa: boolean;
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
  dia: number | null;
  temperatura: number;
  ph: number;
  humedad: number;
  observaciones: string | null;
  estado: string;
  foto_url?: string | null;
  fecha?: string | null;
};
