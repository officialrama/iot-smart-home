/** Kontrak antara logika otomasi dan objek bergerak di scene 3D (mobil & orang). */
export interface Vec2 { x: number; z: number }

export type CarState = "parked" | "away" | "arriving" | "leaving";

export interface CarApi {
  readonly state: CarState;
  /** Posisi z mobil (gerbang di z=12, pintu garasi di z=6). */
  readonly z: number;
  arrive(): void;
  leave(): void;
  /** Pindahkan mobil ke luar layar tanpa animasi. */
  teleportAway(): void;
}

export type PersonId = "penghuni" | "tamu" | "anak" | "penyusup";

export interface PersonApi {
  readonly visible: boolean;
  readonly pos: Vec2;
  readonly walking: boolean;
  place(p: Vec2, opts?: { sit?: boolean; face?: number }): void;
  walk(path: Vec2[], speed?: number): Promise<void>;
  sit(face: number): void;
  hide(): void;
}

export interface ActorsApi {
  car: CarApi;
  person(id: PersonId): PersonApi;
}

/** Efek visual tambahan yang dipicu otomasi. */
export interface FxApi {
  /** Gelembung teks di atas posisi dunia (x, y, z). */
  bubble(x: number, y: number, z: number, text: string, seconds?: number): void;
}
